"""Run one Role 2 generation and store its selected experiment in Role 4."""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent-repo", type=Path, required=True)
    parser.add_argument("--backend-url", default="http://127.0.0.1:8000")
    parser.add_argument("--population-size", type=int, default=5)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--model-version", default="agent")
    args = parser.parse_args()

    sys.path.insert(0, str(args.agent_repo))
    from memevolution.agent.orchestrator import run_generation
    from memevolution.llm.gemini import MockConceptGenerator
    from memevolution.models.agent import AgentState
    from memevolution.persistence import json_store
    from memevolution.prediction.mock import MockFitnessPredictor

    from agent_backend import MemevolutionBackend

    state = json_store.load_state()
    result = run_generation(
        state,
        MockFitnessPredictor(seed=args.seed),
        concept_generator=MockConceptGenerator(),
        population_size=args.population_size,
        rng=random.Random(args.seed),
    )
    selected = result.selection.selected
    MemevolutionBackend(args.backend_url).store_selected_experiment(selected, args.model_version)
    print(f"Stored {selected.id} (generation {selected.generation})")
    print(f"Prediction: {selected.prediction.fitness if selected.prediction else 'n/a'}")
    print("Next step: manually post the selected concept, then call POST /experiments/{id}/deploy.")


if __name__ == "__main__":
    main()