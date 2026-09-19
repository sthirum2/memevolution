#!/usr/bin/env python3
"""
Generate the picture for a meme, so you can look at it before anything posts.

    python3 scripts/make_image.py exp_006
    python3 scripts/make_image.py exp_006 --model gemini-3.1-flash-lite-image
    python3 scripts/make_image.py --all

With GEMINI_API_KEY set it uses Gemini's image generation and burns the agent's
exact caption on top. Without a key it falls back to the abstract backdrop, so
this always produces something postable.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.generate_image import DEFAULT_MODEL, make_meme_image  # noqa: E402

DATA = ROOT / "frontend" / "src" / "data" / "experiments.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("experiment_id", nargs="?", default="exp_014")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--all", action="store_true", help="every experiment")
    args = ap.parse_args()

    if not os.environ.get("GEMINI_API_KEY"):
        print("GEMINI_API_KEY not set — using the fallback backdrop.")
        print("Get a key at https://aistudio.google.com/apikey, then:")
        print("  export GEMINI_API_KEY=...\n")

    rows = json.loads(DATA.read_text())
    targets = rows if args.all else [e for e in rows if e["id"] == args.experiment_id]
    if not targets:
        print(f"No experiment {args.experiment_id}")
        return 1

    for exp in targets:
        path, source = make_meme_image(
            exp["id"],
            exp["content"]["headline"],
            exp["content"]["punchline"],
            exp["content"]["visual_description"],
            exp["genome"].get("topic", ""),
            model=args.model,
        )
        kb = path.stat().st_size // 1024
        print(f"{exp['id']}  {path}  ({kb} KB)  [{source}]")

    print("\nOpen them:  open backend/media")
    return 0


if __name__ == "__main__":
    sys.exit(main())
