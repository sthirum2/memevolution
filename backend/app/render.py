"""
Turn a meme concept into an actual JPEG.

Instagram will not accept SVG and will not accept a description — it fetches a
real image file over HTTP. The frontend's memes are an SVG backdrop plus text
drawn by the browser, which exists nowhere as a file, so this renders the same
thing server-side into something a platform will take.

1080x1080, JPEG, which Instagram takes directly. TikTok's content-posting API
has no photo-post route in play here -- only video inbox-upload (see
publish.py) -- so `image_to_video` below wraps the same JPEG into a real
MP4 for that platform.
"""

from __future__ import annotations

import hashlib
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CANVAS = 1080
MARGIN = 80
OUT_DIR = Path(__file__).resolve().parents[1] / "media"
VIDEO_DURATION_SECONDS = 5.0

# macOS ships these; fall back to Pillow's bundled font so this never hard-fails.
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def _font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def _backdrop(seed: str) -> Image.Image:
    """A deterministic dark backdrop, so the same meme always looks the same."""
    h = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)
    base = (12 + h % 14, 12 + (h >> 4) % 16, 16 + (h >> 8) % 20)
    img = Image.new("RGB", (CANVAS, CANVAS), base)
    d = ImageDraw.Draw(img, "RGBA")

    # Faint concentric arcs + scanlines: reads as a video still rather than a poster.
    for i in range(6):
        r = 200 + i * 130
        d.ellipse(
            [CANVAS // 2 - r, CANVAS - 180 - r, CANVAS // 2 + r, CANVAS - 180 + r],
            outline=(255, 255, 255, max(4, 22 - i * 3)),
            width=2,
        )
    for y in range(0, CANVAS, 4):
        d.line([(0, y), (CANVAS, y)], fill=(255, 255, 255, 5), width=1)
    return img


def _wrap(draw, text: str, font, max_width: int) -> list[str]:
    """Greedy wrap measured against the real font, not a character count."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_caption(img: Image.Image, headline: str, punchline: str | None = None) -> Image.Image:
    """Burn the meme's text onto an image, whoever produced the image.

    Shared by the abstract backdrop below and by AI-generated visuals, so the
    wording is always exactly what the agent chose rather than a model's
    approximation of it.
    """
    d = ImageDraw.Draw(img)
    usable = CANVAS - MARGIN * 2

    # Shrink the headline until it fits in the upper half rather than overflow.
    size = 92
    while size > 34:
        f = _font(size)
        lines = _wrap(d, headline, f, usable)
        if len(lines) * (size + 14) <= CANVAS * 0.46:
            break
        size -= 6
    f = _font(size)
    lines = _wrap(d, headline, f, usable)

    y = int(CANVAS * 0.16)
    for line in lines:
        w = d.textlength(line, font=f)
        x = (CANVAS - w) / 2
        d.text((x + 3, y + 3), line, font=f, fill=(0, 0, 0, 180))  # drop shadow
        d.text((x, y), line, font=f, fill=(255, 255, 255))
        y += size + 14

    if punchline and punchline.strip() and punchline.strip() != "—":
        pf = _font(40)
        plines = _wrap(d, punchline.upper(), pf, usable)
        py = CANVAS - MARGIN - len(plines) * 52
        for line in plines:
            w = d.textlength(line, font=pf)
            x = (CANVAS - w) / 2
            d.text((x + 2, py + 2), line, font=pf, fill=(0, 0, 0, 170))
            d.text((x, py), line, font=pf, fill=(199, 240, 74))  # the acid accent
            py += 52

    return img


def overlay_text(
    src: Path, dst: Path, headline: str, punchline: str | None = None
) -> Path:
    """Composite the caption onto an existing image file (e.g. one Gemini made)."""
    img = Image.open(src).convert("RGB")
    if img.size != (CANVAS, CANVAS):
        # Square-crop from the centre, then scale — feeds are square or taller.
        short = min(img.size)
        left = (img.width - short) // 2
        top = (img.height - short) // 2
        img = img.crop((left, top, left + short, top + short)).resize(
            (CANVAS, CANVAS), Image.LANCZOS
        )
    # Darken slightly so white text stays readable over a busy photo.
    scrim = Image.new("RGB", img.size, (0, 0, 0))
    img = Image.blend(img, scrim, 0.28)

    img = draw_caption(img, headline, punchline)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "JPEG", quality=90, optimize=True)
    return dst


def render_meme(
    experiment_id: str,
    headline: str,
    punchline: str | None = None,
    out_dir: Path | None = None,
) -> Path:
    """Abstract fallback: generated backdrop plus the caption. No API needed."""
    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    img = draw_caption(_backdrop(experiment_id + headline), headline, punchline)
    path = out_dir / f"{experiment_id}.jpg"
    img.convert("RGB").save(path, "JPEG", quality=90, optimize=True)
    return path


def draw_caption_on_canvas(
    width: int,
    height: int,
    headline: str,
    punchline: str | None = None,
    transparent: bool = False,
) -> Image.Image:
    """
    Same caption look as draw_caption() above, generalized to any width and
    height so it can also be composited onto a non-square, non-1080 video
    (Veo's 9:16 output) rather than only the fixed 1080x1080 image canvas.

    transparent=True returns an RGBA image with nothing drawn but the text
    (meant to be overlaid onto video via ffmpeg); draw_caption() itself is
    untouched, so the existing image pipeline is unaffected by this.
    """
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0) if transparent else (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    scale = width / CANVAS
    margin = int(MARGIN * scale)
    usable = width - margin * 2

    size = int(92 * scale)
    min_size = int(34 * scale)
    while size > min_size:
        f = _font(size)
        lines = _wrap(d, headline, f, usable)
        if len(lines) * (size + int(14 * scale)) <= height * 0.46:
            break
        size -= max(1, int(6 * scale))
    f = _font(size)
    lines = _wrap(d, headline, f, usable)

    y = int(height * 0.16)
    for line in lines:
        w = d.textlength(line, font=f)
        x = (width - w) / 2
        d.text((x + 3, y + 3), line, font=f, fill=(0, 0, 0, 180))  # drop shadow
        d.text((x, y), line, font=f, fill=(255, 255, 255, 255))
        y += size + int(14 * scale)

    if punchline and punchline.strip() and punchline.strip() != "—":
        psize = int(40 * scale)
        pf = _font(psize)
        plines = _wrap(d, punchline.upper(), pf, usable)
        line_h = int(52 * scale)
        py = height - margin - len(plines) * line_h
        for line in plines:
            w = d.textlength(line, font=pf)
            x = (width - w) / 2
            d.text((x + 2, py + 2), line, font=pf, fill=(0, 0, 0, 170))
            d.text((x, py), line, font=pf, fill=(199, 240, 74, 255))  # the acid accent
            py += line_h

    return img


def burn_captions_onto_video(
    video_path: Path,
    out_path: Path,
    headline: str,
    punchline: str | None = None,
    timeout: float = 30.0,
) -> Path:
    """
    Overlay the exact headline/punchline text onto an already-generated
    video (Veo's output), the same way overlay_text() burns it onto a still
    image -- so the joke's wording is always exactly what the agent chose,
    never a video model's own (unreliable) text rendering. Veo's prompt
    deliberately asks for no text in the footage; this is the step that
    actually puts the caption there.

    Renders the caption at a fixed 1080x1920 canvas and uses ffmpeg's
    scale2ref filter to resize it to match whatever resolution the source
    video actually came back at, so this doesn't need to probe the video's
    dimensions first.

    Preserves the source video's audio stream untouched (-c:a copy) since
    Veo's videos come with native audio baked into the generation.
    """
    import imageio_ffmpeg

    caption = draw_caption_on_canvas(1080, 1920, headline, punchline, transparent=True)
    caption_png = out_path.with_suffix(".caption.png")
    caption.save(caption_png)

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-i", str(video_path),
        "-loop", "1",
        "-i", str(caption_png),
        "-filter_complex",
        "[1:v][0:v]scale2ref[cap][vid];[vid][cap]overlay=0:0:shortest=1[outv]",
        "-map", "[outv]",
        "-map", "0:a?",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(out_path),
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=timeout
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"ffmpeg timed out overlaying captions on {video_path.name}") from exc
    finally:
        caption_png.unlink(missing_ok=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg could not overlay captions on {video_path.name} "
            f"(exit {result.returncode}): {result.stderr[-500:]}"
        )
    return out_path


def image_to_video(
    image_path: Path,
    out_path: Path | None = None,
    duration: float = VIDEO_DURATION_SECONDS,
    timeout: float = 20.0,
) -> Path:
    """Wrap a still JPEG into a real MP4 for TikTok's video-only upload route.

    TikTok's content-posting API has no photo-post endpoint in this
    integration -- publish.py uploads to the video inbox-upload route and
    labels the body `video/mp4`. Handing it the raw JPEG bytes under that
    label is not a real video and TikTok will reject or mangle it. This
    holds the exact same rendered frame for `duration` seconds instead --
    same visual, same caption, just a container TikTok actually accepts.
    A real generative-video pipeline (Veo, on the same API Role 2 already
    uses) can replace this later without changing anything downstream:
    publish.py only cares that it gets back a valid video file.

    Uses `imageio-ffmpeg`'s bundled static ffmpeg binary rather than
    requiring one on the system PATH, so this doesn't need a platform-
    specific install step for the rest of the team.
    """
    import imageio_ffmpeg

    out_path = out_path or image_path.with_suffix(".mp4")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    cmd = [
        ffmpeg,
        "-y",
        "-loop", "1",
        "-i", str(image_path),
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo",
        "-t", str(duration),
        "-vf", f"scale={CANVAS}:{CANVAS}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        "-movflags", "+faststart",
        str(out_path),
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=timeout
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"ffmpeg timed out converting {image_path.name} to video") from exc
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg could not turn {image_path.name} into a video "
            f"(exit {result.returncode}): {result.stderr[-500:]}"
        )
    return out_path


if __name__ == "__main__":
    p = render_meme(
        "exp_014",
        "financial aid portal speedrun (world record attempt)",
        "RUN VOIDED — SESSION TIMED OUT AT 4:51",
    )
    print(f"wrote {p} ({p.stat().st_size / 1024:.0f} KB)")
