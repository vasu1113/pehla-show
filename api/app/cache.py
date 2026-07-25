from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from types import ModuleType

from app import config
from app.models import Beat


_beats: dict[str, list[Beat]] = {}
_lock = RLock()


def _backend() -> ModuleType:
    from app import store_supabase

    return store_supabase


def _path(content_hash: str) -> Path:
    return config.RUNS_DIR / "beats" / f"{content_hash}.json"


def get(content_hash: str) -> list[Beat] | None:
    if config.STORE_BACKEND == "supabase":
        return _backend().cache_get(content_hash)
    with _lock:
        cached = _beats.get(content_hash)
        if cached is not None:
            return [beat.model_copy(deep=True) for beat in cached]

        path = _path(content_hash)
        if not path.is_file():
            return None
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            beats = [Beat.model_validate(item) for item in raw]
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            return None

        _beats[content_hash] = beats
        return [beat.model_copy(deep=True) for beat in beats]


def put(content_hash: str, beats: list[Beat]) -> None:
    if config.STORE_BACKEND == "supabase":
        _backend().cache_put(content_hash, beats)
        return
    with _lock:
        stored = [beat.model_copy(deep=True) for beat in beats]
        _beats[content_hash] = stored

        path = _path(content_hash)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(
                [beat.model_dump(mode="json") for beat in stored],
                indent=2,
            ),
            encoding="utf-8",
        )
        temporary.replace(path)
