"""Verification of the LLM adapter — written by the orchestrator, not the
agent that built the adapter.

FakeLLM is the fixture the entire rest of the team builds against for the next
day. If it drifts, every downstream stage is tuned against a lie, so the
guarantees are checked here rather than assumed.
"""

from __future__ import annotations

import asyncio

import pytest
from pydantic import BaseModel, Field

from app.fakes import FakeLLM
from app.llm import LLMError, OpenAILLM, gather_structured, get_llm
from app.models import DRAIN_CODES, REFILL_CODES, BeatDraftList, ScoredBeat


def _run(coro):
    return asyncio.run(coro)


# ── determinism ───────────────────────────────────────────────────────────


def test_fake_is_deterministic() -> None:
    fake = FakeLLM()
    a = _run(fake.structured(prompt="the same words", schema=ScoredBeat, model="m"))
    b = _run(fake.structured(prompt="the same words", schema=ScoredBeat, model="m"))
    assert a == b


def test_fake_varies_with_prompt() -> None:
    """Deterministic must not mean constant — every beat scoring the same
    would produce thirty identical listeners."""
    fake = FakeLLM()
    seen = {
        _run(fake.structured(prompt=f"chunk {i}", schema=ScoredBeat, model="m")).delta
        for i in range(40)
    }
    assert len(seen) > 1, "FakeLLM returns a constant delta — the room can't empty"


def test_fake_survives_a_fresh_instance() -> None:
    """State must live in the prompt hash, not on the object."""
    one = _run(FakeLLM().structured(prompt="p", schema=ScoredBeat, model="m"))
    two = _run(FakeLLM().structured(prompt="p", schema=ScoredBeat, model="m"))
    assert one == two


# ── the guarantee everything downstream depends on ────────────────────────


def test_scored_beat_sign_coherence() -> None:
    """A drain code with a positive delta is nonsense and would corrupt every
    retention curve built on top of it."""
    fake = FakeLLM()
    drains = refills = 0

    for i in range(200):
        got = _run(fake.structured(prompt=f"beat {i}", schema=ScoredBeat, model="m"))
        assert got.reason_code in DRAIN_CODES + REFILL_CODES, got.reason_code
        assert -3 <= got.delta <= 3
        assert got.evidence.strip(), "evidence must never be empty"

        if got.reason_code in DRAIN_CODES:
            drains += 1
            assert got.delta < 0, f"{got.reason_code} came back at {got.delta}"
        else:
            refills += 1
            assert got.delta > 0, f"{got.reason_code} came back at {got.delta}"

    assert drains and refills, "the sample must contain both kinds"
    assert drains > refills, (
        f"drains {drains} vs refills {refills} — a room that never empties "
        "gives A3/A4 nothing to detect"
    )


def test_beat_draft_list_is_usable() -> None:
    fake = FakeLLM()
    got = _run(
        fake.structured(prompt="INT. KITCHEN", schema=BeatDraftList, model="m")
    )
    assert 15 <= len(got.beats) <= 25, len(got.beats)
    assert all(b.text_span.strip() for b in got.beats)
    assert all(-3 <= b.tension_delta <= 3 for b in got.beats)
    assert all(1 <= b.stakes_level <= 5 for b in got.beats)
    assert len({b.type for b in got.beats}) > 1, "every chunk the same type is useless"


# ── generic schemas ───────────────────────────────────────────────────────


class _Odd(BaseModel):
    name: str
    count: int = Field(ge=2, le=7)
    ratio: float
    tags: list[str]
    flag: bool


def test_fake_fills_an_unseen_schema_within_constraints() -> None:
    got = _run(FakeLLM().structured(prompt="x", schema=_Odd, model="m"))
    assert isinstance(got, _Odd)
    assert 2 <= got.count <= 7
    assert got.name.strip()


# ── partial failure — the degradation policy depends on this ──────────────


def test_gather_returns_partial_results() -> None:
    """One persona failing must not cancel the other five."""

    async def ok(v):
        return v

    async def boom():
        raise RuntimeError("persona 3 fell over")

    results = _run(gather_structured([ok(1), boom(), ok(3)]))
    assert [r.ok for r in results] == [True, False, True]
    assert [r.value for r in results if r.ok] == [1, 3]
    assert isinstance(results[1].error, RuntimeError)


def test_gather_preserves_order() -> None:
    async def slow(v):
        await asyncio.sleep(0.02)
        return v

    async def fast(v):
        return v

    results = _run(gather_structured([slow("a"), fast("b"), slow("c")]))
    assert [r.value for r in results] == ["a", "b", "c"]


# ── backend selection ─────────────────────────────────────────────────────


def test_missing_key_fails_at_construction_not_first_call(monkeypatch) -> None:
    monkeypatch.setattr("app.config.OPENAI_API_KEY", "")
    with pytest.raises(LLMError):
        OpenAILLM()


def test_get_llm_rejects_an_unknown_backend(monkeypatch) -> None:
    monkeypatch.setattr("app.config.LLM_BACKEND", "gemini")
    with pytest.raises(LLMError):
        get_llm()


def test_default_backend_needs_no_key(monkeypatch) -> None:
    monkeypatch.setattr("app.config.LLM_BACKEND", "fake")
    monkeypatch.setattr("app.config.OPENAI_API_KEY", "")
    assert isinstance(get_llm(), FakeLLM)


def test_only_llm_imports_openai() -> None:
    """The whole point of the adapter: one module owns the SDK."""
    import pathlib

    app_dir = pathlib.Path(__file__).resolve().parent.parent / "app"
    offenders = [
        p.relative_to(app_dir)
        for p in app_dir.rglob("*.py")
        if p.name != "llm.py" and "openai" in p.read_text()
    ]
    assert not offenders, f"openai referenced outside llm.py: {offenders}"
