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

# The predictor run_generation scores with. Named once so the version stamped
# onto every Prediction row and the one /capabilities reports cannot drift.
PREDICTOR_NAME = "role1-xgboost"


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
            "media_url": "",
        }

    return {
        # The opening is the line burned onto the meme; title is internal.
        "headline": c.opening or c.title,
        "visual_description": c.visual,
        "punchline": c.punchline,
        "caption": c.caption,
        "audio": c.audio_strategy,
        "media_url": "",
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
        "confidence": {},
        "note": hypotheses[-1] if hypotheses else "Seeded from the starting beliefs.",
    }


def load_state(db):
    from sqlalchemy import select
    from .models import AgentState as StateRow
    from memevolution.models.agent import AgentState
    row = db.scalar(select(StateRow).order_by(StateRow.generation.desc()).limit(1))
    if row is None:
        return AgentState()
    return AgentState.model_validate(row.strategy_json)


def save_state(db, state):
    from .models import AgentState as StateRow
    row = db.get(StateRow, state.generation)
    if row is None:
        row = StateRow(generation=state.generation, strategy_json={})
        db.add(row)
    row.strategy_json = state.model_dump(mode="json", by_alias=True)


def run_generation(db, population_size=5, topic=None, risk_appetite=0.2):
    """Generate using real providers and atomically persist the whole batch in SQL."""
    from memevolution.agent.orchestrator import run_generation as generate
    from memevolution.llm.gemini import GeminiConceptGenerator
    from memevolution.prediction.role1 import Role1FitnessPredictor
    from .models import Experiment, Genome, Prediction
    from .schemas import GenomeInput
    from uuid import uuid4

    state = load_state(db)
    # Preserve the actual initial beliefs for the history view.
    if state.generation == 0:
        save_state(db, state)
    state = state.model_copy(update={"exploration_rate": risk_appetite,
                                     "exploitation_rate": 1 - risk_appetite})
    result = generate(state, Role1FitnessPredictor(), GeminiConceptGenerator(),
                      population_size=population_size, persist=False, topic=topic)
    # IDs cannot collide with imported/manual experiments or a previous run.
    for candidate in result.candidates:
        candidate.id = "exp_" + uuid4().hex[:16]
    selected = result.selection.selected
    selection = {
        "selectedId": selected.id,
        "mode": "explore" if result.selection.mode.startswith("explor") else "exploit",
        "reasoning": result.selection.reason,
        "ranking": sorted([
            {"id": c.id, "fitness": c.prediction.fitness, "confidence": c.prediction.confidence}
            for c in result.candidates
        ], key=lambda x: x["fitness"], reverse=True),
    }
    for candidate in result.candidates:
        content = concept_to_content(candidate)
        content["_agent"] = candidate.model_dump(mode="json", by_alias=True)
        content["_selection"] = selection
        db.add(Experiment(
            id=candidate.id, generation=candidate.generation, parent_id=candidate.parent_id,
            status="selected" if candidate.id == selected.id else "predicted",
            hypothesis=candidate.hypothesis,
            mutations=[m.model_dump(by_alias=True) for m in candidate.mutations],
            content=content, deployment_platform="instagram",
            genome=Genome(**GenomeInput.model_validate(candidate.genome.model_dump()).model_dump()),
            prediction=Prediction(predicted_fitness=candidate.prediction.fitness, model_version=PREDICTOR_NAME),
        ))
    save_state(db, result.state)
    db.commit()
    return {"ids": [c.id for c in result.candidates], "selection": selection}


def apply_observation(db, experiment):
    """Learn once per experiment from a persisted snapshot, never browser-supplied scores."""
    from memevolution.models.experiment import Experiment as AgentExperiment, Observation
    from memevolution.evolution.learning import update_state
    content = dict(experiment.content or {})
    if content.get("_evolve"):
        return content["_evolve"]
    if not content.get("_agent"):
        raise ValueError("This experiment has no agent genome; only generated experiments can teach the agent")
    if not experiment.snapshots or experiment.snapshots[-1].fitness is None:
        raise ValueError("A stored observation with a complete fitness score is required")
    snapshot = experiment.snapshots[-1]
    observed = AgentExperiment.model_validate(content["_agent"])
    observed.observed = Observation(**{
        key: getattr(snapshot, key) for key in ("views", "likes", "comments", "shares", "saves", "fitness")
    })
    observed.deployment.platform = "instagram"
    observed.deployment.post_id = experiment.post_id
    observed.deployment.timestamp = experiment.deployed_at
    before = load_state(db)
    state = update_state(before, observed)
    shifts = [
        {"trait": key, "from": before.beliefs.get(key, .5), "to": value,
         "delta": value - before.beliefs.get(key, .5)}
        for key, value in state.beliefs.items() if value != before.beliefs.get(key, .5)
    ]
    result = {"generation": state.generation, "previous": agent_state_to_api(before),
              "next": agent_state_to_api(state), "shifts": shifts, "driverId": experiment.id,
              "snapshot_id": snapshot.id}
    content["_evolve"] = result
    content["_agent"] = observed.model_dump(mode="json", by_alias=True)
    experiment.content = content
    experiment.status = "observed"
    save_state(db, state)
    db.commit()
    return result


def agent_states(db):
    from sqlalchemy import select
    from .models import AgentState as StateRow
    from memevolution.models.agent import AgentState
    rows = db.scalars(select(StateRow).order_by(StateRow.generation)).all()
    return [agent_state_to_api(AgentState.model_validate(r.strategy_json)) for r in rows]
