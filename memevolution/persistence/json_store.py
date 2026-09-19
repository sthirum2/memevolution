"""Simple JSON persistence for agent state and experiment history.

No database — the agent is small enough that two JSON files under `data/`
are sufficient, and it makes the state trivially inspectable/diffable.
"""

from __future__ import annotations

import json
from pathlib import Path

from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment

DATA_DIR = Path("data")
STATE_PATH = DATA_DIR / "agent_state.json"
EXPERIMENTS_PATH = DATA_DIR / "experiments.json"


def save_state(state: AgentState, path: Path | None = None) -> None:
    path = path or STATE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(state.model_dump_json(indent=2, by_alias=True), encoding="utf-8")


def load_state(path: Path | None = None) -> AgentState:
    path = path or STATE_PATH
    if not path.exists():
        return AgentState()
    return AgentState.model_validate_json(path.read_text(encoding="utf-8"))


def load_experiments(path: Path | None = None) -> list[Experiment]:
    path = path or EXPERIMENTS_PATH
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [Experiment.model_validate(item) for item in raw]


def save_experiment(experiment: Experiment, path: Path | None = None) -> None:
    path = path or EXPERIMENTS_PATH
    experiments = load_experiments(path)
    for i, existing in enumerate(experiments):
        if existing.id == experiment.id:
            experiments[i] = experiment
            break
    else:
        experiments.append(experiment)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            [e.model_dump(mode="json", by_alias=True) for e in experiments],
            indent=2,
        ),
        encoding="utf-8",
    )
