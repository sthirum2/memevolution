import json
import random
from urllib.error import URLError

import pytest

from memevolution.integration import backboard_memory as memory
from memevolution.agent.orchestrator import apply_observation, run_generation
from memevolution.llm.gemini import MockConceptGenerator
from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment, Observation
from memevolution.models.prediction import Prediction
from memevolution.persistence import json_store
from memevolution.prediction.mock import MockFitnessPredictor


@pytest.fixture
def experiment(genome_factory):
    return Experiment(id="exp_002", generation=2, genome=genome_factory(), hypothesis="test",
                      prediction=Prediction(fitness=0.6, confidence=0.8),
                      observed=Observation(fitness=0.8, likes=12))


def test_memory_preserves_facts_without_filling_missing_metrics(experiment):
    payload = memory.build_experiment_memory(experiment)
    facts = payload["metadata"]["facts"]
    assert facts["observed"] == {"likes": 12, "fitness": 0.8}
    assert facts["prediction_error"] == pytest.approx(0.2)
    assert "outperformed" in payload["content"]
    assert facts["deployment"] == {}
    experiment.observed = Observation()
    with pytest.raises(ValueError):
        memory.build_experiment_memory(experiment)


def test_documented_rest_requests_and_scores(monkeypatch, experiment):
    calls = []
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self):
            return json.dumps({"memories": [{"id": "old-memory", "content": "Generation 2", "score": .91}]}).encode()
    def open_request(request, timeout):
        calls.append((request, timeout))
        return Response()
    monkeypatch.setattr(memory, "urlopen", open_request)
    client = memory.BackboardMemory("test-key", "assistant")
    client.store_experiment_memory(experiment)
    matches = client.retrieve_relevant_memories("relatable college experiences")
    assert calls[0][0].full_url.endswith("/assistants/assistant/memories")
    assert calls[1][0].full_url.endswith("/memories/search")
    assert json.loads(calls[1][0].data) == {"query": "relatable college experiences", "limit": 5}
    assert calls[1][0].get_header("X-api-key") == "test-key"
    assert calls[1][1] == 10
    assert matches[0]["score"] == .91


def test_optional_memory_failure_does_not_break_learning(monkeypatch, tmp_path):
    monkeypatch.setattr(json_store, "STATE_PATH", tmp_path / "state.json")
    monkeypatch.setattr(json_store, "EXPERIMENTS_PATH", tmp_path / "experiments.json")
    class Broken:
        def retrieve_relevant_memories(self, *args): raise URLError("offline")
        def store_experiment_memory(self, *args): raise URLError("offline")
    monkeypatch.setattr(memory, "configured_memory", lambda: Broken())
    result = run_generation(AgentState(), MockFitnessPredictor(seed=1), MockConceptGenerator(), rng=random.Random(1))
    state, observed = apply_observation(result.state, result.selection.selected.id, Observation(fitness=.9))
    assert observed.memory_storage["status"] == "error"
    assert observed.memory_context["status"] == "error"
    assert json_store.load_state().beliefs == state.beliefs
    assert json_store.load_experiments()[0].observed.fitness == .9


def test_context_hook_receives_old_relevant_experience(monkeypatch, tmp_path, experiment):
    monkeypatch.setattr(json_store, "STATE_PATH", tmp_path / "state.json")
    monkeypatch.setattr(json_store, "EXPERIMENTS_PATH", tmp_path / "experiments.json")
    class Client:
        assistant_id = "persistent-assistant"
        def retrieve_relevant_memories(self, query, limit):
            assert "Current genome" in query
            return [{"id": "generation-2-memory", "score": .9, "content": memory.build_experiment_memory(experiment)["content"]}]
    class Generator(MockConceptGenerator):
        def generate_meme_concept_with_context(self, genome, context):
            assert "Generation 2" in context
            assert "CURRENT NUMERIC BELIEFS" in context
            return self.generate_meme_concept(genome)
    monkeypatch.setattr(memory, "configured_memory", lambda: Client())
    result = run_generation(AgentState(generation=7), MockFitnessPredictor(seed=1), Generator(), rng=random.Random(1))
    assert result.generation == 8
    trace = json_store.load_experiments()[0].memory_context
    assert trace["consumed_by_generator"] is True
    assert trace["memories"][0]["id"] == "generation-2-memory"


def test_disabled_requires_no_network(monkeypatch, experiment):
    monkeypatch.delenv("BACKBOARD_API_KEY", raising=False)
    assert memory.store_experiment_memory(experiment) == {"status": "disabled"}
    assert memory.get_memory_context_for_generation(experiment.genome, {})["context"] == ""
