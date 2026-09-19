"""Prediction output shape shared between Role 1's interface and Experiment."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FitnessPrediction(BaseModel):
    """What a FitnessPredictor (Role 1's model, or a dev stub) returns."""

    fitness: float = Field(ge=0.0, le=1.0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


# An Experiment's stored `prediction` field is the same shape as a fresh
# prediction from a FitnessPredictor — one model, two names for the two
# contexts it appears in.
Prediction = FitnessPrediction
