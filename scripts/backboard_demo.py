"""Run the Backboard persistence smoke test from the repository checkout.

See BACKBOARD.md. Uses actual persisted observations; no sample metrics.
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from memevolution.integration.backboard_demo import main

if __name__ == "__main__":
    main()
