# MEMEVOLUTION — frontend

> Can an AI agent learn how culture spreads by participating in memetic evolution itself?

An autonomous memetic agent generates memes with explicit trait "genomes", predicts which
will propagate, deploys the winner to a real platform, observes organic engagement, and
evolves its strategy across generations. This repository is the **frontend only** — the
visualisation and control surface for that loop.

Built for HopHacks 2026, Calcifer Computing memetics track.

It runs entirely on local mock data today. The backend swaps in behind a single env flag
with no component changes. See [Backend integration](#backend-integration).

---

## Run it

```bash
npm install && npm run dev
```

Then open http://localhost:5173. No `.env` is needed to run — mock data is the default, so a
fresh clone works immediately.

| Script            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Vite dev server on :5173                                 |
| `npm run build`   | Type-check (`tsc -b`) then production build to `dist/`   |
| `npm run preview` | Serve the production build                               |
| `npm run format`  | Prettier over `src/`                                     |
| `npm run mock:regen` | Regenerate `src/data/*.json` and `public/specimens/*.svg` |

---

## Demo mode

The whole pipeline plays hands-free — replay the tree, generate a population, score it,
select, authorise, deploy, observe, evolve, then show what the beliefs did.

- open `http://localhost:5173/?demo=1`, or
- press <kbd>D</kbd> anywhere in the app.

It takes about 35 seconds. **Against a live backend (`VITE_USE_MOCK=false`) demo mode stops
at the authorisation gate and waits for a human** — a demo flag is not consent. Against the
mock it auto-arms and says so on screen, because nothing is published.

### Keyboard

| Key | Action |
| --- | --- |
| <kbd>1</kbd> | The Organism — evolution tree |
| <kbd>2</kbd> | Specimen — opens the best experiment |
| <kbd>3</kbd> | The Agent's Mind — beliefs over generations |
| <kbd>4</kbd> | The Lab — run a generation |
| <kbd>5</kbd> | Corpus — historical grounding |
| <kbd>R</kbd> | Replay evolution from generation 0 |
| <kbd>D</kbd> | Demo playback |
| <kbd>L</kbd> | Collapse / expand the agent log |
| <kbd>Esc</kbd> | Close the specimen panel or the shortcut overlay |
| <kbd>?</kbd> | Shortcut overlay |

---

## The five screens

1. **The Organism** (`components/tree`) — React Flow canvas of the whole lineage. Node size,
   glow intensity and pulse rate all scale with fitness; extinct branches desaturate and
   their edges fray out rather than disappear. Surviving lineages carry animated particles.
   "Replay evolution" grows the tree generation by generation.
2. **Specimen panel** (`components/panel`) — the lab report for one experiment: genome
   meters, mutation diff against the ancestor, the agent's hypothesis, predicted vs observed
   with an `ANOMALY` flag when the miss exceeds `.15`, raw engagement, and feature
   attribution for the model's prediction.
3. **The Agent's Mind** (`components/mind`) — belief trajectories per trait, the current
   strategy with drift arrows and confidence bands, a derived belief-shift log, and a
   predicted-vs-observed calibration scatter with correlation and mean absolute error.
4. **The Lab** (`components/lab`) — the five-stage pipeline: seed → generate → select →
   authorise → observe. This is the judge-facing interactive flow.
5. **Corpus** (`components/corpus`) — the historical datasets and three honest aggregate
   charts. Context, not the argument.

---

## Folder map

```
src/
  api/
    client.ts      ← THE ONLY DATA DOOR. Every component imports from here.
    mock.ts          local fake backend: JSON + simulated latency + a tiny scoring model
    http.ts          real backend: fetch against VITE_API_BASE_URL, identical signatures
  components/
    charts/        Recharts pieces + shared chart theme
    common/        UI primitives (Meter, Chip, DivergingBar, MediaFrame, Button…)
    corpus/        Corpus view
    lab/           The five-stage pipeline, platform post mocks, slide-to-arm gate
    mind/          The Agent's Mind
    panel/         Specimen panel
    shell/         Top bar, agent log, grain overlay, shortcut overlay
    tree/          React Flow canvas, custom node, custom edge, generation bands
  data/            Generated mock JSON — do not hand-edit, run `npm run mock:regen`
  lib/             layout (tree), fitness (colour/scale rules), format, hooks
  store/useStore.ts  zustand: data, view, agent log, replay, lab state machine
  types/index.ts   THE FROZEN DATA CONTRACT
scripts/
  generate-mock.mjs  deterministic mock generator (narrative is hand-authored)
```

### Theming

All colour lives in `tailwind.config.js` as named tokens (`void`, `carbon`, `bone`, `acid`,
`rust`, `probe`). Nothing hardcodes a hex in JSX except `lib/fitness.ts`, which is the single
place allowed to decide what a number looks like. Re-theme the whole app from those two files.

The rule the design follows: **90% monochrome, colour reserved for fitness signal.** `acid`
means life/survival/positive delta, `rust` means decay/extinction/negative delta, `probe`
(cyan) always means "this is the model's guess, not an observation."

### Mock data

`src/data/*.json` is generated by `scripts/generate-mock.mjs`. The narrative is hand-authored
in that script and only the numbers are computed, deterministically. Six generations, 21
experiments, with two deliberate calibration surprises (`exp_006` beats its prediction by
+.18; `exp_012` misses by −.33 and is what teaches the agent that the corpus's high irony
score was a false signal). Edit the `SPEC` table in the script and re-run `npm run mock:regen`.

Specimen backdrops are locally generated SVGs in `public/specimens/` — no network calls at
demo time, so bad venue wifi cannot break the pitch.

---

## The frozen data contract

Defined in [`src/types/index.ts`](src/types/index.ts). All four roles agreed this shape; do
not add or rename fields without telling the whole team.

```ts
Experiment {
  id: string                 // "exp_006"
  generation: number
  parent_id: string | null
  status: 'pending' | 'predicted' | 'deployed' | 'survived' | 'extinct'
  genome: {
    topic, humor, format, hook, audio_strategy: string
    absurdity, irony, relatability, trend_relevance, text_density: number  // 0..1
    caption_length, video_length: number                                   // counts
  }
  mutations: { trait: string; from: number | string; to: number | string }[]
  hypothesis: string
  prediction: {
    fitness: number
    confidence: number
    feature_attribution: { feature: string; contribution: number }[]
  }
  content: { headline, visual_description, punchline, caption, audio, media_url: string }
  deployment: { platform: 'tiktok'|'instagram'|'x'|null; timestamp: string|null; post_id: string|null }
  observed: {
    views, likes, comments, shares, saves, fitness: number | null
    timeseries: { t: string; views: number; likes: number; shares: number }[]
  }
}

AgentState {
  generation: number
  beliefs: Record<string, number>      // 0..1 per trait
  confidence: Record<string, number>   // 0..1 per trait
  note: string
}
```

Who writes what:

| Role | Owns |
| --- | --- |
| data-model | `prediction` (fitness, confidence, feature_attribution) |
| agent | `genome`, `mutations`, `hypothesis`, `content` |
| frontend | displays all of it, writes nothing |
| backend | persists it, fills `deployment` and `observed`, serves `AgentState` |

The belief keys the frontend charts are: `absurdity`, `irony`, `relatability`,
`trend_relevance`, `text_density`, `short_video`, `trending_audio`, `short_caption`
(see `BELIEF_TRAITS` in `src/lib/fitness.ts`). Unknown keys are ignored rather than crashing,
but they will not be plotted — add them to that array if the agent grows new genes.

---

## Backend integration

**This is the whole handover. Nothing in the component tree needs to change.**

### 1. Implement the endpoints

`src/api/http.ts` is already written against these. Match the paths and shapes and it works
as-is.

| Client function | Method & path | Request body | Response |
| --- | --- | --- | --- |
| `getExperiments()` | `GET /experiments` | — | `Experiment[]` |
| `getExperiment(id)` | `GET /experiments/{id}` | — | `Experiment \| null` |
| `getAgentStates()` | `GET /agent-states` | — | `AgentState[]` |
| `getGenerations()` | `GET /generations` | — | `GenerationSummary[]` |
| `getCorpus()` | `GET /corpus` | — | `CorpusStats` |
| `generateCandidates(params, onCandidate?)` | `POST /generation` | `{ platform, topic, riskAppetite, count }` | `Experiment[]` (5 scored candidates) |
| `selectCandidate(candidates, riskAppetite?)` | `POST /select` | `{ candidate_ids: string[], risk_appetite: number }` | `SelectionResult` |
| `commitCandidate(candidate)` | `POST /experiments` | `Experiment` | `Experiment` (with server-assigned `id`) |
| `deployExperiment(id, platform)` | `POST /experiments/{id}/deploy` | `{ platform }` | `Experiment` (status `deployed`, `deployment` filled) |
| `recordMetrics(id, metrics)` | `POST /experiments/{id}/metrics` | `{ views, likes, comments, shares, saves }` | `Experiment` (with `observed.fitness` computed) |
| `evolve()` | `POST /evolve` | — | `EvolveResult` |

Supporting response shapes (all in `src/types/index.ts`):

```ts
GenerationSummary { generation, count, meanFitness, bestId, bestFitness }
SelectionResult   { selectedId, mode: 'exploit'|'explore', reasoning, ranking: {id,fitness,confidence}[] }
EvolveResult      { generation, previous: AgentState, next: AgentState,
                    shifts: {trait,from,to,delta}[], driverId: string|null }
CorpusStats       { datasets[], fitnessDistribution[], traitCorrelation[], propagationByFormat[] }
```

Notes:

- **`POST /generation` returns all five candidates at once.** The Lab streams them in one at
  a time for the demo; `http.ts` replays the batch through the same callback so the UI
  behaves identically. If you later add SSE at `/generation/stream`, change the body of
  `generateCandidates` in `http.ts` — the signature and every caller stay as they are.
- `commitCandidate` exists because a generated candidate needs a real server-side id before
  it can be deployed. If your `POST /generation` already persists candidates, make
  `commitCandidate` a no-op that returns its argument.
- `recordMetrics` should compute `observed.fitness` server-side. The frontend never
  calculates fitness; it only displays it. The mock's definition is propagation-weighted and
  reach-normalised — see `recordMetrics` in `src/api/mock.ts` for the exact weights we've
  been demoing with.
- Timestamps are ISO 8601 strings. `observed.timeseries` may be empty.
- Enable CORS for the Vite origin (`http://localhost:5173`).

### 2. Flip the flag

```bash
# .env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000
```

Restart the dev server (Vite only reads `.env` at boot). The top bar's status chip flips
from `MOCK` to `LIVE`, so it is never ambiguous which backend answered.

### 3. That is it

No component imports JSON and no component calls `fetch`. `src/api/client.ts` picks the
implementation from that one flag and re-exports the identical interface. If a request
fails, the app shows the error with the URL it tried and a retry button rather than a blank
screen.

To verify the swap end-to-end: load the app, confirm the chip reads `LIVE`, open the
Organism view (proves `GET /experiments` + `GET /generations`), open the Agent's Mind
(proves `GET /agent-states`), then run one Lab generation (proves the four POSTs).

---

## Honest caveats

Worth keeping in the pitch, because judging is on the memetics argument and overclaiming is
the fastest way to lose it:

- **"Fitness" is an experimental memetic fitness score, not a measurement of virality.** It
  is normalised for reach and weighted toward shares and saves, because those are the closest
  thing in the data to an act of replication.
- **Semantic traits are model classifications, not ground truth.** Absurdity and irony are
  numbers a language model assigned, not properties of the world.
- **"Odds of going viral" is a defined quantity**, shown on screen as such: the modelled
  probability of clearing the historical corpus's top decile, given the genome and the
  model's own confidence. The app repeatedly shows the model being wrong about exactly this.
- **Deployment is never automatic.** The agent selects; a human authorises. The two-step gate
  is real, and demo mode refuses to bypass it against a live backend.

---

## Stack

React 18 · TypeScript · Vite 5 · Tailwind 3 · React Flow (`@xyflow/react`) · Recharts ·
Framer Motion · zustand · lucide-react

Dev affordance: `__mv` is exposed on `window` in dev builds, so
`__mv.getState().lab` and `__mv.getState().setView('mind')` work from the console.
Stripped from production.
