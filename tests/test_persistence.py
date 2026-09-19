from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment
from memevolution.persistence import json_store


def test_state_survives_save_and_load(tmp_path):
    path = tmp_path / "agent_state.json"
    state = AgentState(generation=3, exploration_rate=0.3)

    json_store.save_state(state, path=path)
    loaded = json_store.load_state(path=path)

    assert loaded.generation == 3
    assert loaded.exploration_rate == 0.3
    assert loaded.beliefs == state.beliefs


def test_load_state_returns_default_when_missing(tmp_path):
    path = tmp_path / "does_not_exist.json"
    state = json_store.load_state(path=path)
    assert state.generation == 0


def test_experiment_survives_save_and_load(tmp_path, genome_factory):
    path = tmp_path / "experiments.json"
    experiment = Experiment(id="exp_001", generation=1, genome=genome_factory(), hypothesis="h")

    json_store.save_experiment(experiment, path=path)
    loaded = json_store.load_experiments(path=path)

    assert len(loaded) == 1
    assert loaded[0].id == "exp_001"


def test_save_experiment_upserts_by_id(tmp_path, genome_factory):
    path = tmp_path / "experiments.json"
    experiment = Experiment(id="exp_001", generation=1, genome=genome_factory(), hypothesis="h")
    json_store.save_experiment(experiment, path=path)

    experiment.hypothesis = "updated"
    json_store.save_experiment(experiment, path=path)

    loaded = json_store.load_experiments(path=path)
    assert len(loaded) == 1
    assert loaded[0].hypothesis == "updated"
