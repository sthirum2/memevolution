#!/usr/bin/env bash
# One-time setup for the whole project. Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> backend"
cd backend
[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install -q --upgrade pip
./.venv/bin/pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
cd ..

echo "==> frontend"
cd frontend
npm install --silent
[ -f .env ] || cp .env.example .env
cd ..

echo
echo "Setup complete."
echo "  ./dev.sh          start both (frontend on :5173, backend on :8000)"
echo "  ./dev.sh --seed   start both and load the demo data into the database"
