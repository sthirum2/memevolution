# Running the whole thing

```bash
./setup.sh          # once — installs backend venv + frontend deps
./dev.sh --seed     # starts both, loads demo data into an empty database
```

- frontend → http://localhost:5173
- backend → http://127.0.0.1:8000 (interactive API docs at `/docs`)

Ctrl-C stops both. After the first seed, plain `./dev.sh` is enough.

## The one switch that matters

`frontend/.env`:

```bash
VITE_USE_MOCK=true    # demo data baked into the frontend. Everything works.
VITE_USE_MOCK=false   # talk to the real backend. See the gaps below.
VITE_API_URL=http://127.0.0.1:8000
```

Vite only reads `.env` at boot, so restart after changing it.

**For the demo, run with `VITE_USE_MOCK=true`.** Every screen works, nothing can fail on
stage, and no network is involved. Live mode is for proving the integration is real.

---

## What works live today, and what doesn't

Seeded with `./dev.sh --seed`, pointing at the real FastAPI + database:

| Screen | Live status |
| --- | --- |
| **The memes** | Works. 21 experiments and 6 rounds come from the database. |
| **What it learned** | Empty. The backend has no `GET /agent-states`. |
| **Try it** | Stops at "create memes". Generation belongs to the agent service. |

Neither of the last two crashes — each explains itself on screen.

### Gaps, in the order worth closing

**1. `GET /agent-states` → `AgentState[]`** *(backend, ~30 min)*
Without it the third screen has nothing to draw, and that screen is the argument that the
agent learned anything.

```json
[{ "generation": 0,
   "beliefs":    { "absurdity": 0.40, "irony": 0.72, "relatability": 0.70,
                   "trend_relevance": 0.50, "text_density": 0.60,
                   "short_video": 0.45, "trending_audio": 0.50, "short_caption": 0.42 },
   "confidence": { "absurdity": 0.30, "...": 0 },
   "note": "One sentence a non-technical reader can follow." }]
```

**2. The meme text isn't stored** *(backend, ~30 min)*
Cards currently read `campus · talking_head` because that is all the API returns. The
`experiments` table has no columns for the content, so the actual joke is lost. Add to
`ExperimentCreate` / `ExperimentResponse` and the model:

```
headline, visual_description, punchline, caption, audio, media_url
```

This is the most visible gap — right now the app shows a meme app with no memes in it.

**3. Genome is missing three traits** *(backend, ~15 min)*
`text_density`, `caption_length`, `audio_strategy` have no columns. `http.ts` fills them
with `0 / 0 / "not provided"`, and the belief chart plots two of them.

**4. `confidence` and `feature_attribution`** *(data-model, ~20 min)*
`POST /experiments/{id}/prediction` only takes `fitness` and `model_version`. The detail
panel shows "Confidence not available" and the "what drove this prediction" chart is empty.

**5. Generate / select / evolve** *(agent service)*
`POST /generation`, `POST /select`, `POST /evolve`. These belong to the agent, not the CRUD
backend — either the agent exposes them and the frontend points at it, or the backend
proxies. Until then the **Try it** tab only runs on mock data.

The exact request and response shapes for all of these are in
[`frontend/README.md`](frontend/README.md#backend-integration) and typed in
[`frontend/src/types/index.ts`](frontend/src/types/index.ts).

---

## Posting to TikTok / Instagram

**Automated posting is not achievable for this hackathon, and you should not try.**
Your backend already reflects this — `app/tiktok.py` implements `ManualTikTokService`,
which is the correct call.

Why, concretely:

- **TikTok Content Posting API** needs a registered developer app, and the `video.publish`
  scope requires an audit. Until that audit passes, an unaudited app can only post to
  private/self-only. Audits take days to weeks.
- **Instagram Content Publishing API** needs a Business or Creator account linked to a
  Facebook Page, a Meta app, and App Review for `instagram_content_publish`. Also days to
  weeks.

Neither clears in a weekend, and working around either — automating a personal account,
driving the app with a headless browser — breaks both platforms' terms and risks the
account. It also wouldn't make the memetics argument any stronger.

### The loop that does work

```
agent picks a meme
      ↓
a human approves it in the UI          ← already built
      ↓
a human records and posts it           ← manual, ~10 min per meme
      ↓
paste the post URL back into the app   ← NOT BUILT YET
      ↓
enter the real view/like/share counts  ← NOT BUILT YET
      ↓
the agent evolves                       ← backend endpoint exists
```

The science is identical. You are still deploying real memes to real people and learning
from real engagement. The only thing being done by hand is pressing "post", and saying so
out loud is a *stronger* pitch than implying an automation you don't have.

**Two pieces of UI are missing to close that loop**, and they are small:

1. After approving, a field to paste the TikTok/Instagram post URL, which calls the existing
   `POST /experiments/{id}/deploy` with the `post_id` it needs. Right now the frontend
   throws in live mode because it has no post id to send.
2. A metrics form to type in views / likes / comments / shares / saves a day later, calling
   the existing `POST /experiments/{id}/metrics`.

Both backend endpoints already exist and work. Ask and I'll build the two forms.

### If you want one real post before judging

Do it now, not at the end — a post needs hours to accumulate engagement.

1. `./dev.sh --seed`, open **Try it** on mock data, let the agent pick a meme
2. Film and post that meme yourself from a real account
3. Record the post URL and the time
4. Before you present, note the real numbers and say them out loud

One genuine post with real numbers beats thirty simulated ones for a memetics track.
