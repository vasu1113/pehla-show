from __future__ import annotations

import json
from threading import RLock
from typing import Any

from app import config
from app.models import Progress, Run


_runs: dict[str, Run] = {}
_progress: dict[str, Progress] = {}
_pinned: dict[tuple[str, str], str] = {}
_lock = RLock()


def _read_json(name: str, default: Any) -> Any:
    path = config.RUNS_DIR / name
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _write_json(name: str, value: Any) -> None:
    config.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    path = config.RUNS_DIR / name
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    temporary.replace(path)


def _load() -> None:
    raw_runs = _read_json("runs.json", {})
    if isinstance(raw_runs, dict):
        for run_id, raw in raw_runs.items():
            try:
                _runs[str(run_id)] = Run.model_validate(raw)
            except (TypeError, ValueError):
                continue

    raw_progress = _read_json("progress.json", {})
    if isinstance(raw_progress, dict):
        for run_id, raw in raw_progress.items():
            try:
                _progress[str(run_id)] = Progress.model_validate(raw)
            except (TypeError, ValueError):
                continue

    raw_pins = _read_json("pinned.json", [])
    if isinstance(raw_pins, list):
        for raw in raw_pins:
            if not isinstance(raw, dict):
                continue
            content_hash = raw.get("content_hash")
            variant = raw.get("variant")
            run_id = raw.get("run_id")
            if all(isinstance(value, str) for value in (content_hash, variant, run_id)):
                _pinned[(content_hash, variant)] = run_id


def _persist_runs() -> None:
    _write_json(
        "runs.json",
        {
            run_id: run.model_dump(mode="json")
            for run_id, run in _runs.items()
        },
    )


def _persist_progress() -> None:
    _write_json(
        "progress.json",
        {
            run_id: progress.model_dump(mode="json")
            for run_id, progress in _progress.items()
        },
    )


def _persist_pins() -> None:
    _write_json(
        "pinned.json",
        [
            {
                "content_hash": content_hash,
                "variant": variant,
                "run_id": run_id,
            }
            for (content_hash, variant), run_id in sorted(_pinned.items())
        ],
    )


def save(run: Run) -> None:
    with _lock:
        _runs[run.run_id] = run.model_copy(deep=True)
        _persist_runs()


def get(run_id: str) -> Run | None:
    with _lock:
        run = _runs.get(run_id)
        return run.model_copy(deep=True) if run is not None else None


def set_progress(run_id: str, progress: Progress) -> None:
    with _lock:
        _progress[run_id] = progress.model_copy(deep=True)
        _persist_progress()


def get_progress(run_id: str) -> Progress | None:
    with _lock:
        progress = _progress.get(run_id)
        return progress.model_copy(deep=True) if progress is not None else None


def find_pinned(content_hash: str, variant: str = "original") -> Run | None:
    with _lock:
        run_id = _pinned.get((content_hash, variant))
        run = _runs.get(run_id) if run_id is not None else None
        return run.model_copy(deep=True) if run is not None else None


def pin(run_id: str, content_hash: str) -> None:
    with _lock:
        run = _runs.get(run_id)
        if run is None:
            raise KeyError(f"Unknown run id: {run_id}")
        _pinned[(content_hash, run.variant)] = run_id
        _persist_pins()


def list_pinned() -> list[str]:
    with _lock:
        return sorted(set(_pinned.values()))


_load()


def is_writable() -> bool:
    """Whether the run store can actually be persisted to.

    Feeds /health, which Track B renders as a dot in the header. A constant
    would make that dot meaningless.
    """
    try:
        config.RUNS_DIR.mkdir(parents=True, exist_ok=True)
        probe = config.RUNS_DIR / ".probe"
        probe.write_text("ok")
        probe.unlink()
        return True
    except OSError:
        return False
