"""
Turn a meme concept into an actual JPEG.

Instagram will not accept SVG and will not accept a description — it fetches a
real image file over HTTP. The frontend's memes are an SVG backdrop plus text
drawn by the browser, which exists nowhere as a file, so this renders the same
thing server-side into something a platform will take.

1080x1080, JPEG, which satisfies both Instagram and TikTok photo posts.
"""

from __future__ import annotations

import hashlib
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CANVAS = 1080
MARGIN = 80
OUT_DIR = Path(__file__).resolve().parents[1] / "media"

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


def render_meme(
    experiment_id: str,
    headline: str,
    punchline: str | None = None,
    out_dir: Path | None = None,
) -> Path:
    """Write <out_dir>/<experiment_id>.jpg and return the path."""
    out_dir = out_dir or OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    img = _backdrop(experiment_id + headline)
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

    path = out_dir / f"{experiment_id}.jpg"
    img.convert("RGB").save(path, "JPEG", quality=90, optimize=True)
    return path


if __name__ == "__main__":
    p = render_meme(
        "exp_014",
        "financial aid portal speedrun (world record attempt)",
        "RUN VOIDED — SESSION TIMED OUT AT 4:51",
    )
    print(f"wrote {p} ({p.stat().st_size / 1024:.0f} KB)")
