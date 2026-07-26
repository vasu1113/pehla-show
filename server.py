"""Vercel FastAPI entry point for the Pehla Show backend."""

from __future__ import annotations

import sys
from pathlib import Path


# Keep the local package layout unchanged while exposing a recognized Vercel
# FastAPI entry point at the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parent / "api"))

from app.main import app  # noqa: E402
