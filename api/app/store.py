from __future__ import annotations

import json
from threading import RLock
from types import ModuleType
from typing import Any

from app import analysis_config, config
from app.models import AnalysisConfig, Persona, Progress, Run


_runs: dict[str, Run] = {}
_progress: dict[str, Progress] = {}
_pinned: dict[tuple[str, str, str], str] = {}
_lock = RLock()


def _backend() -> ModuleType:
    from app import store_supabase

    return store_supabase


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


def _list_file_personas() -> list[Persona]:
    raw = json.loads(
        (config.DATA_DIR / "personas.json").read_text(encoding="utf-8")
    )
    return [
        Persona.model_validate(
            {
                "id": item["id"],
                "label": item["label"],
                "persona_type": item.get("persona_type"),
                "prompt": item.get("prompt", item.get("context")),
                "calibrated_from": item.get("calibrated_from", 0),
            }
        )
        for item in raw["cohorts"]
    ]


def _select_personas(
    personas: list[Persona],
    ids: list[str],
) -> list[Persona]:
    by_id = {persona.id: persona for persona in personas}
    selected: list[Persona] = []
    for persona_id in ids:
        persona = by_id.get(persona_id)
        if persona is None:
            raise KeyError(f"Unknown persona id: {persona_id}")
        selected.append(persona)
    return selected


def list_personas() -> list[Persona]:
    if config.STORE_BACKEND == "supabase":
        return _backend().list_personas()
    return _list_file_personas()


def get_personas(ids: list[str]) -> list[Persona]:
    if config.STORE_BACKEND == "supabase":
        return _backend().get_personas(ids)
    return _select_personas(_list_file_personas(), ids)


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
            analysis_key = raw.get("analysis_key", "legacy")
            if all(
                isinstance(value, str)
                for value in (content_hash, variant, analysis_key, run_id)
            ):
                _pinned[(content_hash, variant, analysis_key)] = run_id


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
                "analysis_key": analysis_key,
                "run_id": run_id,
            }
            for (content_hash, variant, analysis_key), run_id
            in sorted(_pinned.items())
        ],
    )


def save(
    run: Run,
    raw_text: str | None = None,
    content_hash: str | None = None,
) -> None:
    if config.STORE_BACKEND == "supabase":
        _backend().save(run, raw_text, content_hash)
        return
    with _lock:
        _runs[run.run_id] = run.model_copy(deep=True)
        _persist_runs()


def get(run_id: str) -> Run | None:
    if config.STORE_BACKEND == "supabase":
        return _backend().get(run_id)
    with _lock:
        run = _runs.get(run_id)
        return run.model_copy(deep=True) if run is not None else None


def set_progress(run_id: str, progress: Progress) -> None:
    if config.STORE_BACKEND == "supabase":
        _backend().set_progress(run_id, progress)
        return
    with _lock:
        _progress[run_id] = progress.model_copy(deep=True)
        _persist_progress()


def get_progress(run_id: str) -> Progress | None:
    if config.STORE_BACKEND == "supabase":
        return _backend().get_progress(run_id)
    with _lock:
        progress = _progress.get(run_id)
        return progress.model_copy(deep=True) if progress is not None else None


def find_pinned(
    content_hash: str,
    variant: str = "original",
    requested: AnalysisConfig | None = None,
) -> Run | None:
    if config.STORE_BACKEND == "supabase":
        return _backend().find_pinned(content_hash, variant, requested)
    with _lock:
        if requested is None:
            run_id = next(
                (
                    candidate
                    for (digest, run_variant, _), candidate in _pinned.items()
                    if digest == content_hash and run_variant == variant
                ),
                None,
            )
        else:
            run_id = _pinned.get(
                (
                    content_hash,
                    variant,
                    analysis_config.fingerprint(requested),
                )
            )
        run = _runs.get(run_id) if run_id is not None else None
        if run is None or not analysis_config.matches(run, requested):
            return None
        return run.model_copy(deep=True)


def pin(run_id: str, content_hash: str) -> None:
    if config.STORE_BACKEND == "supabase":
        _backend().pin(run_id, content_hash)
        return
    with _lock:
        run = _runs.get(run_id)
        if run is None:
            raise KeyError(f"Unknown run id: {run_id}")
        _pinned[
            (
                content_hash,
                run.variant,
                analysis_config.fingerprint(run.analysis_config),
            )
        ] = run_id
        _persist_pins()


def list_pinned() -> list[str]:
    """Only pins that actually resolve to a stored run.

    A pin whose run has gone is worse than no pin: /analyse falls through and
    re-runs the pipeline, while /health cheerfully reports the demo is
    insured. The header dot has to be able to be wrong out loud.
    """
    if config.STORE_BACKEND == "supabase":
        return _backend().list_pinned()
    with _lock:
        return sorted({
            run_id for run_id in _pinned.values() if run_id in _runs
        })


def dangling_pins() -> list[str]:
    """Pins pointing at runs that no longer exist. Should always be empty."""
    if config.STORE_BACKEND == "supabase":
        return _backend().dangling_pins()
    with _lock:
        return sorted({
            run_id for run_id in _pinned.values() if run_id not in _runs
        })


_load()


def is_writable() -> bool:
    """Whether the run store can actually be persisted to.

    Feeds /health, which Track B renders as a dot in the header. A constant
    would make that dot meaningless.
    """
    if config.STORE_BACKEND == "supabase":
        return _backend().is_writable()
    try:
        config.RUNS_DIR.mkdir(parents=True, exist_ok=True)
        probe = config.RUNS_DIR / ".probe"
        probe.write_text("ok")
        probe.unlink()
        return True
    except OSError:
        return False
