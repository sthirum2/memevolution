"""One-time supported export using a runtime that can load Person 1's joblib."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

import joblib
import pandas as pd
import xgboost

parser = argparse.ArgumentParser()
parser.add_argument('--package', type=Path, required=True)
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args()
with zipfile.ZipFile(args.package) as package:
    artifact = package.read('memetic_fitness_model.joblib')
    predictor_source = package.read('predictor.py').decode('utf-8')
model = joblib.load(io.BytesIO(artifact))
# Run Person 1's original preprocessing/prediction, adjusting only the file lookup.
namespace = {'io': io, 'artifact': artifact}
exec(predictor_source.replace("joblib.load('memetic_fitness_model.joblib')",
                              'joblib.load(io.BytesIO(artifact))'), namespace)
cases = []
for duration in (6, 10, 15, 30):
    for sound in (0, 1):
        for hour in (0, 14, 23):
            features = dict(duration=duration, is_video=1, is_ad=0, caption_length=0,
                            has_hashtags=0, mentions_count=0, hashtags_count=0,
                            is_original_sound=sound, upload_hour=hour, upload_day_of_week=5)
            cases.append({'features': features, 'fitness': namespace['predict_fitness'](features)})
for features in ({}, dict(duration=15, caption_length=23, has_hashtags=1,
                          hashtags_count=2, mentions_count=1, is_ad=1)):
    cases.append({'features': features, 'fitness': namespace['predict_fitness'](features)})
args.output_dir.mkdir(parents=True, exist_ok=True)
model.save_model(args.output_dir / 'memetic_fitness_model.json')
reference = {
    'source_joblib_sha256': hashlib.sha256(artifact).hexdigest(),
    'export_xgboost_version': xgboost.__version__,
    'source': "Person 1 ZIP predictor run in Linux, not an independent Colab reference",
    'cases': cases,
}
(args.output_dir / 'model_reference.json').write_text(json.dumps(reference, indent=2), encoding='utf-8')
print('Exported original trained model with XGBoost', xgboost.__version__)
print('Reference cases:', len(cases))
print('Example:', cases[10])
