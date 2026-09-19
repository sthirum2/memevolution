"""Person 1's feature order, defaults, coercion and rounding, with portable loading."""
from functools import lru_cache
from pathlib import Path

import pandas as pd
from xgboost import XGBRegressor

EXPECTED_FEATURES = [
    'duration', 'is_video', 'is_ad', 'caption_length',
    'has_hashtags', 'mentions_count', 'hashtags_count',
    'is_original_sound', 'upload_hour', 'upload_day_of_week',
    'absurdity', 'irony', 'relatability', 'trend_relevance'
]

DEFAULTS = {
    'duration': 15,
    'is_video': 1,
    'is_ad': 0,
    'caption_length': 0,
    'has_hashtags': 0,
    'mentions_count': 0,
    'hashtags_count': 0,
    'is_original_sound': 0,
    'upload_hour': 12,
    'upload_day_of_week': 3,
    'absurdity': 0,
    'irony': 0,
    'relatability': 0,
    'trend_relevance': 0,
}

MODEL_PATH = Path(__file__).resolve().parent / 'memetic_fitness_model.json'


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.is_file():
        raise RuntimeError(
            f"Trained model not found at {MODEL_PATH}. Restore memetic_fitness_model.json "
            "from this agent package or re-export Person 1's artifact with tools/export_model.py."
        )
    try:
        model = XGBRegressor()
        model.load_model(MODEL_PATH)
        return model
    except Exception as exc:
        raise RuntimeError(
            f"Cannot load trained model at {MODEL_PATH}. Install the agent's model dependencies "
            "(including xgboost==3.4.1 and scikit-learn) and verify the deployment artifact."
        ) from exc


def preprocess_features(features: dict) -> pd.DataFrame:
    processed = {**DEFAULTS, **features}
    df = pd.DataFrame([processed], columns=EXPECTED_FEATURES)
    for col in EXPECTED_FEATURES:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    return df


def predict_fitness(features: dict) -> float:
    prediction = load_model().predict(preprocess_features(features))[0]
    return float(round(prediction, 4))
