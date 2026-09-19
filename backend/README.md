# Memevolution backend

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Without a `.env` file, the API uses a local `memevolution.db` SQLite database. For Supabase, copy `.env.example` to `.env`, set `DATABASE_URL`, and run `schema.sql` in the Supabase SQL editor.

The interactive API docs are available at `http://localhost:8000/docs`.

## MVP flow

1. `POST /experiments`
2. `POST /experiments/{id}/prediction`
3. Manually post the video, then `POST /experiments/{id}/deploy` with the TikTok post ID.
4. `POST /experiments/{id}/metrics` for each timestamped snapshot.
5. Read the complete shared contract from `GET /experiments/{id}` or list views.

TikTok-specific behavior is isolated in `app/tiktok.py`; official API support can replace `ManualTikTokService` later.

## Agent integration

Person 2's agent is not modified. The adapter in `integration/agent_backend.py` uses HTTP and keeps the agent's local JSON state separate from the backend database. To run one selected generation from a sibling clone of the agent:

```powershell
cd backend
python integration/run_generation.py --agent-repo C:\path\to\memevolution_agent --seed 42
```

The runner stores the selected experiment and prediction. The human then posts the selected concept to TikTok and calls the deployment and metrics endpoints. Retrieve the observation with `MemevolutionBackend.get_observed_results(id)`, build the agent's `Observation`, and pass it to `apply_observation` so the agent updates beliefs for the next generation.