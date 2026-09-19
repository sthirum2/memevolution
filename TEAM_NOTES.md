# Where everything is

Notes for the team, written while wiring the frontend up. If something below is out of
date, trust the code.

## Branches

| Branch | What's on it | Owner |
| --- | --- | --- |
| `main` | the merge target | everyone |
| `frontend` | React app in `frontend/` | frontend |
| `backend` | FastAPI + database in `backend/` | backend |
| `integration` | `frontend` + `backend` merged, plus scripts to run both together | — |

Everything lives in a **subfolder named after the role**, so the branches merge without
touching each other's files. Keep it that way when the agent and model land — put them in
`agent/` and `model/`.

`integration` is not special and nobody has to use it. It is just `frontend` + `backend`
merged with a couple of run scripts on top, so you can see the whole thing working in one
checkout. Merge it into `main` when you want, or ignore it and merge the role branches
yourself — nothing depends on it.

## Running it

From `integration` (or from `main` once both roles are merged in):

```bash
./setup.sh          # once: venv, agent, prediction model, frontend deps
./dev.sh --seed     # both services, and demo data in an empty database
./test.sh           # every test, one command
```

`setup.sh` ends by checking that the agent imports, the prediction model
constructs and scoring works, and names whichever one failed. If it says the
prediction model is unavailable, the agent falls back to a stub predictor and
the numbers stop meaning anything — fix that before demoing.

Frontend http://localhost:5173 · backend http://127.0.0.1:8000 (`/docs` for the API).

From the `frontend` branch alone, no backend needed:

```bash
cd frontend && npm install && npm run dev
```

## The one switch that matters

`frontend/.env`:

```bash
VITE_USE_MOCK=true    # demo data inside the frontend. Every screen works.
VITE_USE_MOCK=false   # talk to the real backend.
```

`VITE_USE_MOCK=false` is now the default and it is fully wired: the browser drives the real
agent, the real XGBoost predictor scores the candidates, Gemini writes and draws the meme,
and a real result feeds back into the agent's beliefs. Run `./dev.sh` and it works.

`VITE_USE_MOCK=true` is the fallback for presenting somewhere you do not trust the machine
or the network — every screen works with no backend at all. Vite only reads `.env` at
startup, so restart after changing it.

## The loop, end to end

All three screens work against the live backend. Pressing **Create 5 memes** in the browser
runs a real evolutionary step in the API process:

```
browser  POST /generation
  -> agent mutates the surviving genome into 5 candidates
  -> the real XGBoost model scores each one
  -> explore/exploit picks one
  -> Gemini writes its concept
browser  shows all five, you approve one
browser  POST /experiments/{id}/publish   -> Gemini draws it, it goes to the platform
browser  POST /evolve                     -> beliefs move on the prediction error
```

Verified through the browser against the real stack: predicted 0.695, observed 0.67,
beliefs shifted. No mocks anywhere in that path.

Two things are still approximations rather than gaps:

- **`confidence` is not returned with a prediction.** The agent's predictor gives a fitness
  but no confidence, so the UI says "Confidence not available" rather than inventing one.
- **`feature_attribution` is empty** for live predictions, so the "what drove this" chart is
  blank against the real backend. It has data on demo data.

## Posting for real

Verified, because this is easy to get wrong:

- **Instagram works outright.** Publishing to *your own* account from a Meta app in
  **Development mode** needs **no App Review** — add your own account as an Instagram Tester
  and it works. Real public posts, real engagement, no human step.
- **TikTok works with one tap.** Use the **inbox upload** route (`video.upload` scope): the
  app drops the video into the creator's TikTok drafts and they tap Post in the app. Because
  a human published it, there is **no visibility restriction and no audit**.
- **Do not use TikTok's Direct Post** (`video.publish`). It looks like the obvious choice,
  but an unaudited client has every post forced to `SELF_ONLY` no matter what privacy level
  you send — invisible, so nothing to measure. Audit takes days.

The frontend already handles both shapes. `PublishResult.status` is `live` for Instagram
(shows the permalink) or `awaiting_user` for TikTok (shows the "open Drafts and tap Post"
steps). It needs two backend endpoints — `POST /experiments/{id}/publish` and
`GET /experiments/{id}/live-metrics` — plus the account setup. The exact API call sequences
for both platforms, and the setup steps, are in `frontend/README.md`.

**Gotchas that will cost you an hour each:**

- `media_url` must be a **publicly reachable URL**. Meta's servers fetch the image
  themselves, so `localhost` fails. Host the rendered memes somewhere public first.
- The Instagram token stays **server side only**. Anything named `VITE_*` is compiled into
  the browser bundle. Put it in `backend/.env`, never `frontend/.env`.
- The account must be Instagram **Business or Creator**, linked to a Facebook Page.
- For TikTok use `FILE_UPLOAD`, not `PULL_FROM_URL` — the pull route needs domain-ownership
  verification, which is another approval you do not need.

## Getting a real result back into the agent

`scripts/observe.py` is the bridge. Real numbers in, agent updated:

```bash
# numbers you read off the post
python3 scripts/observe.py exp_014 --views 4210 --likes 388 \
    --comments 24 --shares 96 --saves 61

# or pull them from Instagram
python3 scripts/observe.py exp_014 --from-instagram <media_id>

# --dry-run to see the score without recording anything
```

It computes the spread score, POSTs to `/experiments/{id}/metrics`, and calls the agent's
`apply_observation` so beliefs actually move. If the agent package is not installed in the
same environment it prints the exact command to run on that side instead.

**This existed because nothing computed fitness.** The agent expects
`Observation.fitness` to be handed to it and the API stored whatever it was given, so real
engagement arriving produced `fitness=None`, prediction error stayed undefined, and the
agent could not learn from a real post. `backend/app/fitness.py` is now the Python
definition, the API computes it when the caller does not supply one, and
`backend/tests/test_fitness_parity.py` reads the constants out of `score.ts` and fails if
the two implementations drift.

## Running the agent loop (verified end to end)

The agent lives in its own repo. Installed alongside this one, the whole loop runs:

```bash
pip install -e /path/to/memevolution_agent
pip install pandas xgboost scikit-learn
brew install libomp          # xgboost will not import on macOS without it

export PYTHONPATH=/path/to/memevolution-frontend/backend
python -m memevolution generate            # 5 candidates, real XGBoost predictions
python -m memevolution observe <id> --views 8400 --likes 760 \
    --comments 52 --shares 210 --saves 130 --fitness 0.52
python -m memevolution status              # beliefs have moved
```

**`--fitness` is required** — the agent cannot derive it, which is why
`backend/app/fitness.py` exists. Get the number from `scripts/observe.py`, which computes
it and prints the exact `memevolution observe` command to run.

Verified: predicted 0.91 → actual 0.52 → error −0.39 → absurdity moved 0.50 → 0.44, and it
moved the trait that had actually been mutated. Explore/exploit works too; one run picked a
0.69 candidate over a 1.00 one.

`brew install libomp` is not optional on macOS. Without it xgboost fails to import with a
`libxgboost.dylib could not be loaded` error that does not mention OpenMP in the first line.

### Open question for Role 1 (measured, not guessed)

Sampling 400 random genomes through the real XGBoost model after the current empirical
rescale:

```
  p5 0.155   p25 0.371   p50 0.507   p75 0.617   p95 0.826
  mean 0.494   stdev 0.200
  saturated at 1.000 : 2.2%
  saturated at 0.000 : 1.8%
```

Centred sensibly, but **4% of predictions clip at the bounds**, so the assumed input window
is slightly too narrow at both ends. A clipped prediction carries no gradient, so the agent
learns nothing from those. Needs the target's true definition and range from Role 1 to fix
properly.

## AI-generated content for the memes

The agent writes a concept; Gemini draws it. Same SDK and the **same
`GEMINI_API_KEY`** Role 2 already needs for concept generation — no second
account, no second bill, no new dependency.

```bash
# put GEMINI_API_KEY in backend/.env, then:

# pictures for the demo memes (the hand-written ones the UI ships with)
python3 scripts/make_image.py --all

# pictures for what the AGENT actually generated
python3 scripts/make_image.py --from-agent \
    --agent-data /path/to/memevolution_agent/data/experiments.json --all

open backend/media
```

Two different sets, and it is easy to confuse them. Without `--from-agent` you are
illustrating the 21 demo memes, which is what the UI shows. With it you are illustrating
what the agent wrote on its last run. The agent stores a MemeConcept; the text burned onto
the image is its `opening`, because that is the hook a viewer reads — the `title` is only
an internal name for the concept.

Then `scripts/post_to_instagram.py` picks up the generated image automatically.

The full chain:

```
genome -> Gemini writes the concept (Role 2, llm/gemini.py)
       -> Gemini draws the visual   (backend/app/generate_image.py)
       -> Pillow burns the exact caption on
       -> you approve it in the UI
       -> published, and the real numbers come back
```

**Why the text is composited rather than prompted.** Image models handle text
reasonably now, but a meme's words have to be *exactly* the ones the agent chose, not a
model's approximation. So Gemini draws the picture and Pillow writes the words.

**Two things that break older tutorials:**

- **Imagen is shut down.** `client.models.generate_images(...)` still exists in the SDK
  (checked on google-genai 2.24.0) but the models behind it are retired, so calling it
  fails. Image generation now goes through `generate_content`, and the image comes back as
  inline data on a content part, not in a dedicated response object.
- Model ids are `gemini-3.1-flash-image` (generalist, the default here) and
  `gemini-3.1-flash-lite-image` (faster, cheaper).

For video, Veo 3.1 is on the same API. Not wired up — a still image is enough to post, and
video generation is slow and expensive enough to be a bad demo dependency.

Everything degrades safely: no key means the abstract backdrop, and a failed generation is
caught and falls back rather than breaking the loop.

## Small things worth knowing

- **The spread score is defined in one place**, `frontend/src/lib/score.ts`. The mock backend
  computes it from that table and the hover tooltip explains the same sum, so they cannot
  drift. If the real backend changes the weights, change them there too.
- `scripts/seed_backend.py` (on `integration`) pushes the frontend's 21 demo experiments
  through the real API so the integrated app is not empty. Safe to re-run; it skips ids that
  already exist.
- `frontend/.env` and `backend/.env` are gitignored. Copy the `.env.example` next to each.
- An earlier dark "terminal" version of the UI is at commit `9c9b442` if you ever want to
  look at it. It was replaced because it was hard to read at a glance.
