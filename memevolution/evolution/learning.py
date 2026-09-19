"""Updating agent beliefs from the gap between predicted and actual fitness."""

from __future__ import annotations

from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment, Mutation

LEARNING_RATE = 0.15
SUCCESS_THRESHOLD = 0.6


def _mutation_belief_signal(mutation: Mutation) -> tuple[str, int] | None:
    """Map a mutation to the (belief_key, direction) it should influence.

    direction is +1 if the mutation moved the trait toward "more of this
    quality" (higher absurdity, a shorter video, trending audio) and -1
    if it moved away from it.
    """
    trait = mutation.trait
    if trait in ("absurdity", "irony", "relatability", "trend_relevance"):
        try:
            increased = float(mutation.to_value) > float(mutation.from_value)
        except (TypeError, ValueError):
            return None
        return trait, (1 if increased else -1)

    if trait == "video_length":
        try:
            got_shorter = float(mutation.to_value) < float(mutation.from_value)
        except (TypeError, ValueError):
            return None
        return "short_video", (1 if got_shorter else -1)

    if trait == "audio_strategy":
        to_trending = "trend" in str(mutation.to_value).lower()
        from_trending = "trend" in str(mutation.from_value).lower()
        if to_trending == from_trending:
            return None
        return "trending_audio", (1 if to_trending else -1)

    return None


def update_state(state: AgentState, experiment: Experiment) -> AgentState:
    """Learn from one observed experiment.

    error = actual_fitness - predicted_fitness. For each mutated trait,
    its belief moves by `LEARNING_RATE * error * direction`. Concretely:
    a mutation that raised a trait and then beat its prediction increases
    belief in that trait; underperforming decreases it. A mutation that
    lowered a trait gets the mirror update. If the experiment has no
    recorded observation yet, state is returned unchanged.
    """
    if experiment.observed.fitness is None or experiment.prediction is None:
        return state

    error = experiment.observed.fitness - experiment.prediction.fitness

    new_beliefs = dict(state.beliefs)
    for mutation in experiment.mutations:
        signal = _mutation_belief_signal(mutation)
        if signal is None:
            continue
        belief_key, direction = signal
        current = new_beliefs.get(belief_key, 0.5)
        updated = current + LEARNING_RATE * error * direction
        new_beliefs[belief_key] = min(1.0, max(0.0, updated))

    new_history = list(state.experiment_history)
    for i, existing in enumerate(new_history):
        if existing.id == experiment.id:
            new_history[i] = experiment
            break
    else:
        new_history.append(experiment)

    new_successful = list(state.successful_genomes)
    if experiment.observed.fitness >= SUCCESS_THRESHOLD:
        new_successful.append(experiment.genome)

    return state.model_copy(
        update={
            "beliefs": new_beliefs,
            "experiment_history": new_history,
            "successful_genomes": new_successful,
        }
    )
