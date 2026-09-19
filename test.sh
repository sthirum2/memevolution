#!/usr/bin/env bash
# Every test in the repo, in one command.
set -uo pipefail
cd "$(dirname "$0")"

# venv layout differs by platform: Scripts/ on Windows, bin/ everywhere else.
if [ -f backend/.venv/Scripts/python.exe ]; then
  PY=./backend/.venv/Scripts/python
else
  PY=./backend/.venv/bin/python
fi
[ -x "$PY" ] || { echo "Run ./setup.sh first (no venv at backend/.venv)." >&2; exit 1; }
fail=0

echo "==> agent + prediction model"
$PY -m pytest tests/ -q || fail=1

echo
echo "==> api + spread-score parity"
( cd backend && ../$PY -m pytest tests/ -q ) || fail=1

echo
echo "==> frontend typecheck + build"
build_log=$(npm --prefix frontend run build 2>&1) \
  && echo "build ok" || { echo "build FAILED"; echo "$build_log"; fail=1; }

echo
[ $fail -eq 0 ] && echo "everything passed" || echo "something failed (see above)"
exit $fail
