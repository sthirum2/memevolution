# Memevolution backend

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Without a `.env` file, the API uses a local `memevolution.db` SQLite database. Startup creates missing tables. Existing SQLite files retain their schema and observations.

The interactive API docs are available at `http://localhost:8000/docs`.

## Time-series history

Continue submitting real observations to `POST /experiments/{id}/metrics`.
Each request appends a snapshot, including repeated timestamps. The existing
experiment response contains the latest observation, ordered by timestamp then ID.
Naive observation timestamps are interpreted as UTC; offsets are normalized to UTC.

- `GET /experiments/{id}/snapshots`: all snapshot fields, ID, experiment ID and timestamp, oldest first.
- `GET /experiments/{id}/propagation`: the same snapshots plus elapsed seconds since
  the first observation, interval seconds since the preceding observation, view/share
  growth since that observation, and views/shares per hour over that interval.

Both return `[]` before any observations and 404 for an unknown experiment.
First-point growth/rates are null. Missing counters produce null growth/rates;
zero-length intervals produce null rates. Decreasing counters retain negative
growth. These are cumulative engagement counters, so they are not summed into
time buckets. Calculations are identical on SQLite and Tiger, using exact observation
intervals. SQLite returns naive UTC timestamps; PostgreSQL returns timezone-aware ones.

## Local verification (PowerShell)

From the repository root, using the existing virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
cd backend
$env:DATABASE_URL = 'sqlite:///./memevolution.db'
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/experiments
$experimentId = Read-Host 'Existing experiment ID'
Invoke-RestMethod "http://127.0.0.1:8000/experiments/$experimentId/snapshots"
Invoke-RestMethod "http://127.0.0.1:8000/experiments/$experimentId/propagation"
```

Tests start a real HTTP server with a temporary SQLite database, exercise the existing
experiment/prediction/deployment/metrics routes and both new routes, then remove the
test database. Synthetic fixtures never enter your local or Tiger database.

## Configure Tiger Data

1. Create a Tiger Cloud PostgreSQL service and copy its host, port, database, user
   and password from the connection details. Use a TimescaleDB-enabled service
   (2.13 or newer for `by_range`).
2. In `backend`, copy `.env.example` to `.env` if you do not already have one.
   Set `DATABASE_URL` to your service URL, for example
   `postgresql+psycopg://USER:URL_ENCODED_PASSWORD@HOST:PORT/DATABASE?sslmode=require`.
   Standard `postgresql://` and `postgres://` URLs also select psycopg automatically.
   Keep `.env` private; it is gitignored. Preserve Tiger's supplied TLS parameters.
3. Remove any shell override with `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue`
   and launch uvicorn from `backend` using the command above. Restart after URL changes.
4. Startup creates tables and runs `timescale.sql` in one transaction. The connection
   role must own the tables and be permitted to enable/use TimescaleDB. PostgreSQL
   without TimescaleDB fails startup instead of silently storing ordinary tables.
5. Deploy an experiment and submit actual TikTok observations through the existing API.
   Query the two new routes to see its trajectory. Changing URLs does not copy SQLite
   data to Tiger. Switch back to the SQLite URL to use your untouched local database.

The migration expands only PostgreSQL's snapshot primary key from `id` to
`(id, timestamp)`, preserves rows and the ID sequence, then calls
`create_hypertable(..., by_range('timestamp'), if_not_exists => TRUE, migrate_data => TRUE)`.
The ORM retains sequence-generated ID identity for compatibility with SQLite.
Do not manually insert duplicate IDs with different timestamps.
This is the documented conversion API for existing tables:
[Tiger's hypertable conversion documentation](https://github.com/timescale/Tiger-Data-Docs/blob/main/src/content/docs/learn/hypertables/creating-and-configuring-hypertables.mdx).

For manual initialization with PostgreSQL's `psql` installed, run from `backend`
(use a standard PostgreSQL URL, not the SQLAlchemy `+psycopg` prefix):

```powershell
$env:PGHOST = Read-Host 'Tiger host'
$env:PGPORT = Read-Host 'Tiger port'
$env:PGDATABASE = Read-Host 'Tiger database'
$env:PGUSER = Read-Host 'Tiger user'
$env:PGSSLMODE = 'require'
psql -W -v ON_ERROR_STOP=1 --single-transaction -f schema.sql -f timescale.sql
psql -W
```

In Tiger's SQL editor or the `psql` prompt, verify:

```sql
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
SELECT hypertable_schema, hypertable_name, num_dimensions, num_chunks
FROM timescaledb_information.hypertables
WHERE hypertable_name = 'engagement_snapshots';
SELECT column_name, column_type, dimension_type
FROM timescaledb_information.dimensions
WHERE hypertable_name = 'engagement_snapshots';
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'engagement_snapshots'::regclass AND contype = 'p';
SELECT experiment_id, timestamp, views, shares, fitness
FROM engagement_snapshots ORDER BY experiment_id, timestamp, id;
```

Expect one hypertable, a time dimension on `timestamp`, and primary key `(id, timestamp)`.
Repeat startup to verify idempotence on your service. Existing-table migration takes
locks and can take time with large histories; back up an existing PostgreSQL database
and initialize during a quiet window. Custom foreign keys referencing snapshot IDs or
additional unique indexes may require migration adjustments. This project defines none.
History endpoints currently return all observations; pagination can be added if needed.

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
