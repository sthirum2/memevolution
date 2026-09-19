import pytest

import predictor


def test_model_loads():
    assert predictor.model is not None


def test_preprocess_features_fills_all_defaults_when_empty():
    df = predictor.preprocess_features({})
    assert list(df.columns) == predictor.EXPECTED_FEATURES
    assert df.loc[0, "duration"] == 15
    assert df.loc[0, "is_video"] == 1
    assert df.loc[0, "upload_hour"] == 12
    assert df.loc[0, "upload_day_of_week"] == 3


def test_preprocess_features_overrides_are_respected():
    df = predictor.preprocess_features({"duration": 30, "caption_length": 120})
    assert df.loc[0, "duration"] == 30
    assert df.loc[0, "caption_length"] == 120
    # untouched fields still fall back to their defaults
    assert df.loc[0, "is_video"] == 1
    assert df.loc[0, "upload_hour"] == 12


def test_preprocess_features_ignores_unexpected_keys():
    df = predictor.preprocess_features({"not_a_real_feature": 999})
    assert list(df.columns) == predictor.EXPECTED_FEATURES
    assert "not_a_real_feature" not in df.columns


def test_preprocess_features_coerces_non_numeric_to_zero():
    df = predictor.preprocess_features({"duration": "not-a-number"})
    assert df.loc[0, "duration"] == 0


def test_predict_fitness_returns_a_float():
    result = predictor.predict_fitness({})
    assert isinstance(result, float)


def test_predict_fitness_uses_defaults_when_no_features_given():
    default_call = predictor.predict_fitness({})
    explicit_defaults = predictor.predict_fitness(
        {
            "duration": 15,
            "is_video": 1,
            "is_ad": 0,
            "caption_length": 0,
            "has_hashtags": 0,
            "mentions_count": 0,
            "hashtags_count": 0,
            "is_original_sound": 0,
            "upload_hour": 12,
            "upload_day_of_week": 3,
        }
    )
    assert default_call == explicit_defaults


def test_predict_fitness_responds_to_feature_changes():
    low = predictor.predict_fitness({"duration": 5, "caption_length": 0, "has_hashtags": 0})
    high = predictor.predict_fitness(
        {"duration": 30, "caption_length": 150, "has_hashtags": 1, "hashtags_count": 5}
    )
    assert low != high


def test_predict_fitness_raises_when_model_not_loaded(monkeypatch):
    monkeypatch.setattr(predictor, "model", None)
    with pytest.raises(RuntimeError):
        predictor.predict_fitness({})
