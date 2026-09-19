"""Adapter around Role 1's deployed model (model_deployment_package/predictor.py).

STATUS

Gap #1 (feature mismatch) is RESOLVED as of the model retrained with
`absurdity`/`irony`/`relatability`/`trend_relevance` added to its feature
set (confirmed 0.0-1.0 normalized, same scale MemeGenome uses -- no
conversion needed). Predicted fitness now genuinely reacts to the traits
Role 2's evolutionary loop mutates; verified empirically that varying each
of the four traits independently moves the prediction (relatability has
the strongest effect, absurdity/irony/trend_relevance more modest but real).

Gap #2 (scale mismatch) is still open, revised with the new model. The raw
output is NOT a 0-1 fitness score -- empirically, for realistic
genome-derived inputs, it's roughly p5=0.4 / p50=2.3 / p95=3.9 (see
`_RAW_SCORE_LOW`/`_RAW_SCORE_HIGH` below), with a fat tail of extrapolation
outliers (observed as far as -24 to +380) for feature-value combinations
the tree model didn't see much of during training. This adapter (a) always
sends fixed, safe defaults for fields the genome has no signal for, and (b)
linearly rescales the realistic range into [0, 1], clamping outliers at the
edges rather than propagating them -- an empirical guess, not a
calibration Role 1 has confirmed. Revisit once Role 1 documents what the
training target actually represents (raw engagement? log(views)? a
composite score?).
"""

from __future__ import annotations

import sys
from pathlib import Path

_MODEL_PACKAGE_DIR = Path(__file__).resolve().parents[2] / "model_deployment_package"
if str(_MODEL_PACKAGE_DIR) not in sys.path:
    sys.path.insert(0, str(_MODEL_PACKAGE_DIR))

from memevolution.models.genome import MemeGenome
from memevolution.models.prediction import FitnessPrediction

# Empirically observed range of raw model output for realistic
# genome-derived inputs (duration swept 3-60s, audio_strategy toggled,
# absurdity/irony/relatability/trend_relevance swept 0.0-1.0,
# caption_length pinned near the seed genome's value, everything else at
# its safe default). Chosen to roughly bracket p5-p95 with headroom, not
# the full min/max (which include tail extrapolation outliers). See the
# module docstring, gap #2.
_RAW_SCORE_LOW = 0.0
_RAW_SCORE_HIGH = 4.5


def _genome_to_features(genome: MemeGenome) -> dict:
    """Map the fields Role 2 actually has onto Role 1's feature schema.

    absurdity/irony/relatability/trend_relevance map directly -- both sides
    use the same 0.0-1.0 scale. Fields Role 2 has no signal for (ads,
    hashtags, mentions, upload timing) get fixed safe defaults rather than
    being left to the predictor's own fallback -- deliberately, so behavior
    doesn't change if that fallback logic changes, and to stay inside the
    range this adapter was calibrated against.
    """
    return {
        "duration": genome.video_length,
        "is_video": 1,
        "is_ad": 0,
        "caption_length": genome.caption_length,
        "has_hashtags": 0,
        "mentions_count": 0,
        "hashtags_count": 0,
        "is_original_sound": 1 if genome.audio_strategy == "original_sound" else 0,
        "upload_hour": 12,
        "upload_day_of_week": 3,
        "absurdity": genome.absurdity,
        "irony": genome.irony,
        "relatability": genome.relatability,
        "trend_relevance": genome.trend_relevance,
    }


def _rescale(raw_score: float) -> float:
    span = _RAW_SCORE_HIGH - _RAW_SCORE_LOW
    normalized = (raw_score - _RAW_SCORE_LOW) / span
    return min(1.0, max(0.0, normalized))


class Role1FitnessPredictor:
    """Wraps Role 1's deployed XGBoost model behind the FitnessPredictor protocol.

    This is the real historical-data model (unlike MockFitnessPredictor).
    Gap #1 (blind to genome traits) is resolved; gap #2 (output scale is an
    empirical approximation, not a confirmed calibration) is still open --
    see the module docstring.
    """

    def __init__(self) -> None:
        import predictor as _role1_predictor  # Role 1's deployment package

        if _role1_predictor.model is None:
            raise RuntimeError(
                "Role 1's model failed to load. Check that "
                "model_deployment_package/memetic_fitness_xgb.json exists "
                "and that xgboost/pandas are installed."
            )
        self._predictor = _role1_predictor

    def predict_fitness(self, genome: MemeGenome) -> FitnessPrediction:
        features = _genome_to_features(genome)
        raw_score = self._predictor.predict_fitness(features)
        return FitnessPrediction(fitness=round(_rescale(raw_score), 3), confidence=None)
