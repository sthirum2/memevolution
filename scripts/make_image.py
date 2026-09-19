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

from app.env import load_dotenv  # noqa: E402

load_dotenv()  # so a key in backend/.env is picked up

from app.generate_image import DEFAULT_MODEL, make_meme_image  # noqa: E402

DEMO_DATA = ROOT / "frontend" / "src" / "data" / "experiments.json"

# Where the agent writes what it actually generated. Its repo is separate, so
# point at it with MEMEVOLUTION_AGENT_DATA or --agent-data.
AGENT_DATA_ENV = "MEMEVOLUTION_AGENT_DATA"


def load_demo() -> list[dict]:
    return json.loads(DEMO_DATA.read_text())


def load_agent(path: Path) -> list[dict]:
    """Map the agent's own records onto the shape the renderer wants.

    The agent stores a MemeConcept (title/opening/visual/punchline/caption).
    The text burned onto a meme is the *opening* - that is the hook a viewer
    reads - not the title, which is only an internal name for the concept.
    """
    rows = json.loads(path.read_text())
    if isinstance(rows, dict):
        rows = list(rows.values())

    out = []
    for r in rows:
        concept = r.get("concept") or {}
        if not concept:
            continue
        out.append({
            "id": r["id"],
            "genome": r.get("genome", {}),
            "content": {
                "headline": concept.get("opening") or concept.get("title", ""),
                "punchline": concept.get("punchline", ""),
                "visual_description": concept.get("visual", ""),
                "caption": concept.get("caption", ""),
            },
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("experiment_id", nargs="?", default="exp_014")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--all", action="store_true", help="every experiment")
    ap.add_argument(
        "--from-agent",
        action="store_true",
        help="use what the agent actually generated, not the demo memes",
    )
    ap.add_argument("--agent-data", help="path to the agent's experiments.json")
    args = ap.parse_args()

    if not os.environ.get("GEMINI_API_KEY"):
        print("GEMINI_API_KEY not set - using the fallback backdrop.")
        print("Get a key at https://aistudio.google.com/apikey, then:")
        print("  export GEMINI_API_KEY=...\n")

    if args.from_agent or args.agent_data:
        raw = args.agent_data or os.environ.get(AGENT_DATA_ENV)
        if not raw:
            print("Point me at the agent's data:")
            print("  --agent-data /path/to/memevolution_agent/data/experiments.json")
            print(f"  or export {AGENT_DATA_ENV}=...")
            return 1
        path = Path(raw).expanduser()
        if not path.exists():
            print(f"No such file: {path}")
            return 1
        rows = load_agent(path)
        print(f"using the agent's own concepts ({len(rows)} with content) from {path}\n")
        if not rows:
            print("The agent has not generated any concepts yet. Run:")
            print("  python -m memevolution generate")
            return 1
    else:
        rows = load_demo()
        print("using the demo memes. For what the agent actually wrote, add --from-agent\n")

    targets = rows if args.all else [e for e in rows if e["id"] == args.experiment_id]
    if not targets:
        print(f"No experiment {args.experiment_id} in that set.")
        print("Available: " + ", ".join(e["id"] for e in rows[:8]))
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
