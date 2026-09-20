"""Optional video-generation utility. The Instagram application publishes reviewed still images."""

from __future__ import annotations

import os
import time
from pathlib import Path

from .render import OUT_DIR

from .env import load_dotenv

load_dotenv()  # so a key in backend/.env is picked up

DEFAULT_MODEL = "veo-3.1-lite-generate-preview"

VIDEO_ASPECT_RATIO = "9:16"  # vertical video
VIDEO_RESOLUTION = "720p"  # cheapest tier; lite doesn't support 4k
VIDEO_DURATION_SECONDS = "8"  # Veo only accepts "4", "6" or "8"

POLL_INTERVAL_SECONDS = 10.0
MAX_POLL_SECONDS = 340.0  # ~5.5 min; Google's own stated max is ~6 min at peak

# Same intent as generate_image.py's STYLE, adapted for motion: steer away
# from the house style of AI video, which reads as an ad and is the opposite
# of what makes a meme feel native to a feed.
STYLE = (
    "Shot on a phone camera, handheld with natural small movement, slightly "
    "imperfect framing, available light, candid and unposed, mildly grainy, "
    "looks like a real short-form video someone actually filmed. Not a stock "
    "video, not an advertisement, not an illustration, no on-screen text or "
    "captions or subtitles anywhere in the frame, no watermarks, no logos."
)


def build_video_prompt(visual_description: str, topic: str = "", extra: str = "") -> str:
    parts = [visual_description.strip()]
    if topic:
        parts.append(f"Setting: {topic.replace('_', ' ')}.")
    parts.append(STYLE)
    if extra:
        parts.append(extra)
    return " ".join(p for p in parts if p)


def generate_video(
    prompt: str,
    out_path: Path,
    model: str = DEFAULT_MODEL,
    api_key: str | None = None,
    aspect_ratio: str = VIDEO_ASPECT_RATIO,
    resolution: str = VIDEO_RESOLUTION,
    duration_seconds: str = VIDEO_DURATION_SECONDS,
    poll_interval: float = POLL_INTERVAL_SECONDS,
    max_wait: float = MAX_POLL_SECONDS,
) -> Path | None:
    """Ask Veo for the video. Returns None if it is unavailable, never raises."""
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        from google import genai  # lazy: optional dependency
        from google.genai import types
    except ImportError:
        print("[video] google-genai not installed - pip install google-genai")
        return None

    try:
        client = genai.Client(api_key=api_key)
        operation = client.models.generate_videos(
            model=model,
            prompt=prompt,
            config=types.GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                duration_seconds=duration_seconds,
            ),
        )

        waited = 0.0
        while not operation.done:
            if waited >= max_wait:
                print(
                    f"[video] Veo generation still running after {max_wait:.0f}s; "
                    "giving up for this round and using the image fallback"
                )
                return None
            time.sleep(poll_interval)
            waited += poll_interval
            operation = client.operations.get(operation)

        error = getattr(operation, "error", None)
        if error:
            print(f"[video] Veo generation failed: {error}")
            return None

        response = getattr(operation, "response", None)
        videos = getattr(response, "generated_videos", None) if response else None
        if not videos:
            print("[video] no video came back (often a safety-filter block on the prompt)")
            return None

        out_path.parent.mkdir(parents=True, exist_ok=True)
        client.files.download(file=videos[0].video, destination=str(out_path))
        return out_path if out_path.exists() else None
    except Exception as exc:  # never let content generation break the loop
        print(f"[video] generation failed ({type(exc).__name__}: {exc})")
        return None


def make_meme_video(
    experiment_id: str,
    headline: str,
    punchline: str | None,
    visual_description: str,
    topic: str = "",
    out_dir: Path | None = None,
    model: str = DEFAULT_MODEL,
) -> tuple[Path, str]:
    """
    The whole path for a video-only platform: generate real motion via Veo,
    burn the caption onto every frame, return the file.

    Returns (path, source):
      'veo'           a real Veo-generated video with the caption burned on
      'image-wrapped' Veo was unavailable; a real Gemini-generated image,
                       held as a static video (generate_image.py + image_to_video)
      'fallback'      neither worked; the abstract backdrop, likewise held

    so callers can tell the operator which one they are looking at.
    """
    from .render import image_to_video, overlay_text_on_video

    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{experiment_id}_raw.mp4"
    final = out_dir / f"{experiment_id}.mp4"

    got = generate_video(build_video_prompt(visual_description, topic), raw, model=model)
    if got:
        try:
            overlay_text_on_video(got, final, headline, punchline)
            return final, "veo"
        except Exception as exc:
            print(
                f"[video] caption overlay failed ({type(exc).__name__}: {exc}); "
                "using the image fallback"
            )

    from .generate_image import make_meme_image

    image_path, image_source = make_meme_image(
        experiment_id, headline, punchline, visual_description, topic, out_dir=out_dir
    )
    video_path = image_to_video(image_path, out_path=final)
    return video_path, ("image-wrapped" if image_source == "gemini" else "fallback")
