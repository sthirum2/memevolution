"""Generating a controlled population of candidates from a parent genome."""

from __future__ import annotations

import random
from typing import Callable

from memevolution.evolution.mutation import ALL_TRAITS, generate_hypothesis, mutate
from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment
from memevolution.models.genome import MemeGenome

# The genome the agent starts from when it has no successful genomes yet.
SEED_GENOME = MemeGenome(
    topic="college",
    humor="absurdist",
    format="pov",
    hook="unexpected_text",
    absurdity=0.5,
    irony=0.5,
    relatability=0.5,
    trend_relevance=0.5,
    caption_length=80,
    video_length=10,
    audio_strategy="original_sound",
)


def _select_parent(state: AgentState) -> MemeGenome:
    if state.successful_genomes:
        return state.successful_genomes[-1]
    return SEED_GENOME


def generate_population(
    state: AgentState,
    population_size: int = 5,
    *,
    parent: MemeGenome | None = None,
    parent_id: str | None = None,
    id_factory: Callable[[], str],
    rng: random.Random | None = None,
) -> list[Experiment]:
    """Generate ~population_size candidates, each testing one different trait.

    Every candidate is one small, recorded mutation away from the same
    parent genome — controlled evolutionary experimentation, not a random
    reshuffle. Predictions and concepts are left unset here; the
    orchestrator fills those in after calling Role 1's predictor and
    selecting a winner.
    """
    rng = rng or random.Random()
    parent_genome = parent or _select_parent(state)
    next_generation = state.generation + 1

    trait_pool = list(ALL_TRAITS)
    rng.shuffle(trait_pool)
    assigned_traits = [trait_pool[i % len(trait_pool)] for i in range(population_size)]

    candidates: list[Experiment] = []
    for trait in assigned_traits:
        mutated_genome, mutations = mutate(parent_genome, state, traits=[trait], rng=rng)
        hypothesis = generate_hypothesis(mutations)
        candidates.append(
            Experiment(
                id=id_factory(),
                generation=next_generation,
                parent_id=parent_id,
                genome=mutated_genome,
                mutations=mutations,
                hypothesis=hypothesis,
            )
        )
    return candidates
