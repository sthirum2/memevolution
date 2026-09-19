from pathlib import Path

import pandas as pd
import xgboost as xgb

# The exact feature names and order the model expects
EXPECTED_FEATURES = [
    'duration', 'is_video', 'is_ad', 'caption_length',
    'has_hashtags', 'mentions_count', 'hashtags_count',
    'is_original_sound', 'upload_hour', 'upload_day_of_week',
    'absurdity', 'irony', 'relatability', 'trend_relevance'
]

MODEL_PATH = Path(__file__).resolve().parent / 'memetic_fitness_xgb.json'

# Load the model once when the module is imported. Resolved relative to this
# file (not the process's cwd) so importing this module works the same way
# regardless of where it's run from. save_model()/load_model() is XGBoost's
# own portable format -- unlike a joblib-pickled sklearn wrapper, it isn't
# tied to matching pickle/ctypes internals between the training and
# deployment environments.
try:
    model = xgb.Booster()
    model.load_model(str(MODEL_PATH))
except Exception as exc:
    model = None
    print(f"Warning: Failed to load model from '{MODEL_PATH}': {exc}")

def preprocess_features(features: dict) -> pd.DataFrame:
    """
    Validates and preprocesses the input features.
    Fills missing features with sensible default values.
    """
    # Default values for missing features (e.g., if a user doesn't provide them)
    defaults = {
        'duration': 15,           # 15 seconds average
        'is_video': 1,            # Assume it's a video
        'is_ad': 0,               # Not an ad
        'caption_length': 0,      # No caption
        'has_hashtags': 0,        # No hashtags
        'mentions_count': 0,      # No mentions
        'hashtags_count': 0,      # 0 hashtags
        'is_original_sound': 0,   # Not original sound
        'upload_hour': 12,        # Noon
        'upload_day_of_week': 3,  # Thursday
        'absurdity': 0.5,         # Neutral (traits are 0.0-1.0 normalized)
        'irony': 0.5,
        'relatability': 0.5,
        'trend_relevance': 0.5
    }

    # Merge defaults with provided features
    processed = {**defaults, **features}

    # Create DataFrame with exact column order
    df = pd.DataFrame([processed], columns=EXPECTED_FEATURES)

    # Ensure numeric types
    for col in EXPECTED_FEATURES:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    return df

def predict_fitness(features: dict) -> float:
    """
    Predicts the memetic fitness score for a given set of features.
    Returns a float representing the score.
    """
    if model is None:
        raise RuntimeError("Model not loaded. Cannot make predictions.")

    input_df = preprocess_features(features)
    dmatrix = xgb.DMatrix(input_df)
    prediction = model.predict(dmatrix)[0]

    return float(round(prediction, 4))
