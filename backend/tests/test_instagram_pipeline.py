"""Contract tests use isolated SQL and provider doubles; never publish or touch data/."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import main, publish, generate_image
from app.database import Base, get_db
from memevolution.llm import gemini
from memevolution.prediction import role1
from memevolution.prediction.mock import MockFitnessPredictor
from memevolution.persistence import json_store


@pytest.fixture
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    main.app.dependency_overrides[get_db] = session
    def forbidden(*args, **kwargs):
        raise AssertionError("Browser pipeline must not access local JSON state")
    for name in ("save_state", "load_state", "save_experiment", "load_experiments"):
        monkeypatch.setattr(json_store, name, forbidden)
    monkeypatch.setattr(role1, "Role1FitnessPredictor", lambda: MockFitnessPredictor(seed=1))
    monkeypatch.setattr(gemini, "GeminiConceptGenerator", gemini.MockConceptGenerator)
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()
    engine.dispose()


def generated(client):
    response = client.post("/generation", json={"count": 5, "platform": "instagram", "topic": "hackathons", "riskAppetite": 1})
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 5
    assert all(r["genome"]["topic"] == "hackathons" for r in rows)
    assert all(r["prediction"] is not None for r in rows)
    selection = client.post("/select", json={"candidate_ids": [r["id"] for r in rows]}).json()
    assert selection["mode"] == "explore"
    return selection["selectedId"], rows


def test_full_pipeline_and_restart_contract(client, monkeypatch, tmp_path):
    selected, rows = generated(client)
    assert len(client.get("/experiments").json()) == 5
    # Selection comes from SQL, not a process-global last-selection cache.
    if hasattr(main.app.state, "last_selection"):
        del main.app.state.last_selection
    assert client.post("/select", json={"candidate_ids": [r["id"] for r in rows]}).json()["selectedId"] == selected
    assert client.post("/select", json={"candidate_ids": [selected]}).status_code == 409
    path = tmp_path / (selected + ".jpg")
    monkeypatch.setattr(generate_image, "make_meme_image", lambda *a, **kw: (path, "gemini"))
    base = "/experiments/" + selected
    assert client.post(base + "/publish", json={}).status_code == 409
    prepared = client.post(base + "/prepare").json()
    assert prepared["content"]["media_url"] == "/media/" + path.name
    calls = []
    monkeypatch.setattr(publish, "validate_configuration", lambda: None)
    def send(experiment, platform):
        calls.append(experiment)
        return {"experiment_id": selected, "platform": platform, "post_id": "1789", "permalink": "https://www.instagram.com/p/test/", "published_at": "2026-09-19T12:00:00Z", "status": "live", "instructions": None}
    monkeypatch.setattr(publish, "publish", send)
    assert client.post(base + "/publish", json={"platform": "instagram"}).status_code == 200
    assert client.post(base + "/publish", json={"platform": "instagram"}).status_code == 200
    assert len(calls) == 1
    monkeypatch.setattr(publish, "live_metrics", lambda e: {"experiment_id": selected, "fetched_at": "2026-09-19T13:00:00Z", "views": 1000, "likes": 120, "comments": 15, "shares": 50, "saves": 30, "fitness": .96})
    assert client.post(base + "/live-metrics").status_code == 200
    reloaded = client.get(base).json()
    assert reloaded["deployment"]["post_id"] == "1789"
    assert reloaded["observed"]["views"] == 1000
    assert len(reloaded["timeseries"]) == 1
    result = client.post("/evolve", json={"experiment_id": selected, "fitness": 0}).json()
    assert result["driverId"] == selected
    assert result["snapshot_id"] == reloaded["timeseries"][0]["id"]
    assert client.post("/evolve", json={"experiment_id": selected}).json() == result
    states = client.get("/agent-states").json()
    assert len(states) == 2
    assert states[0]["beliefs"] != states[1]["beliefs"]
    assert client.get(base).json()["evolve_result"] == result
    selected2, _ = generated(client)
    assert selected2 != selected
    assert client.get("/experiments/" + selected2).json()["generation"] == 2


def test_rejects_other_platforms_and_fake_deployment(client):
    selected, _ = generated(client)
    for platform in ("tiktok", "x"):
        assert client.post("/generation", json={"platform": platform}).status_code == 422
        assert client.post(f"/experiments/{selected}/publish", json={"platform": platform}).status_code == 422
        assert client.post(f"/experiments/{selected}/deploy", json={"platform": platform, "post_id": "123"}).status_code == 422
    assert client.post(f"/experiments/{selected}/deploy", json={"post_id": "pending_123"}).status_code == 422
    assert client.post("/evolve", json={"experiment_id": selected, "fitness": .9}).status_code == 409
    assert client.post("/generation", json={"count": 0}).status_code == 422


def test_partial_metrics_stay_unknown(client, monkeypatch):
    selected, _ = generated(client)
    base = f"/experiments/{selected}"
    client.post(base + "/deploy", json={"post_id": "123"})
    monkeypatch.setattr(publish, "live_metrics", lambda e: {"experiment_id": selected, "fetched_at": "2026-09-19T13:00:00Z", "views": 100, "likes": 1, "comments": None, "shares": None, "saves": None, "fitness": None})
    assert client.post(base + "/live-metrics").status_code == 200
    observed = client.get(base).json()["observed"]
    assert observed["shares"] is None and observed["fitness"] is None
    assert client.post("/evolve", json={"experiment_id": selected}).status_code == 409


def test_generation_fails_instead_of_silently_using_mock(client, monkeypatch):
    def fail(): raise RuntimeError("Model unavailable")
    monkeypatch.setattr(role1, "Role1FitnessPredictor", fail)
    assert client.post("/generation", json={}).status_code == 503
    assert client.get("/experiments").json() == []


def test_insights_does_not_substitute_reach_for_views(monkeypatch):
    monkeypatch.setenv("IG_ACCESS_TOKEN", "test")
    answers = iter([{"like_count": 7, "comments_count": 2}, {"data": [
        {"name": "reach", "values": [{"value": 90}]},
        {"name": "views", "values": [{"value": 120}]},
        {"name": "saved", "total_value": {"value": 3}},
        {"name": "shares", "values": []},
    ]}])
    monkeypatch.setattr(publish, "_get", lambda url: next(answers))
    got = publish.live_metrics({"id": "test", "deployment": {"platform": "instagram", "post_id": "123"}})
    assert got["views"] == 120 and got["saves"] == 3
    assert got["shares"] is None and got["fitness"] is None


def test_container_timeout_never_publishes(monkeypatch):
    for key in ("IG_ACCESS_TOKEN", "IG_USER_ID", "PUBLIC_MEDIA_BASE"):
        monkeypatch.setenv(key, "test")
    calls = []
    monkeypatch.setattr(publish, "_post", lambda url, params: calls.append(url) or {"id": "container"})
    monkeypatch.setattr(publish, "_get", lambda url: {"status_code": "IN_PROGRESS"})
    monkeypatch.setattr(publish.time, "sleep", lambda n: None)
    with pytest.raises(publish.PublishError, match="timed out"):
        publish._publish_instagram("test", "test.jpg", "caption", "gemini")
    assert len(calls) == 1
