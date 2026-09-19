#!/usr/bin/env python3
"""
Put a meme on a real Instagram account, for real.

The whole publish path in one runnable file, so you can prove it works before
the backend endpoint exists:

    render the meme -> JPEG
    check Meta can actually reach that image
    POST /{ig-user-id}/media          -> creation_id
    POST /{ig-user-id}/media_publish  -> media_id
    GET  /{media_id}?fields=permalink -> the live link

Needs three values in backend/.env. Put them there yourself - never paste a
token into a chat window, and never into frontend/.env, because anything
VITE_-prefixed is compiled into the browser bundle.

    IG_USER_ID=17841400000000000
    IG_ACCESS_TOKEN=EAAG...
    PUBLIC_MEDIA_BASE=https://xxxx.trycloudflare.com/media

Usage:
    python3 scripts/post_to_instagram.py              # dry run, posts nothing
    python3 scripts/post_to_instagram.py --confirm    # actually publish
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.env import load_dotenv  # noqa: E402

load_dotenv()  # so a key in backend/.env is picked up

GRAPH = "https://graph.facebook.com/v21.0"


def load_env() -> dict:
    env = {}
    f = ROOT / "backend" / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())


def post(url, params):
    data = urllib.parse.urlencode(params).encode()
    with urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=60) as r:
        return json.loads(r.read().decode())


def explain(e):
    try:
        err = json.loads(e.read().decode()).get("error", {})
    except Exception:
        return f"HTTP {e.code}"
    code = err.get("code")
    hints = {
        190: "Token invalid or expired - generate a new long-lived one.",
        200: "Missing permission. Token needs instagram_content_publish, and your account "
             "must hold a role on the app (Instagram Tester, invite accepted).",
        100: "Usually a wrong ig-user-id, or an image_url Meta could not fetch.",
        9007: "Media could not be downloaded. The url must be a publicly reachable JPEG.",
        4: "Rate limited. Instagram allows 50 published posts per 24h.",
    }
    return f"{err.get('message','')} (code {code}). {hints.get(code,'')}".strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--experiment", default="exp_014")
    ap.add_argument("--caption", default=None)
    ap.add_argument("--confirm", action="store_true", help="actually publish")
    args = ap.parse_args()

    env = load_env()
    need = ("IG_USER_ID", "IG_ACCESS_TOKEN", "PUBLIC_MEDIA_BASE")
    missing = [k for k in need if not env.get(k)]

    data = json.loads((ROOT / "frontend" / "src" / "data" / "experiments.json").read_text())
    exp = next((e for e in data if e["id"] == args.experiment), None)
    if not exp:
        print(f"No experiment {args.experiment}")
        return 1

    from app.generate_image import make_meme_image

    path, source = make_meme_image(
        exp["id"],
        exp["content"]["headline"],
        exp["content"]["punchline"],
        exp["content"]["visual_description"],
        exp["genome"].get("topic", ""),
    )
    label = "gemini-generated" if source == "gemini" else "fallback backdrop (no GEMINI_API_KEY)"
    print(f"rendered     {path.name}  ({path.stat().st_size // 1024} KB, 1080x1080)  [{label}]")

    caption = args.caption or exp["content"]["caption"]
    print(f"caption      {caption!r}")

    if missing:
        print()
        print("Not configured yet. Missing from backend/.env: " + ", ".join(missing))
        print()
        print("  1. Instagram app -> Settings -> switch to a Professional (Business) account")
        print("  2. Link it to a Facebook Page")
        print("  3. developers.facebook.com -> Create App (Business) -> add Instagram")
        print("  4. Add your own account as an Instagram Tester, accept the invite")
        print("  5. Graph API Explorer -> token with instagram_basic,")
        print("     instagram_content_publish, pages_show_list, pages_read_engagement")
        print("  6. Put IG_USER_ID and IG_ACCESS_TOKEN in backend/.env")
        print("  7. Expose the media folder:  ./scripts/tunnel.sh")
        print("     then set PUBLIC_MEDIA_BASE to the printed https url + /media")
        return 1

    token, ig_id = env["IG_ACCESS_TOKEN"], env["IG_USER_ID"]
    base = env["PUBLIC_MEDIA_BASE"].rstrip("/")

    try:
        me = get(f"{GRAPH}/{ig_id}?fields=username,followers_count&access_token={token}")
        print(f"account      @{me.get('username')} ({me.get('followers_count','?')} followers)")
    except urllib.error.HTTPError as e:
        print(f"account      FAILED: {explain(e)}")
        return 1

    media_url = f"{base}/{path.name}"
    try:
        req = urllib.request.Request(media_url, method="HEAD")
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"media url    {media_url}  [reachable, {r.headers.get('Content-Type')}]")
    except Exception as err:
        print(f"media url    {media_url}")
        print(f"             NOT REACHABLE ({err})")
        print("             Meta fetches this from their own servers, so localhost fails.")
        print("             Run ./scripts/tunnel.sh and update PUBLIC_MEDIA_BASE.")
        return 1

    if not args.confirm:
        print()
        print("Dry run - nothing was posted. Everything above checks out.")
        print(f"To publish for real:")
        print(f"  ./backend/.venv/bin/python scripts/post_to_instagram.py "
              f"--experiment {args.experiment} --confirm")
        return 0

    print()
    print("publishing...")
    try:
        container = post(f"{GRAPH}/{ig_id}/media",
                         {"image_url": media_url, "caption": caption, "access_token": token})
        cid = container["id"]
        print(f"  container  {cid}")
        for _ in range(10):
            st = get(f"{GRAPH}/{cid}?fields=status_code&access_token={token}")
            if st.get("status_code") == "FINISHED":
                break
            if st.get("status_code") == "ERROR":
                print("  container failed to process")
                return 1
            time.sleep(2)
        pub = post(f"{GRAPH}/{ig_id}/media_publish",
                   {"creation_id": cid, "access_token": token})
        media_id = pub["id"]
        link = get(f"{GRAPH}/{media_id}?fields=permalink&access_token={token}")
    except urllib.error.HTTPError as e:
        print(f"  FAILED: {explain(e)}")
        return 1

    print()
    print(f"LIVE   {link.get('permalink')}")
    print(f"media  {media_id}")
    print()
    print("Record it against the experiment so the agent can learn from it:")
    print(f"  curl -X POST localhost:8000/experiments/{exp['id']}/deploy \\")
    print(f"    -H 'Content-Type: application/json' \\")
    print(f"    -d '{{\"post_id\":\"{media_id}\",\"platform\":\"instagram\"}}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
