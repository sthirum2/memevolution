# Person 1 trained fitness integration

**Blocked on the model's target scale.** The supplied artifact returns values above
1 (seed-style input: 2.4504001140594482; 26 reference cases range from 1.1788 to 3.4569).
The existing agent and backend require fitness in [0, 1]. The package provides no
normalizer or target definition; the serialized model contains no normalization metadata.
The adapter therefore raises a clear error before selection/persistence/HTTP rather
than silently clipping or inventing a transformation. Real generation and bridge
acceptance tests remain failing until Person 1 supplies the intended conversion or
a model trained on the existing normalized target. The commands below reproduce
this blocker; they are not a claim that Gen 1 is ready.

`run_generation` still calls `predictor.predict_fitness(candidate.genome)` before
selection and concept generation. `TrainedFitnessPredictor` implements that existing
interface and returns `FitnessPrediction(fitness=score, confidence=None)`.
Mutation, population generation, selection, learning and the backend API are unchanged.
Selection already handles missing confidence internally; no confidence estimate is
created or sent to the backend.

## Feature mapping

Order is exactly the order below, including in the model's pandas DataFrame.

| Model feature | Source |
| --- | --- |
| duration | `genome.video_length` |
| is_video | 1 (TikTok video) |
| is_ad | Person 1 default 0; explicit adapter `is_ad=True` supported |
| caption_length | Actual optional `caption` length; otherwise Person 1 default 0 |
| has_hashtags | Actual caption contains a hashtag token; otherwise default 0 |
| mentions_count | Number of @mention tokens; otherwise default 0 |
| hashtags_count | Number of #hashtag tokens; otherwise default 0 |
| is_original_sound | 1 for `original_sound`, 0 for `trending_audio`; unknown uses Person 1 default 0 |
| upload_hour | Planned posting time hour, otherwise current local hour |
| upload_day_of_week | Same posting time's weekday, Monday=0 |

The predictor captures one posting time for all candidates in a generation.
Use `--planned-time` with an ISO offset to make the intended posting timezone explicit
and allow repeatable scoring. Without it, the machine's current local timezone is used.
Person 1's noon/Thursday defaults remain in raw preprocessing, but the agent supplies
actual/planned time. Their duration=15 default is likewise replaced by video_length.

Actual captions are unavailable at scoring: `MemeConcept.caption` is generated only
after selection. The genome's `caption_length` is a target, not measured caption text,
so it is not substituted for an actual caption. The optional adapter caption argument
supports future callers without moving concept generation or modifying evolution.
No explicit ad or scheduled-post field is present in the current genome.

## Model and failure behavior

There is one runtime artifact at
`memevolution/prediction/model/memetic_fitness_model.json`, exported from Person 1's
unchanged joblib with XGBoost 3.4.1 in Linux. The supplied joblib fails on Windows
with `XGBoostError: input stream corrupted`, even with the exact supplied version.
Linux successfully loads it. The conversion uses XGBoost's `save_model` API; it does
not retrain, edit trees or rescale predictions. The original ZIP remains unchanged.
See [XGBoost model portability](https://xgboost.readthedocs.io/en/stable/tutorials/saving_model.html)
and the [reported Windows pickle issue](https://github.com/dmlc/xgboost/issues/12459).
Loading resolves relative to the predictor module, is cached, and works from any CWD.
The package includes the artifact when built as a wheel. Person 1's defaults, feature
order, numeric coercion and four-decimal rounding are preserved.

Missing/corrupt models raise actionable errors. Nonfinite or out-of-range results
fail clearly: scores are never clipped, rescaled, randomized or silently replaced.
CLI generation uses the trained predictor by default. The old development mock is
available only through explicit `--predictor mock` and is labeled as a stub.

Runtime dependencies: xgboost==3.4.1 (Person 1's version), pandas and scikit-learn
(needed for XGBRegressor). Joblib is used by the one-time export tool and is also
a scikit-learn dependency. NumPy/SciPy are transitive dependencies; no notebooks/Colab
packages were added. The export environment used the same-version CPU-only Linux build.

To reproduce the export in a Linux environment with those dependencies:

```bash
python tools/export_model.py --package /path/to/model_deployment_package.zip --output-dir /tmp/model-export
```

This writes the portable model plus `model_reference.json`: 26 fixed feature inputs
and predictions obtained from Person 1's original predictor in Linux. The fixture
records the source artifact SHA256. Runtime loading does not need Linux or the ZIP.

## PowerShell commands

Using the backend's existing virtual environment, from this agent repository:

```powershell
$python = 'C:\Users\srith\memevolution\.venv\Scripts\python.exe'
& $python -m pip install -e '.[dev]'
& $python -m pytest -q
& $python -m memevolution generate --population-size 6 --seed 42 --planned-time '2026-09-19T14:00:00-04:00'
```

The existing CLI uses Gemini if configured, otherwise its labeled mock concept
generator. Fitness always uses the selected predictor. Local generation persists
agent state under `data/` in the current directory; it does not deploy or record engagement.

To generate and serialize the exact backend payloads without sending HTTP or calling
Gemini, run the backend bridge from a fresh directory (to keep smoke state separate):

```powershell
$python = 'C:\Users\srith\memevolution\.venv\Scripts\python.exe'
$smokeDir = Join-Path $env:TEMP ('memevolution-model-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $smokeDir | Out-Null
Push-Location $smokeDir
& $python C:\Users\srith\memevolution\backend\integration\run_generation.py --agent-repo C:\Users\srith\memevolution_agent_tmp --population-size 6 --seed 42 --planned-time '2026-09-19T14:00:00-04:00' --dry-run
Pop-Location
```

Omit `--dry-run` and provide `--backend-url http://127.0.0.1:8000` to store the selected
experiment and prediction in a running backend. The bridge retains its existing mock
concept generator, clearly labeled. It never posts to TikTok or submits observations.
`agent_backend.py` remains unchanged and sends only fitness and model_version.

From the backend repository, verify bridge serialization against the API schemas:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\integration\tests -q
```

Set `MEMEVOLUTION_AGENT_REPO` if this checkout is not at the default sibling path.

## Limits

No example expected score or Colab reference was provided, so numeric equivalence
with Person 1's Colab environment cannot be independently established. Windows
regression tests compare the JSON export against all 26 original-predictor Linux
results at Person 1's four-decimal rounding. These fixtures verify conversion fidelity;
they are not independent evidence of model accuracy. Tests also exercise fixed posting
time, feature order, candidate generation, selection, persistence and backend serialization.

The trained schema cannot see topic, humor, format, hook, absurdity, irony,
relatability or trend relevance. Mutations only in those traits produce identical
model inputs; do not interpret tied scores as evidence that the traits do not matter.
Actual caption and posting-time differences can change later estimates. Current
defaults make this a pre-content prediction, not an observed engagement claim.
