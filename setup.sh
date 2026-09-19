#!/usr/bin/env bash
# One-time setup for the whole project. Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> backend"
cd backend
[ -d .venv ] || python3 -m venv .venv
# venv layout differs by platform: Scripts/ on Windows, bin/ everywhere else.
if [ -f .venv/Scripts/python.exe ]; then
  VENV_BIN=.venv/Scripts
else
  VENV_BIN=.venv/bin
fi
$VENV_BIN/pip install -q --upgrade pip
$VENV_BIN/pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
cd ..

echo "==> agent + prediction model"
# The agent has to be installed into the same venv as the API, because the API
# drives it in-process. Without this the browser's "Create 5 memes" silently
# falls back to a stub and /agent-states returns 503.
./backend/$VENV_BIN/pip install -q -e .
./backend/$VENV_BIN/pip install -q pandas xgboost scikit-learn
# pytest, so the fitness parity test can run - it is what stops the Python and
# TypeScript definitions of the spread score drifting apart.
./backend/$VENV_BIN/pip install -q pytest

# xgboost will not import on macOS without OpenMP, and its error message does
# not mention OpenMP on the first line, which costs people half an hour.
if ! ./backend/$VENV_BIN/python -c "import xgboost" >/dev/null 2>&1; then
  if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null; then
    echo "    installing libomp (xgboost needs it on macOS)"
    brew install libomp >/dev/null 2>&1 || true
  fi
  ./backend/$VENV_BIN/python -c "import xgboost" >/dev/null 2>&1 \
    || echo "    !! xgboost still will not import — run: brew install libomp"
fi

echo "==> frontend"
cd frontend
npm install --silent
[ -f .env ] || cp .env.example .env
cd ..

echo
echo "==> checking it actually works"
./backend/$VENV_BIN/python - <<'PY'
import sys
ok = True
try:
    import memevolution  # noqa: F401
    print("    agent            ok")
except Exception as e:
    ok = False; print(f"    agent            FAILED: {e}")
try:
    from memevolution.prediction.trained import TrainedFitnessPredictor
    TrainedFitnessPredictor()
    print("    prediction model ok")
except Exception as e:
    print(f"    prediction model unavailable ({type(e).__name__}) — the agent will use its stub")
try:
    sys.path.insert(0, "backend")
    from app.fitness import spread_score
    assert spread_score(1000, 100, 10, 30, 20) is not None
    print("    scoring          ok")
except Exception as e:
    ok = False; print(f"    scoring          FAILED: {e}")
sys.exit(0 if ok else 1)
PY

echo
echo "Setup complete."
echo "  ./dev.sh          start everything (frontend :5173, backend :8000)"
echo "  ./dev.sh --seed   also load demo data into an empty database"
echo "  ./run_agent.sh    one agent turn from the terminal"
echo "  ./test.sh         run every test"
echo
echo "Optional, for real content and real posting — put these in backend/.env:"
echo "  GEMINI_API_KEY    https://aistudio.google.com/apikey   (writes and draws the memes)"
echo "  IG_USER_ID, IG_ACCESS_TOKEN, PUBLIC_MEDIA_BASE          (publish to Instagram)"
