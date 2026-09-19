#!/usr/bin/env python3
"""
Load the frontend's demo data into the real backend.

Without this the integrated app is three blank screens: the backend starts with
an empty database, so there is nothing for the UI to draw. This walks the same
21 experiments the frontend ships as mock data through the backend's real API
(create -> prediction -> deploy -> metrics), so `VITE_USE_MOCK=false` shows a
populated, believable app.

    python3 scripts/seed_backend.py                       # localhost:8000
    python3 scripts/seed_backend.py --api http://host:8000
    python3 scripts/seed_backend.py --reset               # skip existing ids

Safe to re-run: experiments that already exist are skipped.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend" / "src" / "data" / "experiments.json"


def call(api: str, path: str, method: str = "GET", body: dict | None = None):
    url = f"{api.rstrip('/')}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:300]
        raise RuntimeError(f"{method} {path} -> {e.code} {detail}") from None
    except urllib.error.URLError as e:
        raise SystemExit(
            f"Cannot reach the backend at {api} ({e.reason}).\n"
            f"Start it first:  cd backend && ./.venv/bin/uvicorn app.main:app --port 8000"
        ) from None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    args = ap.parse_args()

    if not DATA.exists():
        raise SystemExit(f"Demo data not found at {DATA}")

    call(args.api, "/health")
    existing = {e["id"] for e in (call(args.api, "/experiments") or [])}
    rows = json.loads(DATA.read_text())

    created = skipped = 0
    for exp in rows:
        if exp["id"] in existing:
            skipped += 1
            continue

        g = exp["genome"]
        call(
            args.api,
            "/experiments",
            "POST",
            {
                "id": exp["id"],
                "generation": exp["generation"],
                "parent_id": exp["parent_id"],
                "status": exp["status"],
                # The backend stores a narrower genome than the frontend shows;
                # the extra traits (text_density, caption_length, audio_strategy)
                # have no column yet. See INTEGRATION.md.
                "genome": {
                    "topic": g["topic"],
                    "humor": g["humor"],
                    "format": g["format"],
                    "hook": g["hook"],
                    "absurdity": g["absurdity"],
                    "irony": g["irony"],
                    "relatability": g["relatability"],
                    "trend_relevance": g["trend_relevance"],
                    "video_length": max(1, g["video_length"]),
                },
                "mutations": [
                    {"trait": m["trait"], "from": m["from"], "to": m["to"]}
                    for m in exp["mutations"]
                ],
                "hypothesis": exp["hypothesis"],
            },
        )

        if exp["prediction"]["fitness"]:
            call(
                args.api,
                f"/experiments/{exp['id']}/prediction",
                "POST",
                {"fitness": exp["prediction"]["fitness"], "model_version": "seed-v1"},
            )

        dep = exp["deployment"]
        if dep["post_id"]:
            call(
                args.api,
                f"/experiments/{exp['id']}/deploy",
                "POST",
                {
                    "post_id": dep["post_id"],
                    "platform": dep["platform"] or "tiktok",
                    "timestamp": dep["timestamp"],
                },
            )

        obs = exp["observed"]
        if obs["views"] is not None:
            call(
                args.api,
                f"/experiments/{exp['id']}/metrics",
                "POST",
                {
                    "views": obs["views"],
                    "likes": obs["likes"],
                    "comments": obs["comments"],
                    "shares": obs["shares"],
                    "saves": obs["saves"],
                    "fitness": obs["fitness"],
                },
            )

        created += 1
        print(f"  seeded {exp['id']}")

    print(f"\ndone — {created} created, {skipped} already there")
    print(f"check it:  curl {args.api}/experiments | head -c 300")
    return 0


if __name__ == "__main__":
    sys.exit(main())
