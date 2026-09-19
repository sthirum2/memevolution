#!/usr/bin/env bash
# Start the backend and the frontend together. Ctrl-C stops both.
#   ./dev.sh          just run
#   ./dev.sh --seed   also load demo data into an empty database
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d backend/.venv ] || [ ! -d frontend/node_modules ]; then
  echo "Dependencies missing. Run ./setup.sh first." >&2
  exit 1
fi

cleanup() { echo; echo "stopping..."; kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "==> backend  http://127.0.0.1:8000  (docs at /docs)"
( cd backend && ./.venv/bin/uvicorn app.main:app --port 8000 --reload ) &

# Wait for it to answer before seeding or starting the UI.
for _ in $(seq 1 40); do
  curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1 && break
  sleep 0.5
done

if [ "${1:-}" = "--seed" ]; then
  echo "==> seeding demo data"
  python3 scripts/seed_backend.py || echo "seed failed (continuing)"
fi

echo "==> frontend http://localhost:5173"
( cd frontend && npm run dev ) &

wait
