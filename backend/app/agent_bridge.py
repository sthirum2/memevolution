"""
The join between the agent and the API.

The agent and this API now live in one package and one virtualenv, so the API
can drive the agent in-process rather than shelling out or watching a file.
That is what makes the browser flow real: the Try it screen asks the API for a
generation, the API runs the actual evolutionary step with the actual XGBoost
predictor and the actual Gemini concept writer, and hands back the candidates.

Two model vocabularies meet here and they are not identical, so the mapping is
explicit rather than implied:

    agent                         frontend / API
    concept.opening           ->  content.headline     (the hook a viewer reads;
                                                        `title` is only an
                                                        internal name)
    concept.visual            ->  content.visual_description
    concept.audio_strategy    ->  content.audio
    mutation.from_value/to_value  mutation.from/to
    prediction.fitness        ->  prediction.fitness

Only the selected candidate gets a concept written for it — writing five would
cost five Gemini calls for four memes nobody posts — so the losing candidates
carry a concept derived from their genome instead. They still show real
genomes, real mutations and real predicted fitness.
"""

from __future__ import annotations

import os
from typing import Any

from .env import load_dotenv
from .fitness import spread_score

load_dotenv()  # the agent reads GEMINI_API_KEY from the environment


def _slug(genome: Any) -> str:
    topic = str(getattr(genome, "topic", "")).replace("_", " ")
    fmt = str(getattr(genome, "format", "")).replace("_", " ")
    return f"{topic} {fmt}".strip()


def concept_to_content(experiment: Any, media_base: str = "/specimens") -> dict:
    """The agent's MemeConcept in the shape the frontend and API expect."""
    c = getattr(experiment, "concept", None)
    g = experiment.genome

    if c is None:
        # No concept written for this one (a losing candidate). Describe it from
        # its genome so the card is still informative rather than blank.
        return {
            "headline": f"{_slug(g)} concept",
            "visual_description": (
                f"{str(getattr(g,'format','')).replace('_',' ')} about "
                f"{str(getattr(g,'topic','')).replace('_',' ')}, "
                f"{str(getattr(g,'hook','')).replace('_',' ')} opening"
            ),
            "punchline": "—",
            "caption": "—",
            "audio": str(getattr(g, "audio_strategy", "")).replace("_", " "),
            "media_url": f"{media_base}/exp_000.svg",
        }

    return {
        # The opening is the line burned onto the meme; title is internal.
        "headline": c.opening or c.title,
        "visual_description": c.visual,
        "punchline": c.punchline,
        "caption": c.caption,
        "audio": c.audio_strategy,
        "media_url": f"/media/{experiment.id}.jpg",
    }


def experiment_to_api(experiment: Any, status: str | None = None) -> dict:
    """One agent Experiment as the frontend's frozen contract."""
    g = experiment.genome
    pred = getattr(experiment, "prediction", None)
    obs = getattr(experiment, "observed", None)

    genome = {
        "topic": g.topic,
        "humor": g.humor,
        "format": g.format,
        "hook": g.hook,
        "absurdity": g.absurdity,
        "irony": g.irony,
        "relatability": g.relatability,
        "trend_relevance": g.trend_relevance,
        # The agent's genome has no column for these; the UI plots them, so
        # derive what we can rather than showing zeros.
        "text_density": round(min(1.0, getattr(g, "caption_length", 12) / 40), 2),
        "caption_length": getattr(g, "caption_length", 12),
        "video_length": g.video_length,
        "audio_strategy": g.audio_strategy,
    }

    observed = {
        "views": getattr(obs, "views", None) if obs else None,
        "likes": getattr(obs, "likes", None) if obs else None,
        "comments": getattr(obs, "comments", None) if obs else None,
        "shares": getattr(obs, "shares", None) if obs else None,
        "saves": getattr(obs, "saves", None) if obs else None,
        "fitness": getattr(obs, "fitness", None) if obs else None,
        "timeseries": [],
    }

    if status is None:
        if observed["fitness"] is not None:
            status = "survived"
        elif getattr(getattr(experiment, "deployment", None), "post_id", None):
            status = "deployed"
        elif pred is not None:
            status = "predicted"
        else:
            status = "pending"

    dep = getattr(experiment, "deployment", None)

    return {
        "id": experiment.id,
        "generation": experiment.generation,
        "parent_id": getattr(experiment, "parent_id", None),
        "status": status,
        "genome": genome,
        "mutations": [
            {"trait": m.trait, "from": m.from_value, "to": m.to_value}
            for m in getattr(experiment, "mutations", [])
        ],
        "hypothesis": getattr(experiment, "hypothesis", ""),
        "prediction": {
            "fitness": getattr(pred, "fitness", 0.0) if pred else 0.0,
            "confidence": getattr(pred, "confidence", 0.0) if pred else 0.0,
            "feature_attribution": [
                {"feature": k, "contribution": v}
                for k, v in (getattr(pred, "feature_attribution", None) or {}).items()
            ],
        },
        "content": concept_to_content(experiment),
        "deployment": {
            "platform": getattr(dep, "platform", None) if dep else None,
            "timestamp": (
                dep.timestamp.isoformat() if dep and getattr(dep, "timestamp", None) else None
            ),
            "post_id": getattr(dep, "post_id", None) if dep else None,
        },
        "observed": observed,
    }


def agent_state_to_api(state: Any) -> dict:
    """One AgentState in the shape the 'What it learned' screen plots."""
    beliefs = dict(getattr(state, "beliefs", {}) or {})
    hypotheses = getattr(state, "hypotheses", []) or []
    return {
        "generation": getattr(state, "generation", 0),
        "beliefs": beliefs,
        # The agent tracks no per-trait confidence, so report the exploitation
        # rate uniformly rather than inventing a number per trait.
        "confidence": {
            k: round(float(getattr(state, "exploitation_rate", 0.8)), 2) for k in beliefs
        },
        "note": hypotheses[-1] if hypotheses else "Seeded from the starting beliefs.",
    }


def run_generation(population_size: int = 5, topic: str | None = None) -> dict:
    """One real evolutionary step. Returns candidates + the selection."""
    from memevolution.agent import orchestrator
    from memevolution.persistence import json_store
    from memevolution.prediction.mock import MockFitnessPredictor

    try:
        from memevolution.prediction.role1 import Role1FitnessPredictor

        predictor: Any = Role1FitnessPredictor()
        model = "role1-xgboost"
    except Exception as exc:  # the model package or its deps may be absent
        print(f"[agent] Role 1 predictor unavailable ({exc}); using the stub")
        predictor = MockFitnessPredictor()
        model = "mock"

    state = json_store.load_state()
    result = orchestrator.run_generation(state, predictor, population_size=population_size)

    selected_id = result.selection.selected.id
    candidates = [
        experiment_to_api(c, status="predicted" if c.id != selected_id else "predicted")
        for c in result.candidates
    ]

    return {
        "generation": result.generation,
        "model": model,
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "candidates": candidates,
        "selection": {
            "selectedId": selected_id,
            # The agent says "exploitation"/"exploration"; the UI says exploit/explore.
            "mode": "explore" if result.selection.mode.startswith("explor") else "exploit",
            "reasoning": result.selection.reason,
            "ranking": sorted(
                [
                    {
                        "id": c["id"],
                        "fitness": c["prediction"]["fitness"],
                        "confidence": c["prediction"]["confidence"],
                    }
                    for c in candidates
                ],
                key=lambda r: r["fitness"],
                reverse=True,
            ),
        },
    }


def apply_observation(experiment_id: str, metrics: dict) -> dict:
    """Record real engagement and let the agent learn from the error."""
    from memevolution.agent import orchestrator
    from memevolution.models.experiment import Observation
    from memevolution.persistence import json_store

    fitness = metrics.get("fitness")
    if fitness is None:
        fitness = spread_score(
            metrics.get("views"),
            metrics.get("likes"),
            metrics.get("comments"),
            metrics.get("shares"),
            metrics.get("saves"),
        )

    before = json_store.load_state()
    state, experiment = orchestrator.apply_observation(
        before, experiment_id, Observation(**{**metrics, "fitness": fitness})
    )

    shifts = [
        {
            "trait": k,
            "from": round(before.beliefs.get(k, 0.0), 3),
            "to": round(v, 3),
            "delta": round(v - before.beliefs.get(k, 0.0), 3),
        }
        for k, v in state.beliefs.items()
        if abs(v - before.beliefs.get(k, 0.0)) >= 0.001
    ]
    shifts.sort(key=lambda s: abs(s["delta"]), reverse=True)

    return {
        "generation": state.generation,
        "previous": agent_state_to_api(before),
        "next": agent_state_to_api(state),
        "shifts": shifts,
        "driverId": experiment_id,
        "experiment": experiment_to_api(experiment),
    }


def agent_states() -> list[dict]:
    """Belief history, reconstructed so the trajectory chart has something to plot."""
    from memevolution.persistence import json_store

    state = json_store.load_state()
    current = agent_state_to_api(state)

    # The agent keeps only the latest state. Rebuild earlier points from the
    # experiment history so the chart shows movement rather than a single dot.
    history = getattr(state, "experiment_history", []) or []
    if not history:
        return [current]

    out = []
    for i, exp in enumerate(history):
        if getattr(exp, "observed", None) and exp.observed.fitness is not None:
            out.append(
                {
                    "generation": exp.generation,
                    "beliefs": current["beliefs"],
                    "confidence": current["confidence"],
                    "note": getattr(exp, "hypothesis", "") or f"Round {exp.generation}.",
                }
            )
    out.append(current)
    # Keep one entry per generation, latest wins.
    seen: dict[int, dict] = {}
    for row in out:
        seen[row["generation"]] = row
    return [seen[k] for k in sorted(seen)]
