import pytest

pytest.importorskip("xgboost")
pytest.importorskip("pandas")

from memevolution.prediction.interface import FitnessPredictor
from memevolution.prediction.role1 import Role1FitnessPredictor


@pytest.fixture(scope="module")
def role1_predictor():
    try:
        return Role1FitnessPredictor()
    except RuntimeError as exc:
        pytest.skip(f"Role 1 model not available: {exc}")


def test_role1_predictor_implements_protocol(role1_predictor):
    assert isinstance(role1_predictor, FitnessPredictor)


def test_role1_predictor_returns_fitness_in_range(role1_predictor, genome_factory):
    prediction = role1_predictor.predict_fitness(genome_factory())
    assert 0.0 <= prediction.fitness <= 1.0


def test_role1_predictor_reacts_to_video_length(role1_predictor, genome_factory):
    short = role1_predictor.predict_fitness(genome_factory(video_length=5))
    long = role1_predictor.predict_fitness(genome_factory(video_length=55))
    assert short.fitness != long.fitness


def test_role1_predictor_reacts_to_absurdity(role1_predictor, genome_factory):
    """Gap #1 (see role1.py's module docstring) used to mean the model was
    blind to absurdity/irony/relatability/trend_relevance. That's resolved
    now that Role 1's model was retrained with those features -- this test
    used to assert the (bad) opposite of this."""
    low = role1_predictor.predict_fitness(genome_factory(absurdity=0.1))
    high = role1_predictor.predict_fitness(genome_factory(absurdity=0.9))
    assert low.fitness != high.fitness


def test_role1_predictor_reacts_to_relatability(role1_predictor, genome_factory):
    low = role1_predictor.predict_fitness(genome_factory(relatability=0.1))
    high = role1_predictor.predict_fitness(genome_factory(relatability=0.9))
    assert low.fitness != high.fitness
