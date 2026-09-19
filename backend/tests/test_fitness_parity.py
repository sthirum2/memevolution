"""
The spread score is defined twice — once in TypeScript for the UI, once in
Python for the API and the agent. This fails the build if they drift.

Reads the constants straight out of the TypeScript rather than restating them,
so there is nothing to keep in sync by hand.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.fitness import REACH_LOG_CAP, REACH_WEIGHT, SCORE_PARTS, spread_score

ROOT = Path(__file__).resolve().parents[2]
TS = ROOT / "frontend" / "src" / "lib" / "score.ts"
DATA = ROOT / "frontend" / "src" / "data" / "experiments.json"


@pytest.mark.skipif(not TS.exists(), reason="frontend not checked out on this branch")
def test_weights_match_the_typescript():
    src = TS.read_text()
    found = {
        m.group(1): (float(m.group(2)), float(m.group(3)))
        for m in re.finditer(
            r"\{\s*key:\s*'(\w+)',\s*label:\s*'[^']*',\s*weight:\s*([\d.]+),\s*cap:\s*([\d.]+)",
            src,
        )
    }
    assert found, "could not parse SCORE_PARTS out of score.ts"

    for key, weight, cap in SCORE_PARTS:
        assert key in found, f"{key} missing from score.ts"
        assert found[key] == (weight, cap), (
            f"{key}: python has {(weight, cap)}, score.ts has {found[key]}"
        )

    reach = re.search(r"REACH\s*=\s*\{[^}]*weight:\s*([\d.]+)[^}]*logCap:\s*([\d.]+)", src)
    assert reach, "could not parse REACH out of score.ts"
    assert float(reach.group(1)) == REACH_WEIGHT
    assert float(reach.group(2)) == REACH_LOG_CAP


@pytest.mark.skipif(not DATA.exists(), reason="frontend not checked out on this branch")
def test_reproduces_every_score_in_the_demo_data():
    for exp in json.loads(DATA.read_text()):
        o = exp["observed"]
        if o["fitness"] is None:
            continue
        got = spread_score(o["views"], o["likes"], o["comments"], o["shares"], o["saves"])
        assert got == pytest.approx(o["fitness"], abs=0.011), (
            f"{exp['id']}: stored {o['fitness']}, python computed {got}"
        )


def test_no_views_scores_nothing():
    assert spread_score(0, 1, 1, 1, 1) is None
    assert spread_score(None) is None


def test_propagation_beats_reach():
    """A small account that gets passed on should beat a big one that does not."""
    small_but_shared = spread_score(views=1_000, likes=120, comments=15, shares=50, saves=30)
    big_but_ignored = spread_score(views=500_000, likes=6_000, comments=200, shares=300, saves=150)
    assert small_but_shared > big_but_ignored
