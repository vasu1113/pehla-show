from __future__ import annotations

import asyncio
import json
import logging
import secrets
from collections.abc import Coroutine
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import config, models, pipeline, store
from app.stages.a1_parse import content_hash


class AnalyseBody(BaseModel):
    raw_text: str
    title: str | None = None
    cohort_ids: list[str] | None = None


class FixBody(BaseModel):
    fix: str | None = None


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5177"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pipeline")
log = logging.getLogger(__name__)

_tasks: set[Future[Any]] = set()
#: task -> run_id, so a crashed task can mark its run instead of leaving
#: the client polling an "analysing" run that will never resolve.
_task_runs: dict[Future[Any], str] = {}


def _new_run_id() -> str:
    return f"run_{secrets.token_hex(3)}"


def _run_background(coroutine: Coroutine[Any, Any, Any]) -> Any:
    return asyncio.run(coroutine)


def _task_finished(task: Future[Any]) -> None:
    _tasks.discard(task)
    run_id = _task_runs.pop(task, None)
    error = task.exception()
    if error is None:
        return

    # Anything escaping the pipeline's own try/except lands here. Swallowing
    # it leaves the run stuck on "analysing" forever and the UI polling a run
    # that will never resolve — the one failure mode the contract has no
    # answer for. Log it, and mark the run so the poll terminates.
    log.error("background pipeline task failed", exc_info=error)
    if run_id is None:
        return
    run = store.get(run_id)
    if run is not None and run.status == "analysing":
        store.save(
            run.model_copy(
                update={
                    "status": "error",
                    "warnings": [
                        *run.warnings,
                        models.Warning(
                            code="PIPELINE_CRASHED",
                            message="The analysis stopped unexpectedly.",
                        ),
                    ],
                }
            )
        )


def _start(coroutine: Coroutine[Any, Any, Any], run_id: str) -> None:
    task = _executor.submit(_run_background, coroutine)
    _tasks.add(task)
    _task_runs[task] = run_id
    task.add_done_callback(_task_finished)


def _queue(run: models.Run) -> None:
    store.save(run)
    store.set_progress(
        run.run_id,
        models.Progress(
            stage=models.Stage.QUEUED,
            message=models.STAGE_MESSAGE[models.Stage.QUEUED],
            pct=0,
        ),
    )


def _json_file(name: str) -> JSONResponse:
    path = config.DATA_DIR / name
    return JSONResponse(json.loads(path.read_text(encoding="utf-8")))


@app.post("/analyse")
async def start_analysis(body: AnalyseBody) -> JSONResponse:
    word_count = len(body.raw_text.split())
    if word_count < config.MIN_WORDS:
        raise HTTPException(
            status_code=400,
            detail=f"Script must contain at least {config.MIN_WORDS} words.",
        )
    if word_count > config.MAX_WORDS:
        raise HTTPException(
            status_code=413,
            detail=f"Script must contain at most {config.MAX_WORDS} words.",
        )

    pinned = store.find_pinned(content_hash(body.raw_text))
    if pinned is not None:
        return JSONResponse(
            {
                "run_id": pinned.run_id,
                "status": "ready",
                "cached": True,
            },
            status_code=200,
        )

    run_id = _new_run_id()
    _queue(
        models.Run(
            run_id=run_id,
            status="analysing",
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            script=models.ScriptMeta(
                id=content_hash(body.raw_text)[:12],
                title=body.title or "Untitled",
                duration_sec=0,
                word_count=word_count,
            ),
        )
    )
    _start(
        pipeline.analyse(
            run_id,
            body.raw_text,
            body.title or "Untitled",
            body.cohort_ids,
        ),
        run_id,
    )
    return JSONResponse(
        {
            "run_id": run_id,
            "status": "analysing",
            "cached": False,
        },
        status_code=202,
    )


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> JSONResponse:
    run = store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found.")

    if run.status == "analysing":
        status = models.RunStatus(
            run_id=run.run_id,
            status=run.status,
            progress=store.get_progress(run_id),
        )
        return JSONResponse(status.model_dump(mode="json"))

    payload = run.model_dump(mode="json")
    if run.status == "error":
        warning = run.warnings[-1] if run.warnings else models.Warning(
            code="RUN_FAILED",
            message="The analysis failed.",
        )
        payload["error"] = warning.model_dump(mode="json")
    return JSONResponse(payload)


@app.post("/runs/{run_id}/fix")
async def fix_run(run_id: str, body: FixBody) -> JSONResponse:
    parent = store.get(run_id)
    if parent is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    # Fixing a run that is still analysing (or that failed) would start a
    # pipeline against half a screening and immediately error. Say so.
    if parent.status != "ready":
        raise HTTPException(
            status_code=409,
            detail=f"Run {run_id} is not ready (status={parent.status}).",
        )

    selected_fix = (
        body.fix
        if body.fix is not None
        else (
            parent.room_synthesis.recommended_fix
            if parent.room_synthesis is not None
            else None
        )
    )
    if selected_fix is None:
        raise HTTPException(
            status_code=400,
            detail="No fix or room recommendation is available.",
        )

    fixed_run_id = _new_run_id()
    _queue(
        models.Run(
            run_id=fixed_run_id,
            parent_run_id=parent.run_id,
            variant="fixed",
            status="analysing",
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            script=parent.script.model_copy(deep=True),
        )
    )
    _start(
        pipeline.apply_recommended_fix(parent, selected_fix, fixed_run_id),
        fixed_run_id,
    )
    return JSONResponse(
        {
            "run_id": fixed_run_id,
            "status": "analysing",
            "parent_run_id": parent.run_id,
        },
        status_code=202,
    )


@app.get("/personas")
async def get_personas() -> JSONResponse:
    return _json_file("personas.json")


@app.get("/taxonomy")
async def get_taxonomy() -> JSONResponse:
    return _json_file("taxonomy.json")


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "model_reachable": (
            config.LLM_BACKEND == "fake"
            or bool(config.OPENAI_API_KEY.strip())
        ),
        # Track B shows a quiet dot in the header from this. At hour 30 it is
        # how you know in two seconds whether the demo will work, so it has to
        # mean something — check the store is actually writable rather than
        # reporting a constant.
        "db_reachable": store.is_writable(),
        "pinned_runs": len(store.list_pinned()),
    }
