"""
DEV STUB — NOT Role 1 / NOT Calcifer.

MockFitnessPredictor does not use the Calcifer historical dataset or any
trained model. It exists only so Role 2 can be developed, tested, and
demoed before Role 1's real model is ready. Its scores are a simple
hand-picked heuristic plus bounded noise — never present them as real
historical predictions.

Swap this out by handing `run_generation` any object with a
`predict_fitness(genome) -> FitnessPrediction` method (see
`memevolution.prediction.interface.FitnessPredictor`).
"""

from __future__ import annotations

import random

from memevolution.models.genome import MemeGenome
from memevolution.models.prediction import FitnessPrediction


class MockFitnessPredictor:
    """Heuristic stand-in for Role 1's fitness model. Seedable for tests."""

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)

    def predict_fitness(self, genome: MemeGenome) -> FitnessPrediction:
        base = (
            0.35 * genome.absurdity
            + 0.20 * genome.irony
            + 0.30 * genome.relatability
            + 0.15 * genome.trend_relevance
        )
        noise = self._rng.uniform(-0.08, 0.08)
        fitness = min(1.0, max(0.0, base + noise))
        confidence = min(1.0, max(0.3, round(1.0 - abs(noise) * 3, 2)))
        return FitnessPrediction(fitness=round(fitness, 3), confidence=confidence)
