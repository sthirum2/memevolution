"""
TikTok's content-posting API only exposes a video upload route (see
publish.py's _upload_tiktok), which sends the file with Content-Type
video/mp4. Before image_to_video existed, that route was handed the raw
rendered JPEG under that label -- not a real video, and TikTok would
reject or mangle it. These tests pin down that the wrapper actually
produces a valid, TikTok-shaped video file, not just non-empty bytes.
"""

from __future__ import annotations

import subprocess

import pytest

pytest.importorskip("imageio_ffmpeg")

from app.render import image_to_video, render_meme


@pytest.fixture
def rendered_jpg(tmp_path):
    return render_meme("test_video_wrap", "a completely normal headline", "a punchline", out_dir=tmp_path)


def test_image_to_video_produces_a_real_mp4_file(rendered_jpg, tmp_path):
    video_path = image_to_video(rendered_jpg, out_path=tmp_path / "out.mp4")

    assert video_path.exists()
    assert video_path.stat().st_size > 0
    # MP4 files carry an "ftyp" box near the start of the file, regardless
    # of container brand -- a cheap, dependency-free sanity check that this
    # isn't just the JPEG bytes renamed.
    assert b"ftyp" in video_path.read_bytes()[:64]


def test_image_to_video_has_a_video_and_audio_stream(rendered_jpg, tmp_path):
    import imageio_ffmpeg

    video_path = image_to_video(rendered_jpg, out_path=tmp_path / "out.mp4")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    result = subprocess.run([ffmpeg, "-i", str(video_path)], capture_output=True, text=True)

    # ffmpeg reports stream info on stderr even when no output file is given.
    assert "Video: h264" in result.stderr
    assert "Audio: aac" in result.stderr
    assert "1080x1080" in result.stderr


def test_image_to_video_respects_duration(rendered_jpg, tmp_path):
    video_path = image_to_video(rendered_jpg, out_path=tmp_path / "out.mp4", duration=2.0)

    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    result = subprocess.run([ffmpeg, "-i", str(video_path)], capture_output=True, text=True)
    assert "Duration: 00:00:02.0" in result.stderr


def test_image_to_video_raises_on_bad_input(tmp_path):
    bogus = tmp_path / "not_an_image.jpg"
    bogus.write_bytes(b"this is not a real image")

    # ffmpeg spins for a while trying to interpret malformed input rather
    # than failing instantly -- a short timeout here just keeps the test
    # fast; production uses image_to_video's real default (20s).
    with pytest.raises(RuntimeError):
        image_to_video(bogus, out_path=tmp_path / "out.mp4", timeout=3.0)
