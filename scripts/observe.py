#!/usr/bin/env python3
"""
The bridge Role 2 asked for: real engagement -> fitness -> the agent learns.

    real numbers (Instagram, or typed in by hand)
        -> spread_score()            the one definition, backend/app/fitness.py
        -> POST /experiments/{id}/metrics       so the API and the UI see it
        -> agent.apply_observation()            so beliefs actually move

Why this exists: nothing computed fitness. `Observation.fitness` is expected to
be handed to the agent, and the API stored whatever it was given, so real
engagement arriving produced fitness=None, prediction error stayed undefined,
and the agent could not learn from a real post.

Usage
    # numbers you read off the post yourself
    python3 scripts/observe.py exp_014 --views 4210 --likes 388 \
        --comments 24 --shares 96 --saves 61

    # or pull them from Instagram automatically (needs IG_ACCESS_TOKEN)
    python3 scripts/observe.py exp_014 --from-instagram <media_id>

    --dry-run   compute and show, change nothing
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.fitness import breakdown, spread_score  # noqa: E402

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


def http(url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data)
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else {}


def from_instagram(media_id: str, token: str) -> dict:
    """Ask Instagram what actually happened to the post."""
    base = http(f"{GRAPH}/{media_id}?fields=like_count,comments_count&access_token={token}")
    metrics = {"likes": base.get("like_count", 0), "comments": base.get("comments_count", 0)}
    try:
        ins = http(f"{GRAPH}/{media_id}/insights?metric=reach,saved,shares&access_token={token}")
        for row in ins.get("data", []):
            value = row["values"][0]["value"]
            metrics[{"reach": "views", "saved": "saves", "shares": "shares"}[row["name"]]] = value
    except urllib.error.HTTPError as e:
        print(f"  insights unavailable ({e.code}) — reach/saves/shares need a Business account")
    return metrics


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("experiment_id")
    ap.add_argument("--views", type=int)
    ap.add_argument("--likes", type=int, default=0)
    ap.add_argument("--comments", type=int, default=0)
    ap.add_argument("--shares", type=int, default=0)
    ap.add_argument("--saves", type=int, default=0)
    ap.add_argument("--from-instagram", metavar="MEDIA_ID")
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    env = load_env()

    if args.from_instagram:
        token = env.get("IG_ACCESS_TOKEN")
        if not token:
            print("IG_ACCESS_TOKEN missing from backend/.env")
            return 1
        print(f"pulling real numbers for media {args.from_instagram} …")
        m = from_instagram(args.from_instagram, token)
    else:
        if args.views is None:
            print("Give me --views (and the rest), or --from-instagram MEDIA_ID")
            return 1
        m = {
            "views": args.views,
            "likes": args.likes,
            "comments": args.comments,
            "shares": args.shares,
            "saves": args.saves,
        }

    fitness = spread_score(**m)
    if fitness is None:
        print("No views, so there is nothing to score yet.")
        return 1

    print()
    for k in ("views", "likes", "comments", "shares", "saves"):
        print(f"  {k:9} {m.get(k, 0):>10,}")
    print()
    print(f"  spread score  {round(fitness * 100)} / 100")
    for i in breakdown(**m):
        print(f"      {i.label:9} {i.points:5.1f} / {i.max_points:4.0f}")

    if args.dry_run:
        print("\ndry run — nothing recorded")
        return 0

    # 1. The API, so the database and the UI agree.
    try:
        http(f"{args.api}/experiments/{args.experiment_id}/metrics", {**m, "fitness": fitness})
        print(f"\nrecorded against {args.experiment_id} in the API")
    except urllib.error.HTTPError as e:
        print(f"\nAPI rejected it: {e.code} {e.read().decode()[:200]}")
        return 1
    except urllib.error.URLError:
        print(f"\nBackend not reachable at {args.api} — start it with ./dev.sh")
        return 1

    # 2. The agent, so beliefs actually move. Optional: it lives in its own repo.
    try:
        from memevolution.agent import orchestrator
        from memevolution.models.experiment import Observation
        from memevolution.persistence import json_store

        state = json_store.load_state()
        new_state, exp = orchestrator.apply_observation(
            state, args.experiment_id, Observation(**m, fitness=fitness)
        )
        print("agent updated — beliefs moved on this result")
        err = exp.prediction_error if hasattr(exp, "prediction_error") else None
        if err is not None:
            print(f"  prediction error {err:+.2f}")
    except ImportError:
        print("agent package not installed here — record it on that side with:")
        print(f"  python -m memevolution observe {args.experiment_id} \\")
        print(f"      --views {m.get('views',0)} --likes {m.get('likes',0)} "
              f"--comments {m.get('comments',0)} \\")
        print(f"      --shares {m.get('shares',0)} --saves {m.get('saves',0)} "
              f"--fitness {fitness}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
