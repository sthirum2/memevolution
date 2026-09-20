"""Shared raw-score -> fitness mapping for the trained XGBoost predictor.

Both adapters around Role 1's model (`role1.py`, used by the API, and
`trained.py`, used by the CLI) need the same conversion, so it lives here
once rather than being duplicated with two chances to drift.

WHY THIS IS NOT A PLAIN CLIP

The model's raw output is not a 0-1 fitness score: for realistic
genome-derived inputs it runs roughly p5=0.4 / p50=2.3 / p95=4.6, with a fat
extrapolation tail (observed from -22 to +380) for feature combinations the
trees did not see in training. Both adapters used to rescale that band
linearly and hard-clip everything outside it.

The clip is what broke selection. An evolutionary lineage that drifts into
the high end sits *above* the band, and then every candidate clips to exactly
1.000 -- distinct predictions collapse into a tie. Observed live on the
`college/pov` lineage: raw 4.57, 4.79 and 4.94 are three genuinely different
predictions that all reported fitness 1.000, leaving the agent to pick its
"best" candidate by coin flip.

So the band still maps linearly -- that part is Role 1's calibration and is
left alone -- but it lands in [0, CORE_TOP] instead of [0, 1], and the
headroom above CORE_TOP holds an exponential tail. Outliers saturate toward
1.0 instead of propagating a raw 380 into the UI.

The mapping is strictly increasing on (0, ~82), i.e. from just above the
floor to roughly eighteen times the band ceiling, so any two raw scores the
model realistically produces report different fitness and ranking is always
well defined. Past ~82 the exponential is closer to 1.0 than float64 can
represent and values do tie at 1.0 -- that is far outside anything the model
emits for a real genome, and is the same saturation the old clip had.

The low side keeps the hard floor at 0.0. Below-zero raw scores are pure
extrapolation garbage rather than a lineage the agent is likely to converge
into, and tying them at 0.0 is the existing, documented behaviour.

Scale calibration is still an empirical approximation, not something Role 1
has confirmed -- see the `gap #2` note in role1.py.
"""

from __future__ import annotations

import math

# Role 1's calibrated band. Unchanged: this is the range the linear part of
# the mapping was fitted against.
RAW_SCORE_LOW = 0.0
RAW_SCORE_HIGH = 4.5

# The band occupies [0, CORE_TOP]; (CORE_TOP, 1) is reserved for the tail, so
# scores above the band stay distinguishable instead of clipping to a tie.
CORE_TOP = 0.95

# How fast the tail saturates, in band-widths. At 2.0 a raw score one full
# band above the ceiling reports ~0.993 -- clearly "off the top of the scale"
# without ever quite reaching 1.0.
TAIL_DECAY = 2.0


def raw_to_fitness(raw_score: float) -> float:
    """Map a raw model score onto [0, 1], strictly monotonically.

    Distinct raw scores always produce distinct fitness values (above 0), so
    ranking a generation's candidates is always well defined.
    """
    if not math.isfinite(raw_score):
        raise ValueError(f"Model returned a non-finite raw prediction: {raw_score!r}")

    span = RAW_SCORE_HIGH - RAW_SCORE_LOW
    t = (raw_score - RAW_SCORE_LOW) / span

    if t <= 0.0:
        # Extrapolation garbage below the band; floor it, as before.
        return 0.0
    if t <= 1.0:
        # Inside Role 1's calibrated band: linear, just scaled to leave headroom.
        return CORE_TOP * t
    # Above the band: saturate toward 1.0 without ever tying.
    return CORE_TOP + (1.0 - CORE_TOP) * (1.0 - math.exp(-TAIL_DECAY * (t - 1.0)))
