"""The high-level evolutionary loop: generate -> predict -> select -> concept -> persist."""

from __future__ import annotations

import random
from dataclasses import dataclass

from memevolution.evolution.learning import update_state
from memevolution.evolution.population import generate_population
from memevolution.evolution.selection import SelectionResult, select_candidate
from memevolution.llm.gemini import ConceptGenerator, get_concept_generator
from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment, MemeConcept, Observation
from memevolution.persistence import json_store
from memevolution.prediction.interface import FitnessPredictor
from memevolution.integration import backboard_memory


@dataclass
class GenerationResult:
    generation: int
    candidates: list[Experiment]
    selection: SelectionResult
    concept: MemeConcept
    state: AgentState


def run_generation(
    state: AgentState,
    predictor: FitnessPredictor,
    concept_generator: ConceptGenerator | None = None,
    population_size: int = 5,
    rng: random.Random | None = None,
) -> GenerationResult:
    """Run one full generation and persist the selected experiment + state.

    Flow: generate a population of mutated candidates -> ask `predictor`
    (Role 1's historical model, or a dev stub) for each one's predicted
    fitness -> select one candidate via explore/exploit -> generate its
    concrete meme concept -> persist. The experiment's `observed` fitness
    stays null; nothing here claims success until real engagement data
    comes back via `apply_observation`.
    """
    rng = rng or random.Random()
    concept_generator = concept_generator or get_concept_generator()

    counter = state.experiment_counter

    def id_factory() -> str:
        nonlocal counter
        counter += 1
        return f"exp_{counter:03d}"

    candidates = generate_population(
        state,
        population_size=population_size,
        id_factory=id_factory,
        rng=rng,
    )

    for candidate in candidates:
        candidate.prediction = predictor.predict_fitness(candidate.genome)

    selection = select_candidate(candidates, exploration_rate=state.exploration_rate, rng=rng)
    selected = selection.selected
    selected.memory_context = backboard_memory.get_memory_context_for_generation(
        selected.genome, state.beliefs
    )
    # Opt-in seam for the Gemini teammate; existing generators stay compatible.
    contextual_generate = getattr(concept_generator, "generate_meme_concept_with_context", None)
    if callable(contextual_generate) and selected.memory_context["context"]:
        selected.concept = contextual_generate(selected.genome, selected.memory_context["context"])
        selected.memory_context["consumed_by_generator"] = True
    else:
        selected.concept = concept_generator.generate_meme_concept(selected.genome)

    json_store.save_experiment(selected)

    new_state = state.model_copy(
        update={
            "generation": selected.generation,
            "hypotheses": state.hypotheses + [selected.hypothesis],
            "experiment_history": state.experiment_history + [selected],
            "experiment_counter": counter,
        }
    )
    json_store.save_state(new_state)

    return GenerationResult(
        generation=selected.generation,
        candidates=candidates,
        selection=selection,
        concept=selected.concept,
        state=new_state,
    )


def record_observation(experiment_id: str, observation: Observation) -> Experiment:
    """Attach real-world engagement numbers to a persisted experiment.

    This only records the numbers — it does not update agent beliefs.
    Use `apply_observation` to also let the agent learn from the result.
    """
    experiments = json_store.load_experiments()
    for experiment in experiments:
        if experiment.id == experiment_id:
            experiment.observed = observation
            json_store.save_experiment(experiment)
            return experiment
    raise KeyError(f"No experiment with id {experiment_id!r}")


def apply_observation(
    state: AgentState, experiment_id: str, observation: Observation
) -> tuple[AgentState, Experiment]:
    """Record an observation and update agent beliefs from the prediction error."""
    experiment = record_observation(experiment_id, observation)
    new_state = update_state(state, experiment)
    json_store.save_state(new_state)
    # Quantitative learning is already committed. Optional memory cannot undo it.
    try:
        from memevolution.integration.backboard_memory import store_experiment_memory

        experiment.memory_storage = store_experiment_memory(experiment)
        json_store.save_experiment(experiment)
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "[BACKBOARD] Optional memory unavailable; observation and beliefs remain saved."
        )
    return new_state, experiment
