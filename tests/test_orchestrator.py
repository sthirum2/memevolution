import random

from memevolution.agent.orchestrator import apply_observation, run_generation
from memevolution.llm.gemini import MockConceptGenerator
from memevolution.models.agent import AgentState
from memevolution.models.experiment import Observation
from memevolution.persistence import json_store
from memevolution.prediction.mock import MockFitnessPredictor


def test_run_generation_end_to_end(tmp_path, monkeypatch):
    monkeypatch.setattr(json_store, "STATE_PATH", tmp_path / "agent_state.json")
    monkeypatch.setattr(json_store, "EXPERIMENTS_PATH", tmp_path / "experiments.json")

    state = AgentState()
    predictor = MockFitnessPredictor(seed=1)
    result = run_generation(
        state,
        predictor,
        concept_generator=MockConceptGenerator(),
        population_size=5,
        rng=random.Random(1),
    )

    assert len(result.candidates) == 5
    assert all(c.prediction is not None for c in result.candidates)
    assert result.selection.selected.concept is not None
    assert result.state.generation == 1
    assert result.state.experiment_counter == 5

    persisted = json_store.load_experiments(path=tmp_path / "experiments.json")
    assert len(persisted) == 1
    assert persisted[0].id == result.selection.selected.id


def test_apply_observation_updates_beliefs_and_persists(tmp_path, monkeypatch):
    monkeypatch.setattr(json_store, "STATE_PATH", tmp_path / "agent_state.json")
    monkeypatch.setattr(json_store, "EXPERIMENTS_PATH", tmp_path / "experiments.json")

    state = AgentState()
    predictor = MockFitnessPredictor(seed=2)
    result = run_generation(
        state,
        predictor,
        concept_generator=MockConceptGenerator(),
        population_size=5,
        rng=random.Random(2),
    )

    exp_id = result.selection.selected.id
    new_state, experiment = apply_observation(
        result.state, exp_id, Observation(fitness=0.9)
    )

    assert experiment.observed.fitness == 0.9
    assert experiment.prediction_error is not None
    reloaded = json_store.load_state(path=tmp_path / "agent_state.json")
    assert reloaded.beliefs == new_state.beliefs
