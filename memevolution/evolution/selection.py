"""Choosing which predicted candidate to actually run, balancing explore/exploit."""

from __future__ import annotations

import random
from dataclasses import dataclass

from memevolution.models.experiment import Experiment


@dataclass
class SelectionResult:
    selected: Experiment
    mode: str  # "exploitation" | "exploration"
    reason: str


def _score(experiment: Experiment) -> float:
    """predicted fitness, discounted a little when confidence is low."""
    prediction = experiment.prediction
    if prediction is None:
        return 0.0
    confidence = prediction.confidence if prediction.confidence is not None else 0.5
    return prediction.fitness * (0.5 + 0.5 * confidence)


def select_candidate(
    candidates: list[Experiment],
    exploration_rate: float = 0.2,
    rng: random.Random | None = None,
) -> SelectionResult:
    """Pick one candidate to actually run.

    With probability `1 - exploration_rate`, exploit: pick the candidate
    with the best fitness/confidence score. Otherwise, explore: sample
    among the remaining candidates weighted toward the least confident
    ones, since an uncertain prediction teaches the agent more when it
    turns out right or wrong. This guarantees the agent does not always
    chase the single highest predicted fitness.
    """
    if not candidates:
        raise ValueError("select_candidate requires at least one candidate")
    rng = rng or random.Random()

    ranked = sorted(candidates, key=_score, reverse=True)
    top = ranked[0]

    if len(ranked) == 1 or rng.random() >= exploration_rate:
        return SelectionResult(
            selected=top,
            mode="exploitation",
            reason=(
                "Highest predicted-fitness/confidence score while maintaining "
                "exploration probability."
            ),
        )

    pool = ranked[1:]
    weights = [
        1.5 - (c.prediction.confidence if c.prediction and c.prediction.confidence is not None else 0.5)
        for c in pool
    ]
    chosen = rng.choices(pool, weights=weights, k=1)[0]
    return SelectionResult(
        selected=chosen,
        mode="exploration",
        reason=(
            "Deliberately testing a lower-certainty candidate to reduce belief "
            "uncertainty, per the agent's exploration rate."
        ),
    )
