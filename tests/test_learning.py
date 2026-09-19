from memevolution.evolution.learning import update_state
from memevolution.models.agent import AgentState
from memevolution.models.experiment import Experiment, Mutation, Observation
from memevolution.models.prediction import FitnessPrediction


def _experiment_with_absurdity_mutation(genome_factory, predicted, actual):
    genome = genome_factory(absurdity=0.7)
    return Experiment(
        id="exp_x",
        generation=1,
        genome=genome,
        hypothesis="h",
        mutations=[Mutation(trait="absurdity", **{"from": 0.5, "to": 0.7})],
        prediction=FitnessPrediction(fitness=predicted),
        observed=Observation(fitness=actual),
    )


def test_belief_decreases_when_actual_underperforms_prediction(genome_factory):
    state = AgentState()
    before = state.beliefs["absurdity"]
    experiment = _experiment_with_absurdity_mutation(genome_factory, predicted=0.70, actual=0.40)

    new_state = update_state(state, experiment)

    assert new_state.beliefs["absurdity"] < before


def test_belief_increases_when_actual_overperforms_prediction(genome_factory):
    state = AgentState()
    before = state.beliefs["absurdity"]
    experiment = _experiment_with_absurdity_mutation(genome_factory, predicted=0.40, actual=0.80)

    new_state = update_state(state, experiment)

    assert new_state.beliefs["absurdity"] > before


def test_update_state_is_noop_without_observation(genome_factory):
    state = AgentState()
    genome = genome_factory()
    experiment = Experiment(id="exp_y", generation=1, genome=genome, hypothesis="h")

    new_state = update_state(state, experiment)

    assert new_state.beliefs == state.beliefs
    assert new_state.experiment_history == []


def test_update_state_records_experiment_history(genome_factory):
    state = AgentState()
    experiment = _experiment_with_absurdity_mutation(genome_factory, predicted=0.5, actual=0.5)

    new_state = update_state(state, experiment)

    assert len(new_state.experiment_history) == 1
    assert new_state.experiment_history[0].id == "exp_x"


def test_high_fitness_experiment_added_to_successful_genomes(genome_factory):
    state = AgentState()
    experiment = _experiment_with_absurdity_mutation(genome_factory, predicted=0.5, actual=0.9)

    new_state = update_state(state, experiment)

    assert len(new_state.successful_genomes) == 1
