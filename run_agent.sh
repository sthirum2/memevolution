#!/usr/bin/env bash
# One real turn of the loop: the agent invents a meme, Gemini draws it, you look at it.
#
#   ./run_agent.sh              generate a new meme and its picture
#   ./run_agent.sh --observe exp_003 --views 8400 --likes 760 \
#                  --comments 52 --shares 210 --saves 130
#
# Nothing is posted. Publishing is a separate, deliberate step.
set -euo pipefail
cd "$(dirname "$0")"

# venv layout differs by platform: Scripts/ on Windows, bin/ everywhere else.
if [ -f backend/.venv/Scripts/python.exe ]; then
  PY=./backend/.venv/Scripts/python
else
  PY=./backend/.venv/bin/python
fi
[ -x "$PY" ] || { echo "Run ./setup.sh first." >&2; exit 1; }

# The agent reads the key from the shell; everything else reads backend/.env.
# Bridge the two so one place works for both.
if [ -f backend/.env ]; then
  KEY=$(grep -E '^GEMINI_API_KEY=.+' backend/.env 2>/dev/null | cut -d= -f2- || true)
  [ -n "${KEY:-}" ] && export GEMINI_API_KEY="$KEY"
fi

if [ "${1:-}" = "--observe" ]; then
  shift
  exec $PY scripts/observe.py "$@"
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "!! GEMINI_API_KEY is not set, so the agent will write a placeholder concept"
  echo "   and the picture will be the abstract fallback."
  echo "   Get a key at https://aistudio.google.com/apikey and put it in backend/.env"
  echo
fi

echo "==> the agent invents a meme"
$PY -m memevolution generate

ID=$($PY - <<'PY'
import json, pathlib
rows = json.loads(pathlib.Path("data/experiments.json").read_text())
print(rows[-1]["id"])
PY
)

echo
echo "==> drawing what it came up with  ($ID)"
$PY scripts/make_image.py "$ID" --from-agent --agent-data data/experiments.json

echo
echo "==> open it"
open "backend/media/$ID.jpg" 2>/dev/null || echo "   backend/media/$ID.jpg"
echo
echo "When you have real numbers for it:"
echo "  ./run_agent.sh --observe $ID --views N --likes N --comments N --shares N --saves N"
