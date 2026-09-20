"""Generating a controlled population of candidates from a parent genome."""

from __future__ import annotations

import random
from typing import Callable

from memevolution.evolution.mutation import (
    ALL_TRAITS,
    CATEGORICAL_TRAITS,
    CATEGORICAL_VALUES,
    generate_hypothesis,
    mutate,
)
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


def _assign_traits(population_size: int, rng: random.Random) -> list[str]:
    """One belief-bearing trait per candidate, spread across the pool.

    Only these traits teach the agent anything: learning.update_state moves a
    belief for absurdity/irony/relatability/trend_relevance/video_length/
    audio_strategy and ignores the categorical ones. So every candidate carries
    one of these as its controlled variable, guaranteeing that whichever
    candidate wins, the observation that follows can update a belief.
    """
    pool = [t for t in ALL_TRAITS if t not in CATEGORICAL_TRAITS]
    rng.shuffle(pool)
    return [pool[i % len(pool)] for i in range(population_size)]


def _distinct_formats(parent_format: str, count: int, rng: random.Random) -> list[str]:
    """`count` formats, as distinct as the pool allows, none of them the parent's."""
    pool = [f for f in CATEGORICAL_VALUES["format"] if f != parent_format]
    rng.shuffle(pool)
    return [pool[i % len(pool)] for i in range(count)]


def generate_population(
    state: AgentState,
    population_size: int = 5,
    *,
    parent: MemeGenome | None = None,
    parent_id: str | None = None,
    id_factory: Callable[[], str],
    rng: random.Random | None = None,
    pin_topic: bool = False,
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

    assigned_traits = _assign_traits(population_size, rng)
    # Format is the axis a viewer actually sees, so it is varied across the
    # batch rather than left to chance: on its own the belief-bearing trait is
    # a number, and five candidates carrying the parent's wording read as one
    # idea repeated no matter how the numbers differ.
    formats = _distinct_formats(parent_genome.format, population_size, rng)
    # Some candidates also shift a second categorical so the batch differs in
    # voice and framing, not only in what kind of clip it is.
    flavour = [t for t in CATEGORICAL_TRAITS if t not in ("format", "topic")]
    if not pin_topic:
        flavour.append("topic")
    rng.shuffle(flavour)

    candidates: list[Experiment] = []
    for i, (trait, fmt) in enumerate(zip(assigned_traits, formats)):
        traits = [trait, "format"]
        if i % 2 == 1 and flavour:
            traits.append(flavour[(i // 2) % len(flavour)])
        mutated_genome, mutations = mutate(
            parent_genome, state, traits=traits, rng=rng, forced={"format": fmt}
        )
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
