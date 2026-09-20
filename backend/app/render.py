"""Render image assets and optionally encode a still frame as a video."""

from __future__ import annotations

import hashlib
import re
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


def image_to_video(
    image_path: Path,
    out_path: Path | None = None,
    duration: float = VIDEO_DURATION_SECONDS,
    timeout: float = 20.0,
) -> Path:
    """Encode a still JPEG as MP4 for standalone media tools."""
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


def _video_caption_overlay(width: int, height: int, headline: str, punchline: str | None) -> Image.Image:
    """A transparent frame the same size as the video, with the caption burned
    on -- composited over every frame via ffmpeg's overlay filter below.

    Reuses the same layout language as draw_caption() (headline near the top,
    punchline near the bottom, white with a drop shadow and an acid-green
    punchline) but parameterized by the actual frame size instead of the
    fixed square CANVAS, since real video comes back at whatever aspect
    ratio/resolution was requested from Veo.
    """
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = int(width * 0.08)
    usable = width - margin * 2

    size = int(height * 0.075)
    min_size = max(18, int(height * 0.03))
    while size > min_size:
        f = _font(size)
        lines = _wrap(d, headline, f, usable)
        if len(lines) * int(size * 1.15) <= height * 0.3:
            break
        size -= 4
    f = _font(size)
    lines = _wrap(d, headline, f, usable)

    y = int(height * 0.10)
    line_h = int(size * 1.15)
    for line in lines:
        w = d.textlength(line, font=f)
        x = (width - w) / 2
        d.text((x + 3, y + 3), line, font=f, fill=(0, 0, 0, 200))
        d.text((x, y), line, font=f, fill=(255, 255, 255, 255))
        y += line_h

    if punchline and punchline.strip() and punchline.strip() != "—":
        p_size = max(16, int(height * 0.033))
        pf = _font(p_size)
        plines = _wrap(d, punchline.upper(), pf, usable)
        p_line_h = int(p_size * 1.4)
        py = height - margin - len(plines) * p_line_h
        for line in plines:
            w = d.textlength(line, font=pf)
            x = (width - w) / 2
            d.text((x + 2, py + 2), line, font=pf, fill=(0, 0, 0, 190))
            d.text((x, py), line, font=pf, fill=(199, 240, 74, 255))
            py += p_line_h

    return img


def _probe_video_size(path: Path, ffmpeg: str, timeout: float = 15.0) -> tuple[int, int]:
    """ffmpeg -i prints stream info (including WxH) to stderr even with no
    output file; parsing that avoids a separate ffprobe dependency."""
    result = subprocess.run(
        [ffmpeg, "-i", str(path)],
        capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=timeout,
    )
    match = re.search(r"(\d{2,5})x(\d{2,5})", result.stderr)
    if not match:
        raise RuntimeError(f"could not determine video dimensions for {path.name}")
    return int(match.group(1)), int(match.group(2))


def overlay_text_on_video(
    src: Path,
    dst: Path,
    headline: str,
    punchline: str | None = None,
    timeout: float = 60.0,
) -> Path:
    """Burn the caption onto every frame of a real video.

    Renders the caption once as a transparent PNG (via _video_caption_overlay)
    and composites it with ffmpeg's `overlay` filter, rather than fighting
    ffmpeg drawtext's escaping rules for arbitrary meme text -- quotes,
    colons, emoji all just work as pixels this way. The video's own audio
    track (Veo generates audio natively) is preserved; if there is none,
    `0:a?` just drops that map instead of failing.
    """
    import imageio_ffmpeg

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    width, height = _probe_video_size(src, ffmpeg, timeout=min(timeout, 15.0))

    overlay_img = _video_caption_overlay(width, height, headline, punchline)
    overlay_path = dst.with_name(dst.stem + "_caption.png")
    dst.parent.mkdir(parents=True, exist_ok=True)
    overlay_img.save(overlay_path, "PNG")

    cmd = [
        ffmpeg,
        "-y",
        "-i", str(src),
        "-i", str(overlay_path),
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-movflags", "+faststart",
        str(dst),
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=timeout
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"ffmpeg timed out overlaying a caption on {src.name}") from exc
    finally:
        overlay_path.unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg could not overlay a caption on {src.name} "
            f"(exit {result.returncode}): {result.stderr[-500:]}"
        )
    return dst


if __name__ == "__main__":
    p = render_meme(
        "exp_014",
        "financial aid portal speedrun (world record attempt)",
        "RUN VOIDED — SESSION TIMED OUT AT 4:51",
    )
    print(f"wrote {p} ({p.stat().st_size / 1024:.0f} KB)")
