from memevolution.prediction.interface import FitnessPredictor
from memevolution.prediction.mock import MockFitnessPredictor


def test_mock_predictor_implements_protocol():
    predictor = MockFitnessPredictor(seed=1)
    assert isinstance(predictor, FitnessPredictor)


def test_mock_predictor_returns_fitness_in_range(genome_factory):
    predictor = MockFitnessPredictor(seed=1)
    genome = genome_factory()
    prediction = predictor.predict_fitness(genome)
    assert 0.0 <= prediction.fitness <= 1.0
    assert prediction.confidence is not None
    assert 0.0 <= prediction.confidence <= 1.0


def test_mock_predictor_is_seedable(genome_factory):
    genome = genome_factory()
    a = MockFitnessPredictor(seed=99).predict_fitness(genome)
    b = MockFitnessPredictor(seed=99).predict_fitness(genome)
    assert a.fitness == b.fitness


def test_higher_absurdity_scores_higher_on_average(genome_factory):
    low = genome_factory(absurdity=0.1)
    high = genome_factory(absurdity=0.9)
    predictor = MockFitnessPredictor(seed=0)
    assert predictor.predict_fitness(high).fitness > predictor.predict_fitness(low).fitness
