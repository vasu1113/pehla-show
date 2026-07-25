"""Environment and tunable constants.

Every number the demo depends on lives here or at the top of its own stage
module. Nothing is buried in a function body.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ─── paths ────────────────────────────────────────────────────────────────
API_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = API_DIR.parent
DATA_DIR = REPO_ROOT / "data"
RUNS_DIR = API_DIR / ".runs"

# ─── determinism ──────────────────────────────────────────────────────────
# A deterministic sim means the demo produces the same room every time you
# rehearse it. Never make this configurable per-request.
SEED = 42

# ─── model backend ────────────────────────────────────────────────────────
# "fake" is the default so a fresh clone runs with no key at all.
LLM_BACKEND = os.getenv("LLM_BACKEND", "fake")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Resolved against the account when the key lands; env-overridable so
# swapping is a one-line change, never a code change.
MODEL_PARSER = os.getenv("OPENAI_MODEL_PARSER", "gpt-4.1-mini")
MODEL_SCORER = os.getenv("OPENAI_MODEL_SCORER", "gpt-4.1-mini")
MODEL_EXPERT = os.getenv("OPENAI_MODEL_EXPERT", "gpt-4.1")
MODEL_SYNTH = os.getenv("OPENAI_MODEL_SYNTH", "gpt-4.1")

LLM_TIMEOUT_SEC = float(os.getenv("LLM_TIMEOUT_SEC", "60"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))

# ─── pipeline constants ───────────────────────────────────────────────────
WORDS_PER_MINUTE = 150          # A1 computes beat timings from this, in code
SEATS_PER_COHORT = 5            # × 6 cohorts = 30 seats
SEAT_COUNT = 30
# Per seat, so a cohort does not leave as a block — five people in the same
# situation still have different mornings.
PATIENCE_JITTER = float(os.getenv("PATIENCE_JITTER", "0.28"))
SENSITIVITY_JITTER = float(os.getenv("SENSITIVITY_JITTER", "0.15"))

# The scorer reports -3..+3 per beat; patience starts around 4.5-8.5. Applied
# raw, three bad beats empty the hall inside ninety seconds and the demo has no
# shape. This converts a delta into a patience cost, so a listener takes a
# handful of bad beats to lose rather than three.
#
# THE knob for how fast the room empties. Tune it before touching personas or
# prompts. Sweep it with PATIENCE_SCALE=0.13 uv run python scripts/run_pipeline.py
# and read the retention line. Calibrated against the fake; re-check it once
# real scores land, because correlated drains bite harder than random ones.
PATIENCE_SCALE = float(os.getenv("PATIENCE_SCALE", "0.15"))

MIN_WORDS = 200                 # below this, /analyse returns 400
MAX_WORDS = 8000                # above this, /analyse returns 413

CONTRACT_VERSION = "1.0"
