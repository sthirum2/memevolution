"""
Load backend/.env into the process environment.

The API itself reads .env through pydantic-settings, but the standalone
scripts and the Gemini clients read os.environ directly — so a key pasted into
backend/.env would be silently ignored by them. Calling load_dotenv() at the
top of a script makes the obvious thing work: put the key in the file, and
everything picks it up.

Real values already set in the shell win, so `GEMINI_API_KEY=... python ...`
still overrides the file.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def load_dotenv(path: Path | None = None, override: bool = False) -> dict[str, str]:
    """Parse KEY=value lines into os.environ. Returns what it loaded."""
    path = path or ENV_FILE
    loaded: dict[str, str] = {}
    if not path.exists():
        return loaded

    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not key or (not override and key in os.environ):
            continue
        os.environ[key] = value
        loaded[key] = value
    return loaded
