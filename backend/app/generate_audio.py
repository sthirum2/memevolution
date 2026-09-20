"""
Narration and background music for the meme video, via the Gemini API.

Veo writes its own soundtrack, but it cannot be trusted to speak the exact
words the agent chose (it garbles on-screen text the same way), and it does
not reliably produce music. So the two things that have to be right are made
by models that are good at them, then mixed onto the video in render.py:

  * narration -- Gemini TTS reads the exact headline/punchline aloud
  * music     -- Lyria generates an instrumental bed for the concept's mood

Same GEMINI_API_KEY as everything else here. Both functions return None on
any failure and never raise, same contract as generate_video.py, so a flaky
audio call degrades to a video with just Veo's own sound instead of no video.
"""

from __future__ import annotations

import os
import wave
from pathlib import Path

from .env import load_dotenv

load_dotenv()

TTS_MODEL = "gemini-2.5-flash-preview-tts"
TTS_VOICE = "Puck"
TTS_SAMPLE_RATE = 24000  # Gemini TTS returns raw 16-bit mono PCM at 24 kHz
MUSIC_MODEL = "lyria-3-clip-preview"


def _client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
    except ImportError:
        print("[audio] google-genai not installed - pip install google-genai")
        return None
    return genai.Client(api_key=api_key)


def make_narration(text: str, out_path: Path, voice: str = TTS_VOICE) -> Path | None:
    """Speak `text` exactly as written. Returns a WAV path, or None."""
    if not text or not text.strip():
        return None
    client = _client()
    if client is None:
        return None
    try:
        from google.genai import types

        response = client.models.generate_content(
            model=TTS_MODEL,
            # The instruction sets the delivery only; the words are the agent's.
            contents=(
                "Read this aloud exactly as written, as a deadpan, mildly amused "
                f"short-video narrator, at a brisk pace: {text.strip()}"
            ),
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                    )
                ),
            ),
        )
        pcm = response.candidates[0].content.parts[0].inline_data.data
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(out_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(TTS_SAMPLE_RATE)
            w.writeframes(pcm)
        return out_path
    except Exception as exc:  # never let audio break the video
        print(f"[audio] narration failed ({type(exc).__name__}: {exc})")
        return None


def make_music(prompt: str, out_path: Path) -> Path | None:
    """Generate an instrumental clip (~30s MP3) from a mood prompt. None on failure."""
    client = _client()
    if client is None:
        return None
    try:
        from google.genai import types

        response = client.models.generate_content(
            model=MUSIC_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_modalities=["AUDIO", "TEXT"]),
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(part.inline_data.data)
                return out_path
        print("[audio] music model returned no audio")
        return None
    except Exception as exc:
        print(f"[audio] music failed ({type(exc).__name__}: {exc})")
        return None


def music_prompt(title: str = "", humor: str = "", topic: str = "") -> str:
    mood = f" Mood: {humor.replace('_', ' ')}." if humor else ""
    about = f" It accompanies a funny short video about: {title}." if title else ""
    setting = f" Setting: {topic.replace('_', ' ')}." if topic else ""
    return (
        "A short, upbeat, playful instrumental background track for a viral "
        f"short-form comedy video.{about}{setting}{mood} Light bouncy beat, no vocals, "
        "no spoken words, steady and unobtrusive so a voiceover can sit on top of it."
    )
