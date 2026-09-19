"""HTTP adapter between Role 2's Pydantic objects and the Role 4 API."""

from __future__ import annotations

import json
from collections.abc import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class BackendClientError(RuntimeError):
    """Raised when the backend rejects or cannot receive an adapter request."""


RequestJson = Callable[[str, str, dict | None], dict]


def _http_json_request(base_url: str, method: str, path: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        detail = exc.read().decode("utf-8") if isinstance(exc, HTTPError) else str(exc)
        raise BackendClientError(f"Backend request failed: {detail}") from exc


class MemevolutionBackend:
    """Small HTTP client used by the agent; it never accesses the database directly."""

    def __init__(self, base_url: str = "http://127.0.0.1:8000", request_json: RequestJson | None = None) -> None:
        self.base_url = base_url
        self._request_json = request_json or (
            lambda method, path, payload=None: _http_json_request(self.base_url, method, path, payload)
        )

    @staticmethod
    def _dump(value: object) -> dict:
        if hasattr(value, "model_dump"):
            return value.model_dump(mode="json", by_alias=True)
        if isinstance(value, dict):
            return value
        raise TypeError("Expected a Pydantic model or dictionary")

    def create_experiment(self, experiment: object) -> dict:
        data = self._dump(experiment)
        genome = data.get("genome", {})
        shared_genome = {
            field: genome[field]
            for field in (
                "topic",
                "humor",
                "format",
                "hook",
                "absurdity",
                "irony",
                "relatability",
                "trend_relevance",
                "video_length",
            )
            if field in genome
        }
        payload = {
            "id": data["id"],
            "generation": data["generation"],
            "parent_id": data.get("parent_id"),
            "genome": shared_genome,
            "mutations": data.get("mutations", []),
            "hypothesis": data["hypothesis"],
        }
        return self._request_json("POST", "/experiments", payload)

    def attach_prediction(self, experiment_id: str, prediction: object, model_version: str = "agent") -> dict:
        data = self._dump(prediction)
        payload = {"fitness": data["fitness"], "model_version": model_version}
        return self._request_json("POST", f"/experiments/{experiment_id}/prediction", payload)

    def store_selected_experiment(self, experiment: object, model_version: str = "agent") -> dict:
        data = self._dump(experiment)
        response = self.create_experiment(experiment)
        if data.get("prediction") is not None:
            response = self.attach_prediction(data["id"], data["prediction"], model_version)
        return response

    def get_experiment(self, experiment_id: str) -> dict:
        return self._request_json("GET", f"/experiments/{experiment_id}")

    def get_observed_results(self, experiment_id: str) -> dict:
        return self.get_experiment(experiment_id).get("observed", {})

    def mark_deployed(self, experiment_id: str, post_id: str, platform: str = "tiktok") -> dict:
        return self._request_json(
            "POST",
            f"/experiments/{experiment_id}/deploy",
            {"post_id": post_id, "platform": platform},
        )

    def record_metrics(self, experiment_id: str, metrics: object) -> dict:
        data = self._dump(metrics)
        payload = {
            field: data[field]
            for field in ("timestamp", "views", "likes", "comments", "shares", "saves", "fitness")
            if field in data and data[field] is not None
        }
        return self._request_json("POST", f"/experiments/{experiment_id}/metrics", payload)

    def observation_for_agent(self, experiment_id: str, observation_type: type) -> object:
        """Build Role 2's Observation model without importing the agent package here."""
        return observation_type(**self.get_observed_results(experiment_id))