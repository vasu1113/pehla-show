from __future__ import annotations

import asyncio
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import cache, config, models, pipeline, store
from app.main import app
from app.stages.a1_parse import content_hash


HERO_SCRIPT = (config.DATA_DIR / "hero_script.txt").read_text(encoding="utf-8")


@pytest.fixture(autouse=True)
def isolated_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "RUNS_DIR", tmp_path)
    monkeypatch.setattr(config, "LLM_BACKEND", "fake")
    store._runs.clear()
    store._progress.clear()
    store._pinned.clear()
    cache._beats.clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as active_client:
        yield active_client


def _poll(client: TestClient, run_id: str) -> dict[str, object]:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        response = client.get(f"/runs/{run_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] != "analysing":
            return payload
        time.sleep(0.01)
    raise AssertionError(f"Run {run_id} did not finish")


def test_analyse_rejects_scripts_outside_word_limits(client: TestClient) -> None:
    too_short = client.post("/analyse", json={"raw_text": "one " * 10})
    too_long = client.post("/analyse", json={"raw_text": "word " * 8001})

    assert too_short.status_code == 400
    assert too_long.status_code == 413


def test_analyse_returns_a_complete_run(client: TestClient) -> None:
    started = client.post(
        "/analyse",
        json={"raw_text": HERO_SCRIPT, "title": "Hero"},
    )

    assert started.status_code == 202
    assert started.json()["run_id"].startswith("run_")
    result = _poll(client, started.json()["run_id"])
    assert result["status"] == "ready"
    assert result["beats"]
    assert len(result["audience"]) == 30
    assert result["drop_events"]
    models.Run.model_validate(result)


def test_unknown_run_returns_404(client: TestClient) -> None:
    assert client.get("/runs/unknown").status_code == 404


def test_progress_uses_contract_stage_messages(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = pipeline.a1_parse.parse_beats

    async def delayed_parse(raw_text, llm=None):
        await asyncio.sleep(0.05)
        return await original(raw_text, llm)

    monkeypatch.setattr(pipeline.a1_parse, "parse_beats", delayed_parse)
    started = client.post("/analyse", json={"raw_text": HERO_SCRIPT})
    progress = client.get(f"/runs/{started.json()['run_id']}").json()["progress"]

    assert progress["message"] in set(models.STAGE_MESSAGE.values())
    _poll(client, started.json()["run_id"])


def test_pinned_run_is_returned_without_reanalysis(client: TestClient) -> None:
    pinned = models.Run(
        run_id="run_pinned",
        status="ready",
        created_at="2026-07-25T00:00:00+00:00",
        script=models.ScriptMeta(
            id=content_hash(HERO_SCRIPT)[:12],
            title="Pinned",
            duration_sec=1,
            word_count=len(HERO_SCRIPT.split()),
        ),
    )
    store.save(pinned)
    store.pin(pinned.run_id, content_hash(HERO_SCRIPT))

    response = client.post("/analyse", json={"raw_text": HERO_SCRIPT})

    assert response.status_code == 200
    assert response.json() == {
        "run_id": pinned.run_id,
        "status": "ready",
        "cached": True,
    }


def test_one_failed_cohort_degrades_the_run(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = pipeline.a2_score.score_persona_verbose

    async def fail_one(beats, persona, llm=None):
        if persona.id == "commuter":
            raise RuntimeError("cohort unavailable")
        return await original(beats, persona, llm)

    monkeypatch.setattr(pipeline.a2_score, "score_persona_verbose", fail_one)
    started = client.post("/analyse", json={"raw_text": HERO_SCRIPT})
    result = _poll(client, started.json()["run_id"])

    assert result["status"] == "ready"
    assert len(result["audience"]) == 25
    assert [warning["code"] for warning in result["warnings"]] == [
        "COHORT_DROPPED"
    ]


def test_three_failed_cohorts_return_an_error_contract(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = pipeline.a2_score.score_persona_verbose
    failed = {"commuter", "kitchen", "night_rider"}

    async def fail_three(beats, persona, llm=None):
        if persona.id in failed:
            raise RuntimeError("cohort unavailable")
        return await original(beats, persona, llm)

    monkeypatch.setattr(pipeline.a2_score, "score_persona_verbose", fail_three)
    started = client.post("/analyse", json={"raw_text": HERO_SCRIPT})
    response = client.get(f"/runs/{started.json()['run_id']}")
    result = _poll(client, started.json()["run_id"])

    assert response.status_code == 200
    assert result["status"] == "error"
    assert result["error"]["code"] == "AUDIENCE_FAILED"


def test_personas_and_taxonomy_are_served_from_data(client: TestClient) -> None:
    personas = client.get("/personas")
    taxonomy = client.get("/taxonomy")

    assert personas.status_code == 200
    assert len(personas.json()["personas"]) == 6
    assert taxonomy.status_code == 200
    assert len(taxonomy.json()["drain"]) == 10
    assert len(taxonomy.json()["refill"]) == 7


def test_health_reports_fake_backend_as_reachable(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["model_reachable"] is True
