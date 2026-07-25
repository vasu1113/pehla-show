from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app import cache, config, store, store_supabase
from app.models import (
    AgentMeta,
    AudienceMember,
    Audio,
    Beat,
    BeatType,
    Cohort,
    DropEvent,
    Note,
    RoomSynthesis,
    Run,
    ScriptMeta,
    Stage,
    Summary,
    Warning,
    Progress,
)


class FakeQuery:
    def __init__(self, client: FakeClient, table: str) -> None:
        self.client = client
        self.table = table
        self.operation = ""
        self.payload: Any = None
        self.columns = "*"
        self.filters: list[tuple[str, Any]] = []
        self.maximum: int | None = None

    def select(self, columns: str) -> FakeQuery:
        self.operation = "select"
        self.columns = columns
        return self

    def upsert(
        self,
        payload: Any,
        on_conflict: str | None = None,
    ) -> FakeQuery:
        self.operation = "upsert"
        self.payload = deepcopy(payload)
        return self

    def insert(self, payload: Any) -> FakeQuery:
        self.operation = "insert"
        self.payload = deepcopy(payload)
        return self

    def update(self, payload: dict[str, Any]) -> FakeQuery:
        self.operation = "update"
        self.payload = deepcopy(payload)
        return self

    def delete(self) -> FakeQuery:
        self.operation = "delete"
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self.filters.append((column, value))
        return self

    def limit(self, maximum: int) -> FakeQuery:
        self.maximum = maximum
        return self

    def execute(self) -> SimpleNamespace:
        self.client.calls.append((self.table, self.operation))
        rows = self.client.rows(self.table)

        if self.operation == "select":
            selected = [deepcopy(row) for row in rows if self._matches(row)]
            if self.maximum is not None:
                selected = selected[:self.maximum]
            if self.columns != "*":
                names = [name.strip() for name in self.columns.split(",")]
                selected = [
                    {name: row.get(name) for name in names}
                    for row in selected
                ]
            return SimpleNamespace(data=selected)

        if self.operation == "delete":
            kept = [row for row in rows if not self._matches(row)]
            self.client.replace_rows(self.table, kept)
            return SimpleNamespace(data=[])

        if self.operation == "insert":
            inserted = (
                self.payload
                if isinstance(self.payload, list)
                else [self.payload]
            )
            self.client.replace_rows(self.table, rows + deepcopy(inserted))
            return SimpleNamespace(data=deepcopy(inserted))

        if self.operation == "update":
            updated = []
            for row in rows:
                if self._matches(row):
                    row.update(deepcopy(self.payload))
                    updated.append(deepcopy(row))
            self.client.replace_rows(self.table, rows)
            return SimpleNamespace(data=updated)

        if self.operation == "upsert":
            records = (
                self.payload
                if isinstance(self.payload, list)
                else [self.payload]
            )
            primary_key = {
                "scripts": "id",
                "runs": "id",
                "beat_cache": "content_hash",
            }[self.table]
            for record in records:
                existing = next(
                    (
                        row
                        for row in rows
                        if row.get(primary_key) == record.get(primary_key)
                    ),
                    None,
                )
                if existing is None:
                    rows.append(deepcopy(record))
                else:
                    existing.update(deepcopy(record))
            self.client.replace_rows(self.table, rows)
            return SimpleNamespace(data=deepcopy(records))

        raise AssertionError(f"Unsupported fake operation: {self.operation}")

    def _matches(self, row: dict[str, Any]) -> bool:
        return all(row.get(column) == value for column, value in self.filters)


class FakeClient:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {
            "scripts": [],
            "runs": [],
            "audience": [],
            "beat_cache": [],
        }
        self.calls: list[tuple[str, str]] = []

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)

    def rows(self, name: str) -> list[dict[str, Any]]:
        return deepcopy(self.tables[name])

    def replace_rows(
        self,
        name: str,
        rows: list[dict[str, Any]],
    ) -> None:
        self.tables[name] = deepcopy(rows)


class RaisingClient:
    def table(self, name: str) -> Any:
        raise ConnectionError(f"{name} is unavailable")


@pytest.fixture(autouse=True)
def isolated_backends(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "RUNS_DIR", tmp_path)
    monkeypatch.setattr(config, "STORE_BACKEND", "file")
    monkeypatch.setattr(store_supabase, "_client_override", None)
    monkeypatch.setattr(store_supabase, "_client", None)
    store._runs.clear()
    store._progress.clear()
    store._pinned.clear()
    cache._beats.clear()
    store_supabase._progress.clear()


def _beat() -> Beat:
    return Beat(
        id=1,
        index=0,
        start_sec=0,
        end_sec=12,
        text_span="A door opens.",
        type=BeatType.setup,
        tension_delta=1,
        questions_opened=["Who is there?"],
        characters_present=["Asha"],
        stakes_level=2,
    )


def _run(run_id: str = "run_pinned_01") -> Run:
    audience = [
        AudienceMember(
            seat=seat,
            cohort="commuter",
            persona_id="commuter",
            variant_index=seat % 5,
            name=f"Listener {seat}",
            start_patience=6.0 + seat / 100,
            left_at_sec=12 if seat == 0 else None,
            left_at_beat=1 if seat == 0 else None,
            reason_code="PACING_FLAT" if seat == 0 else None,
            reason_label="Pacing flat" if seat == 0 else None,
            evidence="A door opens." if seat == 0 else None,
            patience_trace=[6.0, 5.5],
        )
        for seat in range(30)
    ]
    return Run(
        run_id=run_id,
        status="ready",
        created_at="2026-07-25T22:00:00+00:00",
        script=ScriptMeta(
            id="abc123def456",
            title="The Door",
            duration_sec=12,
            word_count=3,
        ),
        beats=[_beat()],
        cohorts=[
            Cohort(
                id="commuter",
                label="Commuters",
                context="On the train",
                seat_count=30,
                retained_pct=96.7,
            )
        ],
        audience=audience,
        drop_events=[
            DropEvent(
                id="drop_01",
                timestamp=12,
                beat_id=1,
                seats_lost=[0],
                cohort_breakdown={"commuter": 1},
                reason_code="PACING_FLAT",
                reason_label="Pacing flat",
                evidence="A door opens.",
                kind="structural",
            )
        ],
        agents=[
            AgentMeta(
                id="director",
                label="Director",
                lens="Staging",
            )
        ],
        notes=[
            Note(
                id="note_01",
                agent_id="director",
                beat_id=1,
                anchored_to_drop="drop_01",
                note_type="UNPLAYABLE_BEAT",
                note_label="Unplayable beat",
                text="Clarify the action.",
                evidence="A door opens.",
                severity=2,
            )
        ],
        room_synthesis=RoomSynthesis(
            recommended_fix="Clarify who opens the door.",
            predicted_seats_saved=1,
        ),
        summary=Summary(
            retained_pct=96.7,
            seats_total=30,
            seats_retained=29,
            biggest_cliff_sec=12,
            cohort_retention={"commuter": 96.7},
        ),
        audio=Audio(
            before_url="/before.wav",
            after_url="/after.wav",
            section_start_sec=0,
            section_end_sec=12,
        ),
        warnings=[Warning(code="DEGRADED", message="One scorer retried.")],
    )


def _use_supabase(
    monkeypatch: pytest.MonkeyPatch,
    client: Any,
) -> None:
    monkeypatch.setattr(config, "STORE_BACKEND", "supabase")
    monkeypatch.setattr(store_supabase, "_client_override", client)


def test_file_backend_never_touches_supabase(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        store_supabase,
        "save",
        lambda run: pytest.fail("Supabase save was called"),
    )
    monkeypatch.setattr(
        store_supabase,
        "get",
        lambda run_id: pytest.fail("Supabase get was called"),
    )
    run = _run()

    store.save(run)

    assert store.get(run.run_id) == run


def test_supabase_run_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    _use_supabase(monkeypatch, client)
    run = _run()

    store.save(run, raw_text="A door opens.", content_hash="full-digest")

    assert store.get(run.run_id) == run


def test_save_upserts_script_before_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    _use_supabase(monkeypatch, client)

    store.save(
        _run(),
        raw_text="A door opens.",
        content_hash="full-digest",
    )

    assert client.calls[:2] == [("scripts", "upsert"), ("runs", "upsert")]


def test_save_replaces_thirty_audience_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    _use_supabase(monkeypatch, client)
    run = _run()

    store.save(run, raw_text="A door opens.", content_hash="full-digest")
    store.save(run, raw_text="A door opens.", content_hash="full-digest")

    assert len(client.tables["audience"]) == 30
    assert {row["seat"] for row in client.tables["audience"]} == set(range(30))
    assert all(row["sensitivity"] == {} for row in client.tables["audience"])
    assert all(row["replenish"] == {} for row in client.tables["audience"])


def test_pin_then_find_pinned_resolves_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    _use_supabase(monkeypatch, client)
    run = _run()

    store.save(
        run,
        raw_text="A door opens.",
        content_hash="full-content-digest",
    )
    store.pin(run.run_id, "full-content-digest")

    assert store.find_pinned("full-content-digest") == run
    assert store.list_pinned() == ["run_pinned_01"]
    assert store.dangling_pins() == []


def test_every_operation_degrades_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _use_supabase(monkeypatch, RaisingClient())
    run = _run()
    progress = Progress(stage=Stage.QUEUED, message="Opening the hall", pct=0)

    store.save(run)
    store.pin(run.run_id, "digest")
    cache.put("digest", run.beats)
    store.set_progress(run.run_id, progress)

    assert store.get(run.run_id) is None
    assert store.find_pinned("digest") is None
    assert store.list_pinned() == []
    assert store.dangling_pins() == []
    assert store.is_writable() is False
    assert cache.get("digest") is None
    assert store.get_progress(run.run_id) == progress


def test_supabase_beat_cache_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    _use_supabase(monkeypatch, client)
    beats = [_beat()]

    cache.put("beat-digest", beats)

    assert cache.get("beat-digest") == beats
