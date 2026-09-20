from datetime import datetime, timezone
from uuid import uuid4

from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import urllib.parse
import urllib.request
import json
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .fitness import spread_score
from . import agent_bridge, publish as publish_mod
from .database import get_db, initialize_database
from .models import EngagementSnapshot, Experiment, Genome, Prediction
from .schemas import (
    ContentIn,
    DeploymentResponse,
    DeployCreate,
    ExperimentCreate,
    ExperimentResponse,
    GenerationResponse,
    GenomeResponse,
    MetricsCreate,
    ObservedResponse,
    PredictionCreate,
    PredictionResponse,
    SnapshotResponse,
    PropagationPoint,
)
from .tiktok import ManualTikTokService

settings = get_settings()
app = FastAPI(title="Memevolution API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
tiktok_service = ManualTikTokService()


_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
_MEDIA = Path(__file__).parent.parent / "media"


@app.get("/media/{filename}")
def serve_media(filename: str):
    """Rendered memes, served from the same port as everything else so one
    tunnel covers the app, the API, and the images Meta fetches to publish."""
    file = _MEDIA / filename
    if not file.exists() or not file.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(str(file))


@app.on_event("startup")
def create_tables() -> None:
    initialize_database()
    if _DIST.exists():
        app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/capabilities")
def capabilities() -> dict:
    """What the backend can actually do right now.

    The Lab reads this so it can say when it is showing stub content. Without
    GEMINI_API_KEY the agent silently falls back to MockConceptGenerator, and
    a demo that presents template text as "the AI wrote five memes" is worse
    than one that admits the key is missing.
    """
    return {
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "instagram": bool(os.environ.get("IG_ACCESS_TOKEN") and os.environ.get("IG_USER_ID")),
        "publicMedia": bool(os.environ.get("PUBLIC_MEDIA_BASE")),
        "predictor": agent_bridge.predictor_name(),
    }


def get_experiment_or_404(db: Session, experiment_id: str) -> Experiment:
    experiment = db.scalar(
        select(Experiment)
        .options(selectinload(Experiment.genome), selectinload(Experiment.prediction), selectinload(Experiment.snapshots))
        .where(Experiment.id == experiment_id)
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


def to_response(experiment: Experiment) -> ExperimentResponse:
    latest = experiment.snapshots[-1] if experiment.snapshots else None
    return ExperimentResponse(
        id=experiment.id,
        generation=experiment.generation,
        parent_id=experiment.parent_id,
        genome=GenomeResponse.model_validate(experiment.genome),
        mutations=experiment.mutations or [],
        hypothesis=experiment.hypothesis,
        content=ContentIn(**(experiment.content or {})),
        prediction=(
            PredictionResponse(fitness=experiment.prediction.predicted_fitness, model_version=experiment.prediction.model_version)
            if experiment.prediction
            else None
        ),
        deployment=DeploymentResponse(
            platform=experiment.deployment_platform,
            timestamp=experiment.deployed_at,
            post_id=experiment.post_id,
        ),
        observed=ObservedResponse(
            views=latest.views if latest else None,
            likes=latest.likes if latest else None,
            comments=latest.comments if latest else None,
            shares=latest.shares if latest else None,
            saves=latest.saves if latest else None,
            fitness=latest.fitness if latest else None,
        ),
    )


@app.post("/experiments", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)) -> ExperimentResponse:
    experiment_id = payload.id or f"exp_{uuid4().hex[:8]}"
    if db.get(Experiment, experiment_id):
        raise HTTPException(status_code=409, detail="Experiment ID already exists")
    experiment = Experiment(
        id=experiment_id,
        generation=payload.generation,
        parent_id=payload.parent_id,
        status=payload.status,
        hypothesis=payload.hypothesis,
        content=payload.content.model_dump(),
        mutations=[mutation.model_dump(by_alias=True) for mutation in payload.mutations],
        genome=Genome(**payload.genome.model_dump()),
    )
    db.add(experiment)
    db.commit()
    return to_response(get_experiment_or_404(db, experiment_id))


@app.get("/experiments", response_model=list[ExperimentResponse])
def list_experiments(
    generation: int | None = None, db: Session = Depends(get_db)
) -> list[ExperimentResponse]:
    query = select(Experiment).options(
        selectinload(Experiment.genome), selectinload(Experiment.prediction), selectinload(Experiment.snapshots)
    ).order_by(Experiment.generation, Experiment.created_at)
    if generation is not None:
        query = query.where(Experiment.generation == generation)
    return [to_response(experiment) for experiment in db.scalars(query).all()]


@app.get("/experiments/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: str, db: Session = Depends(get_db)) -> ExperimentResponse:
    return to_response(get_experiment_or_404(db, experiment_id))


@app.get("/experiments/{experiment_id}/snapshots", response_model=list[SnapshotResponse])
def snapshot_history(experiment_id: str, db: Session = Depends(get_db)) -> list[SnapshotResponse]:
    experiment = get_experiment_or_404(db, experiment_id)
    return [SnapshotResponse.model_validate(snapshot) for snapshot in experiment.snapshots]


@app.get("/experiments/{experiment_id}/propagation", response_model=list[PropagationPoint])
def propagation(experiment_id: str, db: Session = Depends(get_db)) -> list[PropagationPoint]:
    snapshots = snapshot_history(experiment_id, db)
    points = []
    for index, snapshot in enumerate(snapshots):
        previous = snapshots[index - 1] if index else None
        interval = (snapshot.timestamp - previous.timestamp).total_seconds() if previous else None
        view_growth = (snapshot.views - previous.views
                       if previous and snapshot.views is not None and previous.views is not None else None)
        share_growth = (snapshot.shares - previous.shares
                        if previous and snapshot.shares is not None and previous.shares is not None else None)
        points.append(PropagationPoint(
            **snapshot.model_dump(),
            elapsed_seconds=(snapshot.timestamp - snapshots[0].timestamp).total_seconds(),
            interval_seconds=interval,
            view_growth=view_growth,
            share_growth=share_growth,
            views_per_hour=view_growth * 3600 / interval if interval and view_growth is not None else None,
            shares_per_hour=share_growth * 3600 / interval if interval and share_growth is not None else None,
        ))
    return points


@app.get("/generations", response_model=list[GenerationResponse])
def list_generations(db: Session = Depends(get_db)) -> list[GenerationResponse]:
    experiments = list_experiments(db=db)
    grouped: dict[int, list[ExperimentResponse]] = {}
    for experiment in experiments:
        grouped.setdefault(experiment.generation, []).append(experiment)
    return [GenerationResponse(generation=generation, experiments=items) for generation, items in sorted(grouped.items())]


@app.post("/experiments/{experiment_id}/prediction", response_model=ExperimentResponse)
def attach_prediction(
    experiment_id: str, payload: PredictionCreate, db: Session = Depends(get_db)
) -> ExperimentResponse:
    experiment = get_experiment_or_404(db, experiment_id)
    if experiment.prediction:
        experiment.prediction.predicted_fitness = payload.fitness
        experiment.prediction.model_version = payload.model_version
    else:
        experiment.prediction = Prediction(
            experiment_id=experiment_id,
            predicted_fitness=payload.fitness,
            model_version=payload.model_version,
        )
    db.commit()
    return to_response(get_experiment_or_404(db, experiment_id))


@app.post("/experiments/{experiment_id}/deploy", response_model=ExperimentResponse)
def deploy_experiment(
    experiment_id: str, payload: DeployCreate, db: Session = Depends(get_db)
) -> ExperimentResponse:
    experiment = get_experiment_or_404(db, experiment_id)
    experiment.deployment_platform = payload.platform
    experiment.post_id = tiktok_service.deploy(payload.post_id)
    experiment.deployed_at = payload.timestamp or datetime.now(timezone.utc)
    experiment.status = "deployed"
    db.commit()
    return to_response(get_experiment_or_404(db, experiment_id))


@app.post("/experiments/{experiment_id}/metrics", response_model=ExperimentResponse)
def record_metrics(
    experiment_id: str, payload: MetricsCreate, db: Session = Depends(get_db)
) -> ExperimentResponse:
    experiment = get_experiment_or_404(db, experiment_id)
    if not experiment.post_id:
        raise HTTPException(status_code=409, detail="Experiment must be deployed before metrics are recorded")
    db.add(
        EngagementSnapshot(
            experiment_id=experiment_id,
            # SQLite drops offsets, so normalize observations to UTC before storage.
            timestamp=(payload.timestamp.replace(tzinfo=timezone.utc) if payload.timestamp.tzinfo is None
                       else payload.timestamp.astimezone(timezone.utc))
                      if payload.timestamp else datetime.now(timezone.utc),
            views=payload.views,
            likes=payload.likes,
            comments=payload.comments,
            shares=payload.shares,
            saves=payload.saves,
            # Compute it when the caller does not supply one. Nothing else in
            # the system does: the agent expects Observation.fitness to be
            # handed to it, so real engagement arriving without a score leaves
            # prediction error undefined and the agent cannot learn from it.
            fitness=payload.fitness
            if payload.fitness is not None
            else spread_score(
                payload.views, payload.likes, payload.comments, payload.shares, payload.saves
            ),
        )
    )
    experiment.status = "observed"
    db.commit()
    db.expire(experiment, ["snapshots"])
    return to_response(get_experiment_or_404(db, experiment_id))


# ─────────────────────────────────────────────────────────────────────────────
# The agent, driven from the browser.
#
# The agent and this API share a package and a virtualenv, so these run the
# real evolutionary step in-process: the real XGBoost predictor scores the
# candidates and Gemini writes the concept. Nothing here is simulated.
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/agent-states")
def agent_states() -> list[dict]:
    """Belief history for the 'What it learned' screen."""
    try:
        return agent_bridge.agent_states()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"agent unavailable: {exc}") from exc


@app.post("/generation")
def generation(payload: dict | None = None) -> list[dict]:
    """Run one real generation and return the candidates the agent produced."""
    payload = payload or {}
    try:
        result = agent_bridge.run_generation(
            population_size=int(payload.get("count", 5)),
            topic=payload.get("topic"),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"generation failed: {exc}") from exc

    # Stash the selection so /select can answer without re-running the agent.
    app.state.last_selection = result["selection"]
    app.state.last_candidates = {c["id"]: c for c in result["candidates"]}
    return result["candidates"]


@app.post("/select")
# NB: not named `select` — that would shadow sqlalchemy.select, which every
# query in this module depends on, and break /experiments at runtime.
def select_candidate(payload: dict | None = None) -> dict:
    """The choice the agent already made during /generation."""
    selection = getattr(app.state, "last_selection", None)
    if not selection:
        raise HTTPException(status_code=409, detail="Run POST /generation first")
    return selection


@app.post("/evolve")
def evolve(payload: dict | None = None) -> dict:
    """Record real engagement and let the agent learn from the prediction error."""
    payload = payload or {}
    experiment_id = payload.get("experiment_id")
    if not experiment_id:
        raise HTTPException(status_code=422, detail="experiment_id is required")
    metrics = {
        k: payload.get(k)
        for k in ("views", "likes", "comments", "shares", "saves", "fitness")
        if payload.get(k) is not None
    }
    try:
        return agent_bridge.apply_observation(experiment_id, metrics)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"evolve failed: {exc}") from exc


@app.delete("/experiments")
def clear_all(db: Session = Depends(get_db)) -> dict:
    """Wipe everything for a clean demo reset."""
    db.execute(sa_delete(EngagementSnapshot))
    db.execute(sa_delete(Prediction))
    db.execute(sa_delete(Genome))
    db.execute(sa_delete(Experiment))
    db.commit()
    return {"cleared": True}


def _update_env_file(key: str, value: str) -> None:
    env_path = Path(__file__).parent.parent / ".env"
    text = env_path.read_text() if env_path.exists() else ""
    lines = text.splitlines()
    new_lines, updated = [], False
    for line in lines:
        if line.startswith(f"{key}="):
            new_lines.append(f"{key}={value}")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append(f"{key}={value}")
    env_path.write_text("\n".join(new_lines) + "\n")


@app.post("/refresh-ig-token")
def refresh_ig_token(payload: dict) -> dict:
    """Exchange a short-lived Graph API token for a 60-day long-lived one and save it."""
    token = (payload or {}).get("token")
    app_id = (payload or {}).get("app_id") or os.environ.get("IG_APP_ID", "")
    app_secret = (payload or {}).get("app_secret") or os.environ.get("IG_APP_SECRET", "")
    if not token:
        raise HTTPException(status_code=422, detail="Provide a 'token' field with your short-lived access token.")
    if not app_id or not app_secret:
        raise HTTPException(
            status_code=422,
            detail="Also provide 'app_id' and 'app_secret' (or set IG_APP_ID / IG_APP_SECRET in backend/.env).",
        )
    url = (
        f"https://graph.facebook.com/v21.0/oauth/access_token"
        f"?grant_type=fb_exchange_token"
        f"&client_id={urllib.parse.quote(str(app_id))}"
        f"&client_secret={urllib.parse.quote(str(app_secret))}"
        f"&fb_exchange_token={urllib.parse.quote(str(token))}"
    )
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise HTTPException(status_code=502, detail=f"Facebook returned an error: {body[:400]}") from None
    long_token = resp.get("access_token")
    if not long_token:
        raise HTTPException(status_code=502, detail=f"Unexpected response: {resp}")
    os.environ["IG_ACCESS_TOKEN"] = long_token
    _update_env_file("IG_APP_ID", str(app_id))
    _update_env_file("IG_APP_SECRET", str(app_secret))
    _update_env_file("IG_ACCESS_TOKEN", long_token)
    return {"long_lived_token": long_token, "expires_in_seconds": resp.get("expires_in", 5183944)}


@app.get("/corpus")
def corpus() -> dict:
    """Historical grounding. Empty shape keeps the UI happy until Role 1 fills it."""
    return {
        "datasets": [],
        "fitnessDistribution": [],
        "traitCorrelation": [],
        "propagationByFormat": [],
    }


@app.post("/experiments/{experiment_id}/publish")
def publish_experiment(experiment_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Render the meme and put it on a real account."""
    experiment = get_experiment_or_404(db, experiment_id)
    platform = (payload or {}).get("platform", "instagram")
    try:
        result = publish_mod.publish(to_response(experiment).model_dump(), platform)
    except publish_mod.PublishError as exc:
        # 409: the request is fine, the operator's setup is not. The UI shows
        # this text directly, so it has to say what to actually do.
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"publish failed: {exc}") from exc

    experiment.post_id = result["post_id"]
    experiment.deployment_platform = result["platform"]
    experiment.deployed_at = datetime.now(timezone.utc)
    experiment.status = "deployed"
    db.commit()
    return result


@app.get("/experiments/{experiment_id}/live-metrics")
def experiment_live_metrics(experiment_id: str, db: Session = Depends(get_db)) -> dict:
    """Pull the platform's own numbers for a published post."""
    experiment = get_experiment_or_404(db, experiment_id)
    try:
        return publish_mod.live_metrics(to_response(experiment).model_dump())
    except publish_mod.PublishError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None


# Temporary OAuth callback route to capture TikTok authorization code
_tiktok_code: dict = {}

@app.get("/callback")
def tiktok_callback(code: str = "", error: str = "", error_description: str = ""):
    """Captures TikTok OAuth callback code. Temporary route for token generation."""
    if error:
        return {"error": error, "description": error_description}
    _tiktok_code["code"] = code
    return {
        "status": "✅ Success! Copy this code and paste it to Claude:",
        "code": code,
        "next": "Paste this code to Claude to exchange for an access token"
    }

@app.get("/tiktok-code")
def get_tiktok_code():
    """Read the captured TikTok code."""
    return _tiktok_code


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    """Serve the built React frontend for any non-API route."""
    if not _DIST.exists():
        return {"error": "Frontend not built. Run: cd frontend && npm run build"}
    # Serve static assets directly
    file = _DIST / full_path
    if file.exists() and file.is_file():
        return FileResponse(str(file))
    # SPA fallback — always return index.html
    return FileResponse(str(_DIST / "index.html"))
