from __future__ import annotations

import logging
from threading import RLock
from typing import Any

from app import config
from app.models import Beat, Progress, Run


logger = logging.getLogger(__name__)

_client_override: Any | None = None
_client: Any | None = None
_progress: dict[str, Progress] = {}
_progress_lock = RLock()


def get_client() -> Any:
    if _client_override is not None:
        return _client_override

    global _client
    if _client is None:
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("Supabase storage credentials are not configured")
        from supabase import create_client

        _client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client


def _data(response: Any) -> list[dict[str, Any]]:
    data = getattr(response, "data", None)
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def save(
    run: Run,
    raw_text: str | None = None,
    content_hash: str | None = None,
) -> None:
    try:
        client = get_client()
        # The Run contract currently omits both values. Callers that know them
        # should pass them until /analyse is wired to do so.
        client.table("scripts").upsert(
            {
                "id": run.script.id,
                "title": run.script.title,
                "raw_text": raw_text if raw_text is not None else "",
                "content_hash": (
                    content_hash if content_hash is not None else run.script.id
                ),
                "word_count": run.script.word_count,
            },
            on_conflict="id",
        ).execute()
        client.table("runs").upsert(
            {
                "id": run.run_id,
                "script_id": run.script.id,
                "parent_run_id": run.parent_run_id,
                "variant": run.variant,
                "status": run.status,
                "is_pinned": False,
                "result_json": run.model_dump(mode="json"),
            },
            on_conflict="id",
        ).execute()

        client.table("audience").delete().eq("run_id", run.run_id).execute()
        if run.audience:
            client.table("audience").insert(
                [
                    {
                        "run_id": run.run_id,
                        "seat": member.seat,
                        "name": member.name,
                        "persona_id": member.persona_id,
                        "variant_index": member.variant_index,
                        "start_patience": member.start_patience,
                        "left_at_sec": member.left_at_sec,
                        "left_at_beat": member.left_at_beat,
                        "reason_code": member.reason_code,
                        "reason_label": member.reason_label,
                        "evidence": member.evidence,
                        "patience_trace": member.patience_trace,
                        "sensitivity": {},
                        "replenish": {},
                    }
                    for member in run.audience
                ]
            ).execute()
    except Exception:
        logger.exception("Could not save run %s to Supabase", run.run_id)


def get(run_id: str) -> Run | None:
    try:
        response = (
            get_client()
            .table("runs")
            .select("result_json")
            .eq("id", run_id)
            .limit(1)
            .execute()
        )
        rows = _data(response)
        if not rows:
            return None
        return Run.model_validate(rows[0].get("result_json"))
    except Exception:
        logger.exception("Could not read run %s from Supabase", run_id)
        return None


def set_progress(run_id: str, progress: Progress) -> None:
    with _progress_lock:
        _progress[run_id] = progress.model_copy(deep=True)


def get_progress(run_id: str) -> Progress | None:
    with _progress_lock:
        progress = _progress.get(run_id)
        return progress.model_copy(deep=True) if progress is not None else None


def find_pinned(
    content_hash: str,
    variant: str = "original",
) -> Run | None:
    try:
        script_response = (
            get_client()
            .table("scripts")
            .select("id")
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        )
        scripts = _data(script_response)
        if not scripts:
            return None

        run_response = (
            get_client()
            .table("runs")
            .select("result_json")
            .eq("script_id", scripts[0].get("id"))
            .eq("variant", variant)
            .eq("is_pinned", True)
            .limit(1)
            .execute()
        )
        runs = _data(run_response)
        if not runs:
            return None
        return Run.model_validate(runs[0].get("result_json"))
    except Exception:
        logger.exception(
            "Could not resolve pinned run for content hash %s",
            content_hash,
        )
        return None


def pin(run_id: str, content_hash: str) -> None:
    try:
        client = get_client()
        response = (
            client.table("runs")
            .select("script_id")
            .eq("id", run_id)
            .limit(1)
            .execute()
        )
        rows = _data(response)
        if not rows:
            return

        script_id = rows[0].get("script_id")
        client.table("scripts").update(
            {"content_hash": content_hash}
        ).eq("id", script_id).execute()
        client.table("runs").update(
            {"is_pinned": True}
        ).eq("id", run_id).execute()
    except Exception:
        logger.exception("Could not pin run %s in Supabase", run_id)


def list_pinned() -> list[str]:
    try:
        response = (
            get_client()
            .table("runs")
            .select("id")
            .eq("is_pinned", True)
            .execute()
        )
        return sorted(
            row["id"]
            for row in _data(response)
            if isinstance(row.get("id"), str)
        )
    except Exception:
        logger.exception("Could not list pinned Supabase runs")
        return []


def dangling_pins() -> list[str]:
    # A pin is a flag on the run row, so it cannot outlive that row.
    return []


def is_writable() -> bool:
    try:
        (
            get_client()
            .table("runs")
            .select("id")
            .limit(1)
            .execute()
        )
        return True
    except Exception:
        logger.exception("Supabase run store is not reachable")
        return False


def cache_get(content_hash: str) -> list[Beat] | None:
    try:
        response = (
            get_client()
            .table("beat_cache")
            .select("beats")
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        )
        rows = _data(response)
        if not rows or not isinstance(rows[0].get("beats"), list):
            return None
        return [Beat.model_validate(beat) for beat in rows[0]["beats"]]
    except Exception:
        logger.exception(
            "Could not read beat cache entry %s from Supabase",
            content_hash,
        )
        return None


def cache_put(content_hash: str, beats: list[Beat]) -> None:
    try:
        get_client().table("beat_cache").upsert(
            {
                "content_hash": content_hash,
                "beats": [beat.model_dump(mode="json") for beat in beats],
            },
            on_conflict="content_hash",
        ).execute()
    except Exception:
        logger.exception(
            "Could not write beat cache entry %s to Supabase",
            content_hash,
        )
