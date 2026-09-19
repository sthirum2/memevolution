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
./setup.sh          # once: backend venv + frontend deps
./dev.sh --seed     # both services, and load demo data into an empty database
```

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

**Demo with `VITE_USE_MOCK=true`.** Nothing can fail on stage and no network is involved.
Use live mode to prove the integration is real, then switch back. Vite only reads `.env` at
startup, so restart after changing it.

## What is not finished

Against the live backend, "The memes" works. The other two screens are waiting on:

1. **`GET /agent-states`** — without it "What it learned" has nothing to draw. That screen is
   the argument that the agent learned anything, so this is the highest-value gap.
2. **The meme text is not stored.** Cards read `campus · talking_head` because the API
   returns no `headline` / `caption` / `punchline` / `visual_description` / `audio` /
   `media_url`. Right now it looks like a meme app with no memes in it.
3. **Three genome traits have no columns** — `text_density`, `caption_length`,
   `audio_strategy`.
4. **`confidence` and `feature_attribution`** are not returned with a prediction.
5. **Generate / select / evolve** belong to the agent service, which is not up yet. The
   "Try it" tab therefore only runs on mock data.

Exact request and response shapes for all of these:
[`frontend/README.md`](frontend/README.md#backend-integration).

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
