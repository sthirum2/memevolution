"""The contract between Role 2 (this agent) and Role 1 (historical model).

Role 2 must never know how a predictor arrives at a number, only that it
implements this Protocol. To plug in the real Calcifer-trained model, write
a class with a `predict_fitness` method matching this signature and pass an
instance of it to `run_generation` — no other Role 2 code needs to change.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from memevolution.models.genome import MemeGenome
from memevolution.models.prediction import FitnessPrediction

__all__ = ["FitnessPredictor", "FitnessPrediction"]


@runtime_checkable
class FitnessPredictor(Protocol):
    def predict_fitness(self, genome: MemeGenome) -> FitnessPrediction:
        """Return Role 1's historical-fitness estimate for this genome."""
        ...
