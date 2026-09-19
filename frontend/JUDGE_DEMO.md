# Frontend judge demo handoff

Scope: frontend only, on the existing `frontend-demo` branch. No branch switch, commit, push, merge, backend, agent, model, video-generation, or Tiger/persistence implementation changes.

## What already existed

The current frontend already had a cream/purple/green design system, generation ribbon and experiment cards/details, a four-step Lab, candidate scoring/selection, human approval, backend publishing, live metric retrieval, mock-mode simulation, and belief/fitness charts. Zustand owns state; `api/client.ts` switches between HTTP and mock implementations. The backend now exposes `/generation`, `/select`, `/evolve`, `/agent-states`, experiment CRUD, publishing, live metrics, snapshots and propagation. Video generation lives in backend publishing, not the browser.

Inspection found live-mode correctness issues: fabricated engagement and spread odds, simulated observations used as learning fallback, missing predictions represented as zero, fake `pending_*` deployment IDs, placeholder images passed off as media, observed experiments classified as winners without selection evidence, and historical belief explanations built around mock data. The snapshot endpoint was unused. The old typecheck script also overrode `noEmit`, conflicting with the TypeScript configuration and emitting JavaScript beside source files.

## Changes and the judge flow

1. The shared overview explains **Prediction → Deployment → Real engagement → Learning → Evolution**, shows the current generation/strategy, the selected candidate/model when available, and Gen 1 versus Gen 2 records. Stage states refer to the current browser session; historical records remain in the generation browser.
2. In **Try it**, generate candidates. Inspect genomes, mutations and exact returned fitness (four decimal places, no frontend recalibration). The backend-selected candidate is highlighted. The UI never selects the highest-scoring candidate on its own.
3. Review the selected concept and media. Missing media is explicit. Image URLs render images; supported video URLs render a native player with controls. Relative backend media URLs resolve against the API origin. Mock specimen URLs are not used as live-media fallbacks.
4. Approve and **Save and review deployment**. This saves records, not a fabricated deployment. **Publish to TikTok** makes the existing backend call; the browser never calls Gemini/Veo. Display the returned upload/post ID, public link if returned, status and instructions. `awaiting_user` does not become “live.”
5. Pull engagement. Display views, likes, comments, shares, saves and backend-computed observed fitness. Unknown values remain pending, including a missing save count. The history table reads actual timestamped snapshots; zero remains a real measurement. No storage provider is inferred.
6. **Update the AI** is enabled only when required live counts are present. It submits those values unchanged to the existing metrics/evolve endpoints. No predicted-to-engagement fallback runs in live mode. The returned belief shifts are displayed and retained for the session when generating the next candidates.
7. **Generate the next candidates** invokes the existing generation endpoint. Gen 2 stays pending until actual records exist. **What it learned** shows the actual `/evolve` before/after response in live mode; fabricated historical narratives and reconstructed trajectories are not shown as evidence.

The existing mock mode remains available only through `VITE_USE_MOCK=true`, with visible demo labeling and simulated engagement explicitly identified. Live mode does not silently switch to mock mode on an error.

## Data sources consumed

| UI evidence | Existing backend contract |
| --- | --- |
| Candidate genomes, mutations, hypotheses, returned predictions and selected concept | `POST /generation` |
| Agent selection and reasoning | `POST /select` |
| Current agent beliefs/note | `GET /agent-states` (latest state only treated as current evidence) |
| Recorded experiments/generations | `GET /experiments`, `GET /generations`, `GET /experiments/{id}` |
| Image/video preview | `content.media_url`, when reachable and present |
| Post/upload status, ID, instructions, optional permalink | `POST /experiments/{id}/publish` |
| Latest engagement and observed fitness | `GET /experiments/{id}/live-metrics`, or stored `observed` |
| Recorded engagement history | `GET /experiments/{id}/snapshots` |
| Learning changes | `POST /evolve`: `previous`, `next`, `shifts`, `driverId` |

“Live backend” describes the frontend's data source, not proof that the model, generated media or engagement is authentic. `/generation` currently discards the bridge's model/Gemini metadata, and the bridge can fall back to a mock predictor. The UI labels unknown model/generator provenance as unreported rather than claiming verified XGBoost or Gemini output. It displays a returned `prediction.model_version` when available. Saving a prediction without provenance labels it `unreported`, not a fabricated XGBoost version.

## Pending team contracts (proposals, not implemented backend changes)

| Owner | Exact frontend need | Current limitation |
| --- | --- | --- |
| Persons 1 + 4 | A reachable final MP4 URL, preferably `content.media_url`, plus a MIME type if the URL lacks an extension; `video.status` (`pending/generating/ready/failed`), `video.source` (`veo/still_fallback`), and optional `video.error` | Concept responses currently advertise JPEGs; TikTok publish can create Veo or fallback video but does not return the final video URL. No API static-media mount was found in `main.py`; a serving route or reachable public media origin is needed. The frontend does not guess filenames or claim Veo success. |
| Persons 2 + 4 | Return actual `prediction.model_version` and `prediction.source` (`xgboost/mock`), plus concept generator provenance on `/generation`; preserve them on experiment reads | Bridge computes `model` and Gemini metadata but `/generation` returns only candidates. Persisted `model_version` alone must reflect the real source. |
| Persons 2 + 4 | Persist/return `selection.selected_id`, `selection.mode`, and `selection.reasoning` per generation; return actual historical belief snapshots with generation/timestamp | Selection is currently only the latest server-side session decision. `/agent-states` reconstructs earlier points using current beliefs; they are not genuine historical snapshots. The UI preserves this session's `/evolve` changes only. |
| Person 4 | Persist `deployment.status`, `deployment.permalink`, and distinguish TikTok `publish_id` from resolved public `post_id`; provide a status refresh endpoint such as `GET /experiments/{id}/publish-status` | The publish response has live/awaiting-user status, but experiment reads expose only platform/timestamp/ID. An upload ID does not confirm a public TikTok post; the frontend cannot infer a public link. |
| Person 4 | Populate the existing `/snapshots` endpoint; optionally expose storage/source provenance if judges should see verified Tiger attribution | Snapshot retrieval is implemented in the UI. The API does not identify whether storage is Tiger versus local SQL, so the UI labels it recorded backend history. No new snapshot endpoint is needed. |
| Persons 2 + 4 | Define learning behavior for unavailable platform metrics (notably TikTok saves), or return all required observed counts | Until then, live learning waits for complete counts. It does not replace unavailable saves with zero. |
| Person 2 | Ensure prediction/observed fitness scales agree; expose real model and trait preprocessing status | The frontend displays values unchanged. No XGBoost calibration, trait scaling, or evolution logic was changed. |

The backend currently ignores some frontend generation controls: platform/risk appetite are not passed to the agent, and topic is not applied inside `agent_bridge.run_generation`. Those unsupported controls are not offered in live mode; mock mode retains them. This is a team integration gap, not a reason to alter agent code here.

## Validation

Commands run from the repository root:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
```

Browser verification uses installed Playwright and headless Chrome. Start independent servers so mock/live environment flags cannot mix:

```powershell
$env:VITE_USE_MOCK='true'; npm --prefix frontend run dev -- --host 127.0.0.1 --port 5175 --strictPort
# Separate terminal:
$env:VITE_USE_MOCK='false'; npm --prefix frontend run dev -- --host 127.0.0.1 --port 5176 --strictPort
# Separate terminal; use your installed Playwright and Chrome paths:
$env:PLAYWRIGHT_MODULE='C:/Users/srith/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node frontend/scripts/test-browser.mjs
```

The Node regression checks cover missing values versus real zeros, media URLs, preservation of a zero prediction, model provenance, no fabricated deployment POST, and no fabricated observations on live learning. Browser checks cover the complete mock generation/selection/approval/publish/engagement/learning/next-generation flow, live API-shaped fixtures, pending and partial counts, a complete measurement containing zero, actual returned belief changes, native video player controls/URL handling and failed-media fallback, mobile layout and runtime errors. Browser fixtures exist only in the test script; they are never included as a live fallback. Screenshots are in ignored `frontend/.demo-check/`.

No pre-existing frontend test command or test suite was found. Added `npm test` for the evidence regression checks; no new dependencies. The original typecheck failure was corrected; its emitted JS files were removed. Build and browser tooling needed sandbox escalation because esbuild/Chrome subprocesses were blocked.

Actual local backend: `GET http://127.0.0.1:8000/health` could not connect. The live browser correctly showed the connection error without mock fallback. Consequently real generation, Gemini/Veo production, public TikTok posting, Tiger ingestion and real observation-to-Gen-2 integration could not be validated here. No real publish, external generation, or engagement write was attempted by these tests.

A generated browser WebM test fixture contained no encoded frames, so it could not validate playback. Player mounting, controls, source URL, and error fallback are verified separately. Actual Veo MP4 playback remains unverified until a real reachable backend video is available.
