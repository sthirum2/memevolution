#!/bin/bash
# Keeps the backend + public tunnel alive for 24 hours.
# Restarts either process if it dies, and re-points PUBLIC_MEDIA_BASE /
# restarts the backend automatically if the tunnel URL ever changes.

set -u
cd "$(dirname "$0")/.."   # backend/

ENV_FILE=".env"
BACKEND_LOG="/tmp/backend.log"
TUNNEL_LOG="/tmp/cloudflared.log"
END_TIME=$(( $(date +%s) + 86400 ))  # 24 hours from now

# Logs go to stderr so they never contaminate $(command substitution).
log() { echo "[$(date '+%H:%M:%S')] $*" >&2; }

start_backend() {
  pkill -f "uvicorn app.main:app" 2>/dev/null
  sleep 1
  source .venv/bin/activate
  nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$BACKEND_LOG" 2>&1 &
  log "backend (re)started"
}

# Prints ONLY the URL on stdout. All chatter goes to stderr via log().
start_tunnel() {
  pkill -f "cloudflared tunnel" 2>/dev/null
  sleep 2
  : > "$TUNNEL_LOG"
  nohup cloudflared tunnel --url http://localhost:8000 > "$TUNNEL_LOG" 2>&1 &
  log "tunnel (re)started"
  local url=""
  for _ in $(seq 1 20); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
    [ -n "$url" ] && break
    sleep 1
  done
  [ -z "$url" ] && { log "ERROR: tunnel reported no URL"; return 1; }
  printf '%s' "$url"
}

apply_url() {
  local url="$1"
  sed -i '' "s|^PUBLIC_MEDIA_BASE=.*|PUBLIC_MEDIA_BASE=${url}|" "$ENV_FILE"
  log "PUBLIC_MEDIA_BASE -> $url"
}

CURRENT_URL=$(grep '^PUBLIC_MEDIA_BASE=' "$ENV_FILE" | cut -d= -f2-)
log "watchdog starting, current url: $CURRENT_URL"

# A single transient blip should not burn the URL. Only rebuild the tunnel
# after it fails repeatedly, or when the process is actually gone.
strikes=0

while [ "$(date +%s)" -lt "$END_TIME" ]; do
  if ! curl -sf -o /dev/null --max-time 10 http://localhost:8000/health; then
    log "backend DOWN, restarting"
    start_backend
    sleep 3
  fi

  tunnel_proc_alive=false
  pgrep -f "cloudflared tunnel" > /dev/null && tunnel_proc_alive=true

  tunnel_reachable=false
  if [ -n "$CURRENT_URL" ] && curl -sf -o /dev/null --max-time 15 "$CURRENT_URL/health"; then
    tunnel_reachable=true
  fi

  if [ "$tunnel_reachable" = true ]; then
    strikes=0
  else
    if [ "$tunnel_proc_alive" = false ]; then
      strikes=3           # process is gone; no point waiting
    else
      strikes=$((strikes + 1))
      log "tunnel unreachable (strike $strikes/3)"
    fi

    if [ "$strikes" -ge 3 ]; then
      new_url=$(start_tunnel) || { sleep 30; continue; }
      if [ -n "$new_url" ] && [ "$new_url" != "$CURRENT_URL" ]; then
        CURRENT_URL="$new_url"
        apply_url "$CURRENT_URL"
        start_backend   # pick up new PUBLIC_MEDIA_BASE
        log "NEW PUBLIC URL: $CURRENT_URL"
      fi
      strikes=0
    fi
  fi

  sleep 30
done

log "watchdog window elapsed (24h), exiting"
