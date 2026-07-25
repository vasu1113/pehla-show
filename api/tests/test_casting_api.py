from __future__ import annotations

import time
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import cache, config, store
from app.main import app


HERO_SCRIPT = (config.DATA_DIR / "hero_script.txt").read_text(encoding="utf-8")


@pytest.fixture(autouse=True)
def isolated_file_store(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "RUNS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "file")
    monkeypatch.setattr(config, "LLM_BACKEND", "fake")
    saved_runs = dict(store._runs)
    saved_progress = dict(store._progress)
    saved_pins = dict(store._pinned)
    saved_beats = dict(cache._beats)
    store._runs.clear()
    store._progress.clear()
    store._pinned.clear()
    cache._beats.clear()
    yield
    store._runs.clear()
    store._runs.update(saved_runs)
    store._progress.clear()
    store._progress.update(saved_progress)
    store._pinned.clear()
    store._pinned.update(saved_pins)
    cache._beats.clear()
    cache._beats.update(saved_beats)


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as active_client:
        yield active_client


def _persona_ids(client: TestClient) -> list[str]:
    return [
        persona["id"]
        for persona in client.get("/personas").json()["personas"]
    ]


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


def test_get_personas_returns_the_file_library(client: TestClient) -> None:
    response = client.get("/personas")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"personas"}
    assert len(payload["personas"]) == 6
    assert all(
        {"id", "label", "prompt"} <= persona.keys()
        for persona in payload["personas"]
    )


def test_analyse_without_persona_ids_fills_the_theatre(
    client: TestClient,
) -> None:
    started = client.post("/analyse", json={"raw_text": HERO_SCRIPT})

    assert started.status_code == 202
    result = _poll(client, started.json()["run_id"])
    assert result["status"] == "ready"
    assert len(result["audience"]) == 30


def test_analyse_with_six_personas_spawns_five_each(
    client: TestClient,
) -> None:
    persona_ids = _persona_ids(client)
    started = client.post(
        "/analyse",
        json={"raw_text": HERO_SCRIPT, "persona_ids": persona_ids},
    )

    assert started.status_code == 202
    result = _poll(client, started.json()["run_id"])
    grouped = Counter(member["persona_id"] for member in result["audience"])
    assert grouped == Counter({persona_id: 5 for persona_id in persona_ids})


def test_analyse_rejects_five_personas(client: TestClient) -> None:
    persona_ids = _persona_ids(client)[:5]

    response = client.post(
        "/analyse",
        json={"raw_text": HERO_SCRIPT, "persona_ids": persona_ids},
    )

    assert response.status_code == 400
    assert "5 persona ids given; 6 needed" in response.json()["detail"]


def test_analyse_rejects_seven_personas(client: TestClient) -> None:
    persona_ids = _persona_ids(client)

    response = client.post(
        "/analyse",
        json={
            "raw_text": HERO_SCRIPT,
            "persona_ids": [*persona_ids, persona_ids[0]],
        },
    )

    assert response.status_code == 400
    assert "7 persona ids given; 6 needed" in response.json()["detail"]


def test_analyse_rejects_an_unknown_persona(client: TestClient) -> None:
    persona_ids = _persona_ids(client)
    unknown_id = "unknown_listener"

    response = client.post(
        "/analyse",
        json={
            "raw_text": HERO_SCRIPT,
            "persona_ids": [*persona_ids[:-1], unknown_id],
        },
    )

    assert response.status_code == 400
    assert unknown_id in response.json()["detail"]


def test_get_personas_preserves_requested_order(client: TestClient) -> None:
    requested = list(reversed(_persona_ids(client)))

    personas = store.get_personas(requested)

    assert [persona.id for persona in personas] == requested
