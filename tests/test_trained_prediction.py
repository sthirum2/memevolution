from datetime import datetime
import json
import math
from pathlib import Path
import random

import pytest

from memevolution.agent.orchestrator import run_generation
from memevolution.llm.gemini import MockConceptGenerator
from memevolution.models.agent import AgentState
from memevolution.persistence import json_store
from memevolution.prediction import trained
from memevolution.prediction.interface import FitnessPredictor
from memevolution.prediction.model import predictor as model

POSTING_TIME = datetime.fromisoformat("2026-09-19T14:00:00-04:00")


def test_exact_features_and_caption(genome_factory):
    features = trained.genome_features(genome_factory(), planned_time=POSTING_TIME,
                                      caption="Hi @alice #college #fyp", is_ad=True)
    assert features == {
        "duration": 10, "is_video": 1, "is_ad": 1, "caption_length": 23,
        "has_hashtags": 1, "mentions_count": 1, "hashtags_count": 2,
        "is_original_sound": 1, "upload_hour": 14, "upload_day_of_week": 5,
        # 0.0-1.0 native, confirmed with the model's author -- not rescaled.
        "absurdity": 0.5, "irony": 0.5, "relatability": 0.5, "trend_relevance": 0.5,
    }
    assert list(features) == model.EXPECTED_FEATURES
    assert list(model.preprocess_features(dict(reversed(list(features.items())))).columns) == model.EXPECTED_FEATURES


def test_documented_defaults_and_audio(genome_factory):
    genome = genome_factory(caption_length=80, audio_strategy="unknown")
    features = trained.genome_features(genome, planned_time=POSTING_TIME)
    for name in ("caption_length", "has_hashtags", "mentions_count", "hashtags_count", "is_original_sound"):
        assert features[name] == model.DEFAULTS[name] == 0
    assert trained.genome_features(genome_factory(audio_strategy="trending_audio"))["is_original_sound"] == 0
    assert model.preprocess_features({}).iloc[0].to_dict() == model.DEFAULTS


def test_real_model_outside_repo(tmp_path, monkeypatch, genome_factory):
    monkeypatch.chdir(tmp_path)
    model.load_model.cache_clear()
    predictor = trained.TrainedFitnessPredictor(planned_time=POSTING_TIME)
    assert isinstance(predictor, FitnessPredictor)
    assert model.load_model().get_booster().feature_names == model.EXPECTED_FEATURES
    features = trained.genome_features(genome_factory(), planned_time=POSTING_TIME)
    score = model.predict_fitness(features)
    assert isinstance(score, float) and math.isfinite(score)
    assert model.predict_fitness(features) == score


def test_missing_model_is_actionable(tmp_path, monkeypatch):
    model.load_model.cache_clear()
    monkeypatch.setattr(model, "MODEL_PATH", tmp_path / "missing.json")
    with pytest.raises(RuntimeError, match="Restore memetic_fitness_model.json"):
        trained.TrainedFitnessPredictor()


@pytest.mark.parametrize("score", [float("nan"), float("inf")])
def test_nonfinite_score_rejected_after_conversion(score, monkeypatch, genome_factory):
    monkeypatch.setattr(trained, "load_model", lambda: None)
    predictor = trained.TrainedFitnessPredictor(planned_time=POSTING_TIME)
    monkeypatch.setattr(trained, "predict_fitness", lambda features: score)
    with pytest.raises(ValueError, match="non-finite"):
        predictor.predict_fitness(genome_factory())


@pytest.mark.parametrize("raw_score, expected", [(-0.1, 0.0), (150.0, 1.0)])
def test_out_of_range_score_is_visible_but_clipped(raw_score, expected, monkeypatch, genome_factory, caplog):
    monkeypatch.setattr(trained, "load_model", lambda: None)
    predictor = trained.TrainedFitnessPredictor(planned_time=POSTING_TIME)
    monkeypatch.setattr(trained, "predict_fitness", lambda features: raw_score)
    prediction = predictor.predict_fitness(genome_factory())
    assert prediction.fitness == expected
    assert "raw_prediction" in caplog.text
    assert "converted_prediction" in caplog.text
    assert "clipping_occurred=True" in caplog.text


@pytest.mark.parametrize(
    "raw_score, expected",
    # Empirical realistic range is ~[0, 4.5] (see trained.py), not [0, 100].
    [(1.1, 1.1 / 4.5), (2.5, 2.5 / 4.5), (0.0, 0.0), (100.0, 1.0)],
)
def test_raw_score_converts_to_normalized_fitness(raw_score, expected, monkeypatch, genome_factory):
    monkeypatch.setattr(trained, "load_model", lambda: None)
    predictor = trained.TrainedFitnessPredictor(planned_time=POSTING_TIME)
    monkeypatch.setattr(trained, "predict_fitness", lambda features: raw_score)
    assert predictor.predict_fitness(genome_factory()).fitness == pytest.approx(expected)


def test_valid_score_wrapper_does_not_invent_confidence(monkeypatch, genome_factory):
    # Unit test only; this is not claimed as a real-model prediction.
    # 1.8 / 4.5 == 0.4, chosen so the expected value stays a clean round number.
    monkeypatch.setattr(trained, "load_model", lambda: None)
    monkeypatch.setattr(trained, "predict_fitness", lambda features: 1.8)
    prediction = trained.TrainedFitnessPredictor().predict_fitness(genome_factory())
    assert prediction.fitness == 0.4
    assert prediction.confidence is None


def test_real_generation_and_persistence(tmp_path, monkeypatch):
    monkeypatch.setattr(json_store, "STATE_PATH", tmp_path / "state.json")
    monkeypatch.setattr(json_store, "EXPERIMENTS_PATH", tmp_path / "experiments.json")
    result = run_generation(
        AgentState(), trained.TrainedFitnessPredictor(planned_time=POSTING_TIME),
        concept_generator=MockConceptGenerator(), population_size=6, rng=random.Random(42),
    )
    assert len(result.candidates) == 6
    assert all(math.isfinite(c.prediction.fitness) and c.prediction.confidence is None for c in result.candidates)
    assert result.selection.selected in result.candidates
    saved = json_store.load_experiments()[0]
    assert saved.prediction == result.selection.selected.prediction
    assert saved.observed.fitness is None and saved.deployment.post_id is None


def test_updated_model_has_four_scaled_traits():
    assert model.EXPECTED_FEATURES[-4:] == ["absurdity", "irony", "relatability", "trend_relevance"]
    features = dict(model.DEFAULTS, absurdity=5.0, irony=5.0, relatability=5.0, trend_relevance=5.0)
    score = model.predict_fitness(features)
    assert math.isfinite(score)
