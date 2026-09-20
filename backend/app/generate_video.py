"""Optional video-generation utility. The Instagram application publishes reviewed still images."""

from __future__ import annotations

import os
import time
from pathlib import Path

from .render import OUT_DIR

from .env import load_dotenv

load_dotenv()  # so a key in backend/.env is picked up

DEFAULT_MODEL = "veo-3.1-lite-generate-preview"
VERTEX_MODEL = "veo-3.1-lite-generate-001"  # the Vertex ID; "-preview" 404s there

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


def build_video_prompt(
    visual_description: str,
    topic: str = "",
    extra: str = "",
    audio_description: str = "",
    layered_audio: bool = False,
) -> str:
    parts = [visual_description.strip()]
    if topic:
        parts.append(f"Setting: {topic.replace('_', ' ')}.")
    if audio_description and audio_description.strip():
        # Veo 3.x writes its own soundtrack from the prompt. With no audio
        # direction it produces a flat, near-silent room-tone bed (~-40 dBFS),
        # so the concept's audio plan has to be spelled out and made prominent.
        parts.append(
            f"Sound design: {audio_description.strip().rstrip('.')}. Make these sounds "
            "clearly audible and prominent in the mix, not just faint background room tone."
        )
    if layered_audio:
        # A narrator and a music track are mixed on afterwards (render.py);
        # Veo adding its own would fight them.
        parts.append(
            "No background music and no spoken voiceover or dialogue in the "
            "audio: only natural sound effects and ambience."
        )
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
    """Ask Veo for the video. Returns None if it is unavailable, never raises.

    Uses Vertex AI when GOOGLE_GENAI_USE_VERTEXAI is set (billed to the Google
    Cloud project, e.g. its free-trial credit), otherwise the Gemini API key.
    """
    vertex = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in ("1", "true", "yes")
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if vertex and not project:
        print("[video] GOOGLE_GENAI_USE_VERTEXAI is set but GOOGLE_CLOUD_PROJECT is not")
        return None
    if not vertex and not api_key:
        return None

    try:
        from google import genai  # lazy: optional dependency
        from google.genai import types
    except ImportError:
        print("[video] google-genai not installed - pip install google-genai")
        return None

    try:
        if vertex:
            client = genai.Client(
                vertexai=True,
                project=project,
                location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
            )
            # Vertex model IDs differ ("-lite-generate-001", not "-preview"); duration is
            # an int; Veo 3.x needs generate_audio stated explicitly.
            vertex_model = VERTEX_MODEL if model == DEFAULT_MODEL else model
            config = types.GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
                duration_seconds=int(duration_seconds),
                generate_audio=True,
            )
        else:
            client = genai.Client(api_key=api_key)
            vertex_model = model
            config = types.GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                duration_seconds=duration_seconds,
            )
        operation = client.models.generate_videos(model=vertex_model, prompt=prompt, config=config)

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
        video = videos[0].video
        if vertex:
            # Vertex returns the bytes inline; files.download() is Gemini-API-only.
            if not video or not video.video_bytes:
                print("[video] Veo response had no video bytes")
                return None
            out_path.write_bytes(video.video_bytes)
        else:
            client.files.download(file=video, destination=str(out_path))
        return out_path if out_path.exists() else None
    except Exception as exc:  # never let content generation break the loop
        print(f"[video] generation failed ({type(exc).__name__}: {exc})")
        return None


def _add_narration_and_music(
    captioned, final, headline, punchline, narrate, music, music_text, stem,
    make_narration, make_music, narration_fits, mix_audio_onto_video,
) -> None:
    """Mix a voiceover and a music bed onto the captioned video, writing `final`.

    Every step is best-effort: if TTS, music or the mix fails, `final` is just
    the captioned video with Veo's own audio, never nothing.
    """
    narration_path = music_path = None
    spoken = " ".join(t.strip() for t in (headline, punchline) if t and t.strip() and t.strip() != "—")

    if narrate and spoken:
        narration_path = make_narration(spoken, Path(f"{stem}_narration.wav"))
        if narration_path and not narration_fits(narration_path, captioned):
            print("[audio] narration too long for the clip; narrating the headline only")
            narration_path = make_narration(headline, Path(f"{stem}_narration.wav"))
            if narration_path and not narration_fits(narration_path, captioned):
                print("[audio] headline alone is still too long; it will be sped up and may clip")
    if music:
        music_path = make_music(music_text, Path(f"{stem}_music.mp3"))

    try:
        if narration_path or music_path:
            mix_audio_onto_video(captioned, final, narration=narration_path, music=music_path)
            print(f"[audio] mixed: narration={'yes' if narration_path else 'no'} "
                  f"music={'yes' if music_path else 'no'}")
        else:
            captioned.replace(final)
    except Exception as exc:
        print(f"[audio] mix failed ({type(exc).__name__}: {exc}); keeping Veo's own audio")
        captioned.replace(final)
    finally:
        for f in (narration_path, music_path):
            if f:
                Path(f).unlink(missing_ok=True)
        if final.exists():
            captioned.unlink(missing_ok=True)


def make_meme_video(
    experiment_id: str,
    headline: str,
    punchline: str | None,
    visual_description: str,
    topic: str = "",
    out_dir: Path | None = None,
    model: str = DEFAULT_MODEL,
    audio_description: str = "",
    *,
    narrate: bool = True,
    music: bool = True,
    title: str = "",
    humor: str = "",
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
    from .generate_audio import make_music, make_narration, music_prompt
    from .render import mix_audio_onto_video, narration_fits

    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{experiment_id}_raw.mp4"
    final = out_dir / f"{experiment_id}.mp4"

    layered = narrate or music
    got = generate_video(
        build_video_prompt(
            visual_description, topic, audio_description=audio_description, layered_audio=layered
        ),
        raw,
        model=model,
    )
    if got:
        try:
            captioned = out_dir / f"{experiment_id}_captioned.mp4"
            overlay_text_on_video(got, captioned, headline, punchline)
            _add_narration_and_music(
                captioned, final, headline, punchline, narrate, music,
                music_prompt(title, humor, topic), out_dir / f"{experiment_id}_audio",
                make_narration, make_music, narration_fits, mix_audio_onto_video,
            )
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
