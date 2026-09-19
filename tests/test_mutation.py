import random

from memevolution.evolution.mutation import generate_hypothesis, mutate
from memevolution.models.agent import AgentState


def test_mutate_changes_only_targeted_trait(genome_factory):
    genome = genome_factory()
    state = AgentState()
    new_genome, mutations = mutate(genome, state, traits=["absurdity"], rng=random.Random(42))

    assert len(mutations) == 1
    assert mutations[0].trait == "absurdity"
    assert new_genome.absurdity != genome.absurdity
    assert new_genome.irony == genome.irony
    assert new_genome.relatability == genome.relatability
    assert new_genome.trend_relevance == genome.trend_relevance
    assert new_genome.video_length == genome.video_length
    assert new_genome.audio_strategy == genome.audio_strategy


def test_mutate_produces_valid_genome(genome_factory):
    genome = genome_factory()
    state = AgentState()
    new_genome, _ = mutate(genome, state, traits=["trend_relevance"], rng=random.Random(1))
    assert 0.0 <= new_genome.trend_relevance <= 1.0


def test_mutate_records_from_and_to(genome_factory):
    genome = genome_factory()
    state = AgentState()
    _, mutations = mutate(genome, state, traits=["video_length"], rng=random.Random(3))
    m = mutations[0]
    assert m.from_value == genome.video_length
    assert m.to_value != m.from_value


def test_mutate_default_picks_one_or_two_traits(genome_factory):
    genome = genome_factory()
    state = AgentState()
    _, mutations = mutate(genome, state, rng=random.Random(7))
    assert 1 <= len(mutations) <= 2


def test_generate_hypothesis_mentions_mutated_trait(genome_factory):
    genome = genome_factory()
    state = AgentState()
    _, mutations = mutate(genome, state, traits=["absurdity"], rng=random.Random(5))
    hypothesis = generate_hypothesis(mutations)
    assert "absurdity" in hypothesis.lower()
