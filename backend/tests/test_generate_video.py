"""
Veo generation is async (poll an Operation), slow (up to several minutes),
and costs real money per call -- none of that is safe to exercise against
the real API in a test suite. These tests fake `genai.Client` so the
polling/fallback/error-handling logic is verified without a network call,
a real API key, or any cost.
"""

from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("google.genai")

from app import generate_video as gv


class _FakeVideoFile:
    """Stands in for the File object Veo returns; only its identity matters
    here since our fake `files.download` writes canned bytes regardless."""


class _FakeGeneratedVideo:
    def __init__(self):
        self.video = _FakeVideoFile()


class _FakeResponse:
    def __init__(self, videos):
        self.generated_videos = videos


class _FakeOperation:
    def __init__(self, done=True, response=None, error=None):
        self.done = done
        self.response = response
        self.error = error


class _FakeModels:
    def __init__(self, operation):
        self._operation = operation
        self.calls = []

    def generate_videos(self, **kwargs):
        self.calls.append(kwargs)
        return self._operation


class _FakeOperations:
    def __init__(self, poll_sequence):
        # Each call to .get() returns the next operation in the sequence,
        # repeating the last one if called more times than provided.
        self._sequence = list(poll_sequence)

    def get(self, _operation):
        if len(self._sequence) > 1:
            return self._sequence.pop(0)
        return self._sequence[0]


class _FakeFiles:
    def __init__(self, payload: bytes = b"FAKE-MP4-BYTES"):
        self.payload = payload
        self.downloaded_to: list[str] = []

    def download(self, file, destination):
        self.downloaded_to.append(destination)
        Path(destination).write_bytes(self.payload)


class _FakeClient:
    def __init__(self, operation, poll_sequence=None):
        self.models = _FakeModels(operation)
        self.operations = _FakeOperations(poll_sequence or [operation])
        self.files = _FakeFiles()


def _patch_client(monkeypatch, client):
    from google import genai

    monkeypatch.setattr(genai, "Client", lambda api_key=None: client)


def test_generate_video_returns_none_without_a_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert gv.generate_video("a prompt", Path("unused.mp4"), api_key=None) is None


def test_generate_video_downloads_on_immediate_success(monkeypatch, tmp_path):
    operation = _FakeOperation(done=True, response=_FakeResponse([_FakeGeneratedVideo()]))
    client = _FakeClient(operation)
    _patch_client(monkeypatch, client)

    out_path = tmp_path / "out.mp4"
    result = gv.generate_video("a prompt", out_path, api_key="fake-key")

    assert result == out_path
    assert out_path.exists()
    assert client.models.calls, "generate_videos was never called"


def test_generate_video_polls_until_done(monkeypatch, tmp_path):
    pending = _FakeOperation(done=False)
    finished = _FakeOperation(done=True, response=_FakeResponse([_FakeGeneratedVideo()]))
    client = _FakeClient(pending, poll_sequence=[pending, finished])
    _patch_client(monkeypatch, client)
    monkeypatch.setattr(gv.time, "sleep", lambda _seconds: None)  # skip real waiting

    out_path = tmp_path / "out.mp4"
    result = gv.generate_video("a prompt", out_path, api_key="fake-key", poll_interval=1, max_wait=10)

    assert result == out_path


def test_generate_video_gives_up_after_max_wait(monkeypatch, tmp_path):
    pending = _FakeOperation(done=False)
    client = _FakeClient(pending, poll_sequence=[pending])  # never finishes
    _patch_client(monkeypatch, client)
    monkeypatch.setattr(gv.time, "sleep", lambda _seconds: None)

    result = gv.generate_video(
        "a prompt", tmp_path / "out.mp4", api_key="fake-key", poll_interval=5, max_wait=12
    )
    assert result is None


def test_generate_video_returns_none_on_operation_error(monkeypatch, tmp_path):
    operation = _FakeOperation(done=True, error="content policy violation")
    _patch_client(monkeypatch, _FakeClient(operation))

    assert gv.generate_video("a prompt", tmp_path / "out.mp4", api_key="fake-key") is None


def test_generate_video_returns_none_when_no_videos_come_back(monkeypatch, tmp_path):
    # e.g. a safety-filter block: done, no error, but nothing generated.
    operation = _FakeOperation(done=True, response=_FakeResponse([]))
    _patch_client(monkeypatch, _FakeClient(operation))

    assert gv.generate_video("a prompt", tmp_path / "out.mp4", api_key="fake-key") is None


def test_generate_video_never_raises_on_client_error(monkeypatch, tmp_path):
    from google import genai

    def _boom(api_key=None):
        raise RuntimeError("network exploded")

    monkeypatch.setattr(genai, "Client", _boom)
    assert gv.generate_video("a prompt", tmp_path / "out.mp4", api_key="fake-key") is None


def test_build_video_prompt_includes_topic_and_style():
    prompt = gv.build_video_prompt("a student staring at a laptop", topic="finals_week")
    assert "a student staring at a laptop" in prompt
    assert "finals week" in prompt  # underscores humanized
    assert "phone camera" in prompt  # STYLE guidance present


def test_make_meme_video_uses_veo_when_it_succeeds(monkeypatch, tmp_path):
    operation = _FakeOperation(done=True, response=_FakeResponse([_FakeGeneratedVideo()]))
    _patch_client(monkeypatch, _FakeClient(operation))
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    overlaid = []

    def _fake_overlay(src, dst, headline, punchline=None, **kwargs):
        overlaid.append((src, dst, headline, punchline))
        Path(dst).write_bytes(b"CAPTIONED")
        return dst

    monkeypatch.setattr("app.render.overlay_text_on_video", _fake_overlay)

    path, source = gv.make_meme_video(
        "exp_video_001", "a headline", "a punchline", "a visual description", "college",
        out_dir=tmp_path,
    )

    assert source == "veo"
    assert path.exists()
    assert overlaid, "overlay_text_on_video was never called on the Veo output"


def test_make_meme_video_falls_back_when_veo_unavailable(monkeypatch, tmp_path):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)  # generate_video short-circuits to None

    def _fake_make_meme_image(experiment_id, headline, punchline, visual_description, topic, out_dir=None):
        path = Path(out_dir) / f"{experiment_id}.jpg"
        path.write_bytes(b"FAKE JPEG")
        return path, "fallback"

    def _fake_image_to_video(image_path, out_path=None, **kwargs):
        Path(out_path).write_bytes(b"FAKE MP4 FROM IMAGE")
        return out_path

    monkeypatch.setattr("app.generate_image.make_meme_image", _fake_make_meme_image)
    monkeypatch.setattr("app.render.image_to_video", _fake_image_to_video)

    path, source = gv.make_meme_video(
        "exp_video_002", "a headline", "a punchline", "a visual description", "college",
        out_dir=tmp_path,
    )

    assert source == "fallback"
    assert path.exists()


def test_make_meme_video_falls_back_when_overlay_fails(monkeypatch, tmp_path):
    operation = _FakeOperation(done=True, response=_FakeResponse([_FakeGeneratedVideo()]))
    _patch_client(monkeypatch, _FakeClient(operation))
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    def _broken_overlay(*args, **kwargs):
        raise RuntimeError("ffmpeg exploded")

    def _fake_make_meme_image(experiment_id, headline, punchline, visual_description, topic, out_dir=None):
        path = Path(out_dir) / f"{experiment_id}.jpg"
        path.write_bytes(b"FAKE JPEG")
        return path, "gemini"

    def _fake_image_to_video(image_path, out_path=None, **kwargs):
        Path(out_path).write_bytes(b"FAKE MP4 FROM IMAGE")
        return out_path

    monkeypatch.setattr("app.render.overlay_text_on_video", _broken_overlay)
    monkeypatch.setattr("app.generate_image.make_meme_image", _fake_make_meme_image)
    monkeypatch.setattr("app.render.image_to_video", _fake_image_to_video)

    path, source = gv.make_meme_video(
        "exp_video_003", "a headline", "a punchline", "a visual description", "college",
        out_dir=tmp_path,
    )

    # Veo produced a video, but the caption overlay failed -- this should
    # still degrade to the image pipeline rather than post an uncaptioned video.
    assert source == "image-wrapped"
    assert path.exists()
