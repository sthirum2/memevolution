#!/usr/bin/env bash
# Every test in the repo, in one command.
set -uo pipefail
cd "$(dirname "$0")"
PY=./backend/.venv/bin/python
fail=0

echo "==> agent + prediction model"
$PY -m pytest tests/ -q || fail=1

echo
echo "==> api + spread-score parity"
( cd backend && ../$PY -m pytest tests/ -q ) || fail=1

echo
echo "==> frontend typecheck + build"
npm --prefix frontend run build >/dev/null 2>&1 \
  && echo "build ok" || { echo "build FAILED"; fail=1; }

echo
[ $fail -eq 0 ] && echo "everything passed" || echo "something failed (see above)"
exit $fail
