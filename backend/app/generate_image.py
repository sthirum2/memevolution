"""
Turn a meme concept into an actual generated image.

Uses Gemini's native image generation ("Nano Banana"), which matters for a
practical reason: Role 2 already wired `google-genai` and already needs a
GEMINI_API_KEY for writing concepts. Image generation runs through the same
SDK and the same key, so this adds no new account, no new billing, no new
dependency.

Two notes on the current API, both of which break older tutorials:

  * Imagen is shut down and gone from the Gemini API. `client.models
    .generate_images(...)` no longer exists. Image generation now goes through
    `generate_content`, and the image comes back as inline data on a content
    part rather than in a dedicated response object.
  * Model ids are gemini-3.1-flash-image (the generalist) and
    gemini-3.1-flash-lite-image (faster and cheaper).

Design choice: the model generates the *visual* and Pillow burns the caption on
afterwards. Image models are decent at text now, but a meme's text has to be
exactly the words the agent chose - not an approximation of them - so the text
is composited rather than prompted.

Falls back to the abstract backdrop in render.py when no key is configured, so
the demo never breaks on a missing credential.
"""

from __future__ import annotations

import os
from pathlib import Path

from .render import OUT_DIR, overlay_text

from .env import load_dotenv

load_dotenv()  # so a key in backend/.env is picked up

DEFAULT_MODEL = "gemini-3.1-flash-image"

# Steer away from the house style of AI images, which reads as stock art and is
# the opposite of what makes a meme feel native to a feed.
STYLE = (
    "Shot on a phone camera, slightly imperfect framing, natural available light, "
    "candid and unposed, mildly grainy, looks like a real video still someone "
    "actually filmed. Not a stock photo, not a poster, not an illustration, no "
    "text or captions anywhere in the image, no watermarks, no logos."
)


def build_prompt(visual_description: str, topic: str = "", extra: str = "") -> str:
    parts = [visual_description.strip()]
    if topic:
        parts.append(f"Setting: {topic.replace('_', ' ')}.")
    parts.append(STYLE)
    if extra:
        parts.append(extra)
    return " ".join(p for p in parts if p)


def generate_visual(
    prompt: str,
    out_path: Path,
    model: str = DEFAULT_MODEL,
    api_key: str | None = None,
) -> Path | None:
    """Ask Gemini for the image. Returns None if it is unavailable, never raises."""
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        from google import genai  # lazy: optional dependency
    except ImportError:
        print("[image] google-genai not installed - pip install google-genai")
        return None

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=model, contents=prompt)

        # The image arrives as inline data on a part, not as a dedicated field.
        for candidate in getattr(response, "candidates", []) or []:
            for part in getattr(candidate.content, "parts", []) or []:
                blob = getattr(part, "inline_data", None)
                if blob and getattr(blob, "data", None):
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    out_path.write_bytes(blob.data)
                    return out_path

        text = getattr(response, "text", None)
        print(f"[image] no image part came back{f': {text[:160]}' if text else ''}")
        return None
    except Exception as exc:  # never let content generation break the loop
        print(f"[image] generation failed ({type(exc).__name__}: {exc})")
        return None


def make_meme_image(
    experiment_id: str,
    headline: str,
    punchline: str | None,
    visual_description: str,
    topic: str = "",
    out_dir: Path | None = None,
    model: str = DEFAULT_MODEL,
) -> tuple[Path, str]:
    """
    The whole path: generate the visual, burn the caption on, return the file.

    Returns (path, source) where source is 'gemini' or 'fallback', so callers
    can tell the operator which one they are looking at.
    """
    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{experiment_id}_raw.png"

    got = generate_visual(build_prompt(visual_description, topic), raw, model=model)
    final = out_dir / f"{experiment_id}.jpg"

    if got:
        overlay_text(got, final, headline, punchline)
        return final, "gemini"

    from .render import render_meme

    return render_meme(experiment_id, headline, punchline, out_dir=out_dir), "fallback"
