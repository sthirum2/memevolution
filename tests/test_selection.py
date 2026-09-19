import random

from memevolution.evolution.selection import select_candidate
from memevolution.models.experiment import Experiment
from memevolution.models.prediction import FitnessPrediction


def _experiment(genome_factory, id_, fitness, confidence):
    return Experiment(
        id=id_,
        generation=1,
        genome=genome_factory(),
        hypothesis="h",
        prediction=FitnessPrediction(fitness=fitness, confidence=confidence),
    )


def test_selection_exploits_best_score_when_exploration_rate_zero(genome_factory):
    candidates = [
        _experiment(genome_factory, "a", 0.5, 0.9),
        _experiment(genome_factory, "b", 0.9, 0.9),
        _experiment(genome_factory, "c", 0.3, 0.9),
    ]
    result = select_candidate(candidates, exploration_rate=0.0, rng=random.Random(0))
    assert result.selected.id == "b"
    assert result.mode == "exploitation"


def test_selection_can_explore_away_from_top_when_rate_is_one(genome_factory):
    candidates = [
        _experiment(genome_factory, "a", 0.5, 0.9),
        _experiment(genome_factory, "b", 0.9, 0.9),
        _experiment(genome_factory, "c", 0.3, 0.2),
    ]
    result = select_candidate(candidates, exploration_rate=1.0, rng=random.Random(0))
    assert result.mode == "exploration"
    assert result.selected.id != "b"


def test_selection_single_candidate_is_exploitation(genome_factory):
    candidates = [_experiment(genome_factory, "a", 0.5, 0.9)]
    result = select_candidate(candidates, exploration_rate=1.0, rng=random.Random(0))
    assert result.selected.id == "a"
    assert result.mode == "exploitation"
