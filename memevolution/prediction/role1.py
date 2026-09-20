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
maps that realistic range into [0, 1] via memevolution.prediction.scale --
an empirical guess, not a
calibration Role 1 has confirmed. Revisit once Role 1 documents what the
training target actually represents (raw engagement? log(views)? a
composite score?).

That mapping used to hard-clip outside the band, which silently broke
selection: once a lineage drifts above the band every candidate reports
fitness 1.000, so the agent ranks genuinely different predictions as a tie
and picks its "best" by coin flip. scale.raw_to_fitness is strictly
monotonic instead, so ranking always holds. See scale.py.
"""

from __future__ import annotations

import sys
from pathlib import Path

_MODEL_PACKAGE_DIR = Path(__file__).resolve().parents[2] / "model_deployment_package"
if str(_MODEL_PACKAGE_DIR) not in sys.path:
    sys.path.insert(0, str(_MODEL_PACKAGE_DIR))

from memevolution.models.genome import MemeGenome
from memevolution.models.prediction import FitnessPrediction
from memevolution.prediction.scale import RAW_SCORE_HIGH, RAW_SCORE_LOW, raw_to_fitness

# Kept as module-level names because callers and tests refer to them; the
# band itself and the mapping now live in scale.py, shared with trained.py.
_RAW_SCORE_LOW = RAW_SCORE_LOW
_RAW_SCORE_HIGH = RAW_SCORE_HIGH


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
    """Role 1's band, mapped onto [0, 1] without ever tying two raw scores."""
    return raw_to_fitness(raw_score)


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
        # 4 dp, not 3: above Role 1's band the mapping is deliberately
        # compressed (see scale.py), so a third decimal would re-introduce the
        # ranking ties the compression exists to remove. The UI rounds for
        # display anyway.
        return FitnessPrediction(fitness=round(_rescale(raw_score), 4), confidence=None)
