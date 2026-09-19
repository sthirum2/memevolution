"""
The spread score, in Python.

MUST STAY IN SYNC with frontend/src/lib/score.ts. That file is the reference
implementation and the frontend's hover tooltip explains this exact sum to the
user, so if the two drift the UI starts lying about the number it is showing.
tests/test_fitness_parity.py reads the TypeScript and fails if the constants
diverge, so a drift breaks the build rather than the demo.

Why this file exists: nothing else computed fitness. The agent expects
Observation.fitness to be handed to it, and the API stored whatever it was
given. Real engagement numbers arriving from a platform therefore produced no
fitness at all, prediction error stayed undefined, and the agent could not
learn from a real post. This closes that gap.

The idea: score a meme on how often people *pass it on*, not how many see it.
Every ingredient is a per-viewer rate, so a small account that gets re-sent
beats a big one that merely gets seen. Each rate is capped, so clearing the cap
earns full marks and no more.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# (key, weight, cap) — the rate at which the ingredient earns full marks.
SCORE_PARTS: list[tuple[str, float, float]] = [
    ("shares", 0.34, 0.05),
    ("saves", 0.24, 0.03),
    ("comments", 0.18, 0.015),
    ("likes", 0.14, 0.16),
]

# Reach is the only ingredient that is not a rate, and it is deliberately small.
REACH_WEIGHT = 0.10
REACH_LOG_CAP = 5.2


@dataclass(frozen=True)
class Ingredient:
    label: str
    rate: float
    points: float
    max_points: float


def spread_score(
    views: int | None,
    likes: int | None = 0,
    comments: int | None = 0,
    shares: int | None = 0,
    saves: int | None = 0,
) -> float | None:
    """0.0–1.0, or None when there is nothing to score."""
    if not views or views <= 0:
        return None

    counts = {
        "shares": shares or 0,
        "saves": saves or 0,
        "comments": comments or 0,
        "likes": likes or 0,
    }
    total = sum(
        weight * min(1.0, counts[key] / views / cap) for key, weight, cap in SCORE_PARTS
    )
    total += REACH_WEIGHT * min(1.0, math.log10(views) / REACH_LOG_CAP)
    return round(max(0.0, min(1.0, total)), 2)


def breakdown(
    views: int,
    likes: int = 0,
    comments: int = 0,
    shares: int = 0,
    saves: int = 0,
) -> list[Ingredient]:
    """The same sum, itemised — useful for explaining a score in a log or an API."""
    counts = {"shares": shares, "saves": saves, "comments": comments, "likes": likes}
    rows = []
    for key, weight, cap in SCORE_PARTS:
        rate = counts[key] / views if views else 0.0
        filled = min(1.0, rate / cap)
        rows.append(Ingredient(key, rate, weight * filled * 100, weight * 100))
    filled = min(1.0, math.log10(max(1, views)) / REACH_LOG_CAP)
    rows.append(Ingredient("reach", float(views), REACH_WEIGHT * filled * 100, REACH_WEIGHT * 100))
    return rows
