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