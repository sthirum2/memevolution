#!/bin/bash
# Keeps the backend + public tunnel alive for 24 hours, no matter what.
# Restarts either process if it dies, and re-points PUBLIC_MEDIA_BASE /
# restarts the backend automatically if the tunnel URL ever changes.

set -u
cd "$(dirname "$0")/.."   # backend/

ENV_FILE=".env"
BACKEND_LOG="/tmp/backend.log"
TUNNEL_LOG="/tmp/cloudflared.log"
END_TIME=$(( $(date +%s) + 86400 ))  # 24 hours from now

log() { echo "[$(date '+%H:%M:%S')] $*"; }

start_backend() {
  pkill -f "uvicorn app.main:app" 2>/dev/null
  sleep 1
  source .venv/bin/activate
  nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$BACKEND_LOG" 2>&1 &
  log "backend (re)started, pid $!"
}

start_tunnel() {
  pkill -f "cloudflared tunnel" 2>/dev/null
  sleep 1
  : > "$TUNNEL_LOG"
  nohup cloudflared tunnel --url http://localhost:8000 > "$TUNNEL_LOG" 2>&1 &
  log "tunnel (re)started, pid $!"
  local url=""
  for _ in $(seq 1 15); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
    [ -n "$url" ] && break
    sleep 1
  done
  if [ -z "$url" ]; then
    log "ERROR: tunnel did not report a URL"
    return 1
  fi
  echo "$url"
}

apply_url() {
  local url="$1"
  sed -i '' "s|^PUBLIC_MEDIA_BASE=.*|PUBLIC_MEDIA_BASE=${url}|" "$ENV_FILE"
  log "PUBLIC_MEDIA_BASE -> $url"
}

CURRENT_URL=$(grep '^PUBLIC_MEDIA_BASE=' "$ENV_FILE" | cut -d= -f2-)
log "watchdog starting, current url: $CURRENT_URL"

while [ "$(date +%s)" -lt "$END_TIME" ]; do
  backend_up=false
  curl -sf -o /dev/null http://localhost:8000/health && backend_up=true

  tunnel_up=false
  if [ -n "$CURRENT_URL" ]; then
    curl -sf -o /dev/null "$CURRENT_URL/health" && tunnel_up=true
  fi

  if [ "$backend_up" = false ]; then
    log "backend DOWN, restarting"
    start_backend
    sleep 3
  fi

  if [ "$tunnel_up" = false ]; then
    log "tunnel DOWN, restarting"
    new_url=$(start_tunnel)
    if [ -n "$new_url" ] && [ "$new_url" != "$CURRENT_URL" ]; then
      CURRENT_URL="$new_url"
      apply_url "$CURRENT_URL"
      start_backend   # pick up new PUBLIC_MEDIA_BASE
      log "NEW PUBLIC URL: $CURRENT_URL"
    fi
  fi

  sleep 30
done

log "watchdog window elapsed (24h), exiting"
