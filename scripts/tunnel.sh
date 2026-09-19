#!/usr/bin/env bash
# Make the rendered memes reachable from the internet.
# Instagram fetches image_url from Meta's servers, so localhost will never work.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v cloudflared >/dev/null || { echo "brew install cloudflared" >&2; exit 1; }

mkdir -p backend/media
echo "Serving backend/media on :8787 and opening a public tunnel."
echo "Copy the https://....trycloudflare.com url below into backend/.env as:"
echo "    PUBLIC_MEDIA_BASE=https://<that-host>/media"
echo
( cd backend/media && python3 -m http.server 8787 >/dev/null 2>&1 ) &
trap 'kill 0' EXIT INT TERM
sleep 1
cloudflared tunnel --url http://127.0.0.1:8787
