import random

from memevolution.evolution.population import generate_population
from memevolution.models.agent import AgentState


def _id_factory():
    counter = {"n": 0}

    def factory():
        counter["n"] += 1
        return f"exp_{counter['n']:03d}"

    return factory


def test_generate_population_returns_requested_size():
    state = AgentState()
    candidates = generate_population(
        state, population_size=5, id_factory=_id_factory(), rng=random.Random(7)
    )
    assert len(candidates) == 5


def test_generate_population_candidates_have_unique_ids_and_mutations():
    state = AgentState()
    candidates = generate_population(
        state, population_size=5, id_factory=_id_factory(), rng=random.Random(7)
    )
    ids = [c.id for c in candidates]
    assert len(set(ids)) == 5
    for c in candidates:
        assert len(c.mutations) >= 1
        assert c.hypothesis


def test_generate_population_candidates_target_different_traits():
    state = AgentState()
    candidates = generate_population(
        state, population_size=5, id_factory=_id_factory(), rng=random.Random(7)
    )
    mutated_traits = [c.mutations[0].trait for c in candidates]
    # controlled experimentation: candidates aren't all mutating the same trait
    assert len(set(mutated_traits)) > 1


def test_generate_population_increments_generation():
    state = AgentState(generation=2)
    candidates = generate_population(
        state, population_size=3, id_factory=_id_factory(), rng=random.Random(1)
    )
    assert all(c.generation == 3 for c in candidates)
