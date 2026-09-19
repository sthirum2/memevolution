import sys
from pathlib import Path

# predictor.py is a standalone script (not a package), so make it importable
# regardless of where pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
