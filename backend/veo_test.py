"""
Run this from inside backend/ with: python3 veo_test.py /path/to/a/meme.jpg

Prints everything the team asked for: whether Veo succeeded, generation
time, the source label, and file details for the resulting MP4.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, ".")
from app.generate_video import make_meme_video  # noqa: E402

if len(sys.argv) < 2:
    print("Usage: python3 veo_test.py /path/to/a/meme.jpg")
    sys.exit(1)

image_path = Path(sys.argv[1])
if not image_path.exists():
    print(f"No such file: {image_path}")
    sys.exit(1)

headline = "FINANCIAL AID PORTAL SPEEDRUN"
punchline = "WORLD RECORD ATTEMPT"
visual_description = "a college student staring at a frozen loading screen in a dorm room, increasingly panicked"

print(f"Starting Veo generation at {time.strftime('%H:%M:%S')}...")
start = time.monotonic()

path, source = make_meme_video(
    "veo_test_001",
    headline,
    punchline,
    visual_description,
    image_path,
)

elapsed = time.monotonic() - start

print("\n--- REPORT ---")
print(f"Real Veo call succeeded: {'YES' if source == 'veo' else 'NO (fell back)'}")
print(f"Source label: {source}")
print(f"Generation time: {elapsed:.1f} seconds")
print(f"Output file: {path.resolve()}")
if path.exists():
    print(f"File size: {path.stat().st_size / 1024:.0f} KB")
else:
    print("File does not exist!")
print("\nManually confirm by opening the file:")
print("  - Does it actually move (not a static held frame)?")
print("  - Is the headline/punchline text visible and correctly worded?")
print("  - Does it have audio when played?")
print("  - Does it look right in a vertical/9:16 player (TikTok-shaped)?")
