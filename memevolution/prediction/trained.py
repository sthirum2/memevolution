"""Thin genome adapter for Person 1's trained predictor; no evolutionary logic."""
from datetime import datetime
import logging
import math
import re

from memevolution.models.genome import MemeGenome
from memevolution.models.prediction import FitnessPrediction
from memevolution.prediction.model.predictor import DEFAULTS, EXPECTED_FEATURES, load_model, predict_fitness

MODEL_VERSION = "memetic-fitness-xgb-3.4.1"
logger = logging.getLogger(__name__)


def genome_features(
    genome: MemeGenome, *, caption: str | None = None,
    planned_time: datetime | None = None, is_ad: bool = False,
) -> dict[str, int]:
    """Absent captions use Person 1's defaults, not the genome's target length.

    Posting time uses the supplied wall-clock timezone, or current local time.
    weekday() uses Monday=0, consistent with Person 1's Thursday=3 default.
    """
    features = dict(DEFAULTS)
    posting_time = planned_time if planned_time is not None else datetime.now().astimezone()
    features.update(
        duration=genome.video_length, is_video=1, is_ad=int(is_ad),
        upload_hour=posting_time.hour, upload_day_of_week=posting_time.weekday(),
        absurdity=genome.absurdity * 10,
        irony=genome.irony * 10,
        relatability=genome.relatability * 10,
        trend_relevance=genome.trend_relevance * 10,
    )
    if genome.audio_strategy in {"original_sound", "trending_audio"}:
        features["is_original_sound"] = int(genome.audio_strategy == "original_sound")
    if caption is not None:
        hashtags = re.findall(r"(?<!\w)#\w+", caption)
        mentions = re.findall(r"(?<!\w)@[\w.]+", caption)
        features.update(caption_length=len(caption), has_hashtags=int(bool(hashtags)),
                        mentions_count=len(mentions), hashtags_count=len(hashtags))
    return {name: features[name] for name in EXPECTED_FEATURES}


class TrainedFitnessPredictor:
    """Implements the existing FitnessPredictor protocol; confidence stays None."""

    def __init__(self, *, planned_time: datetime | None = None) -> None:
        # One shared timestamp ensures comparisons within a generation are fair.
        self.planned_time = planned_time if planned_time is not None else datetime.now().astimezone()
        load_model()  # Fail before generation if the model cannot be loaded.

    def predict_fitness(
        self, genome: MemeGenome, *, caption: str | None = None,
        planned_time: datetime | None = None, is_ad: bool = False,
    ) -> FitnessPrediction:
        features = genome_features(genome, caption=caption,
                                   planned_time=planned_time if planned_time is not None else self.planned_time,
                                   is_ad=is_ad)
        raw_score = predict_fitness(features)
        converted_score = raw_score / 100.0
        if not math.isfinite(converted_score):
            raise ValueError(
                f"Trained model returned non-finite raw prediction {raw_score!r} "
                f"after conversion to {converted_score!r}."
            )
        clipped_low = converted_score < 0
        clipped_high = converted_score > 1
        clipping_occurred = clipped_low or clipped_high
        logger.warning(
            "trained prediction raw_prediction=%r converted_prediction=%r "
            "clipping_occurred=%s clipped_low=%s clipped_high=%s",
            raw_score, converted_score, clipping_occurred, clipped_low, clipped_high,
        ) if clipping_occurred else logger.info(
            "trained prediction raw_prediction=%r converted_prediction=%r "
            "clipping_occurred=False",
            raw_score, converted_score,
        )
        return FitnessPrediction(fitness=max(0.0, min(1.0, converted_score)))
