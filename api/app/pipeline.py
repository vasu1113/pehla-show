from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app import cache, config, models, store
from app.blindfold import BlindfoldViolation
from app.llm import LLM, get_llm
from app.prompts.expert import LENSES as EXPERT_LENSES
from app.stages import (
    a0_cast,
    a1_parse,
    a2_score,
    a3_simulate,
    a4_cliffs,
    a6_experts,
    a7_synth,
    a8_fix,
)


class _AudienceFailure(RuntimeError):
    def __init__(self, message: str, warnings: list[models.Warning]) -> None:
        super().__init__(message)
        self.warnings = warnings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _progress(
    run_id: str,
    stage: models.Stage,
    pct: int,
    *,
    beats_total: int = 0,
    beats_done: int = 0,
) -> None:
    store.set_progress(
        run_id,
        models.Progress(
            stage=stage,
            message=models.STAGE_MESSAGE[stage],
            pct=pct,
            beats_total=beats_total,
            beats_done=beats_done,
        ),
    )


def _load_personas(persona_ids: list[str] | None = None) -> list[models.Persona]:
    if persona_ids:
        return store.get_personas(persona_ids)
    required = config.SEAT_COUNT // a0_cast.SEATS_PER_PERSONA
    return store.list_personas()[:required]


def _script_meta(
    raw_text: str,
    title: str,
    *,
    duration_sec: int = 0,
) -> models.ScriptMeta:
    return models.ScriptMeta(
        id=a1_parse.content_hash(raw_text)[:12],
        title=title,
        duration_sec=duration_sec,
        word_count=len(raw_text.split()),
    )


def _agents() -> list[models.AgentMeta]:
    return [
        models.AgentMeta(
            id=agent_id.value,
            label=lens["label"],
            lens=lens["lens"],
        )
        for agent_id, lens in EXPERT_LENSES.items()
    ]


def _terminal_error(
    run: models.Run,
    *,
    code: str,
    message: str,
) -> models.Run:
    failed = run.model_copy(
        deep=True,
        update={
            "status": "error",
            "warnings": [
                *run.warnings,
                models.Warning(code=code, message=message),
            ],
        },
    )
    store.save(failed)
    _progress(failed.run_id, models.Stage.ERROR, 100)
    return failed


def _summary(
    audience: list[models.AudienceMember],
    drops: list[models.DropEvent],
    personas: list[models.Persona],
) -> tuple[list[models.Cohort], models.Summary]:
    cohort_retention: dict[str, float] = {}
    cohorts: list[models.Cohort] = []

    for persona in personas:
        seats = [member for member in audience if member.cohort == persona.id]
        stayed = [member for member in seats if member.left_at_sec is None]
        retained = round(len(stayed) / len(seats), 3) if seats else 0.0
        cohort_retention[persona.id] = retained
        cohorts.append(
            models.Cohort(
                id=persona.id,
                label=persona.label,
                context=persona.prompt,
                seat_count=a0_cast.SEATS_PER_PERSONA,
                retained_pct=retained,
            )
        )

    seats_retained = sum(
        member.left_at_sec is None for member in audience
    )
    retained_pct = (
        round(seats_retained / len(audience), 3) if audience else 0.0
    )
    biggest_cliff = (
        max(drops, key=lambda event: len(event.seats_lost)).timestamp
        if drops
        else None
    )
    return cohorts, models.Summary(
        retained_pct=retained_pct,
        seats_total=len(audience),
        seats_retained=seats_retained,
        biggest_cliff_sec=biggest_cliff,
        cohort_retention=cohort_retention,
    )


async def _screen(
    run_id: str,
    beats: list[models.Beat],
    personas: list[models.Persona],
    llm: LLM,
) -> tuple[
    list[models.Persona],
    list[models.AudienceMember],
    list[models.DropEvent],
    list[models.Warning],
]:
    cast = a0_cast.spawn_audience(personas)
    total_calls = len(personas)
    beats_total = len(beats) * total_calls
    _progress(
        run_id,
        models.Stage.SCREENING,
        30,
        beats_total=beats_total,
    )

    async def score_one(
        persona: models.Persona,
    ) -> tuple[
        models.Persona,
        tuple[list[models.AttentionDelta], int] | None,
        BaseException | None,
    ]:
        try:
            result = await a2_score.score_persona_verbose(beats, persona, llm)
        except BaseException as error:
            if isinstance(error, asyncio.CancelledError):
                raise
            # A leak is NOT a cohort failure and must never be degraded into
            # one. Swallowing it here would drop one cohort, add a mild
            # warning, and let the run finish — producing a full set of
            # confident numbers from a model that could see the ending. That
            # is the single failure this product cannot survive quietly, so it
            # takes the whole run down.
            if isinstance(error, BlindfoldViolation):
                raise
            return persona, None, error
        return persona, result, None

    tasks = [
        asyncio.create_task(score_one(persona))
        for persona in personas
    ]
    completed: dict[
        str,
        tuple[tuple[list[models.AttentionDelta], int] | None, BaseException | None],
    ] = {}
    for count, result in enumerate(asyncio.as_completed(tasks), start=1):
        persona, scored, error = await result
        completed[persona.id] = (scored, error)
        pct = 30 + round(40 * count / total_calls) if total_calls else 70
        _progress(
            run_id,
            models.Stage.SCREENING,
            pct,
            beats_total=beats_total,
            beats_done=count * len(beats),
        )

    deltas: dict[str, list[models.AttentionDelta]] = {}
    kept: list[models.Persona] = []
    warnings: list[models.Warning] = []
    failures = 0

    for persona in personas:
        scored, error = completed[persona.id]
        if error is not None or scored is None:
            failures += 1
            warnings.append(
                models.Warning(
                    code="COHORT_DROPPED",
                    message=f"{persona.label} could not be simulated.",
                )
            )
            continue

        scores, degraded = scored
        deltas[persona.id] = scores
        kept.append(persona)
        if degraded:
            warnings.append(
                models.Warning(
                    code="BEATS_DEGRADED",
                    message=(
                        f"{degraded} beat(s) scored neutral for "
                        f"{persona.label}."
                    ),
                )
            )

    if failures >= 3:
        raise _AudienceFailure(
            "Three or more audience cohorts failed.",
            warnings,
        )

    kept_ids = {persona.id for persona in kept}
    kept_cast = [member for member in cast if member[0].id in kept_ids]
    audience = a3_simulate.simulate_population(deltas, kept_cast, beats)
    drops = a4_cliffs.detect_cliffs(audience, beats)
    return kept, audience, drops, warnings


async def analyse(
    run_id: str,
    raw_text: str,
    title: str,
    persona_ids: list[str] | None = None,
) -> models.Run:
    run = models.Run(
        run_id=run_id,
        status="analysing",
        created_at=_now(),
        script=_script_meta(raw_text, title),
    )
    store.save(run)
    _progress(run_id, models.Stage.QUEUED, 0)

    try:
        _progress(run_id, models.Stage.PARSING_BEATS, 10)
        digest = a1_parse.content_hash(raw_text)
        beats = cache.get(digest)
        llm = get_llm()
        if beats is None:
            beats = await a1_parse.parse_beats(raw_text, llm)
            if not beats:
                raise ValueError("Beat parser returned no beats.")
            cache.put(digest, beats)
    except Exception as error:
        return _terminal_error(
            run,
            code="BEAT_PARSE_FAILED",
            message=f"The script could not be parsed: {error}",
        )

    run = run.model_copy(
        deep=True,
        update={
            "beats": beats,
            "script": _script_meta(
                raw_text,
                title,
                duration_sec=beats[-1].end_sec,
            ),
        },
    )
    store.save(run)

    try:
        _progress(run_id, models.Stage.SEATING_AUDIENCE, 25)
        personas = _load_personas(persona_ids)
        kept, audience, drops, warnings = await _screen(
            run_id,
            beats,
            personas,
            llm,
        )
    except BlindfoldViolation as error:
        # Distinct from every other failure on purpose. This does not mean a
        # call failed — it means the instrument was reading the ending, and
        # every number it produced is worthless. Say so in its own words.
        return _terminal_error(
            run,
            code="BLINDFOLD_VIOLATED",
            message=(
                "The scorer was shown a chunk it should not have seen, so the "
                f"screening is not valid: {error}"
            ),
        )
    except _AudienceFailure as error:
        run = run.model_copy(
            deep=True,
            update={"warnings": [*run.warnings, *error.warnings]},
        )
        return _terminal_error(
            run,
            code="AUDIENCE_FAILED",
            message=f"The audience screening could not continue: {error}",
        )
    except Exception as error:
        return _terminal_error(
            run,
            code="AUDIENCE_FAILED",
            message=f"The audience screening could not continue: {error}",
        )

    cohorts, summary = _summary(audience, drops, kept)
    run = run.model_copy(
        deep=True,
        update={
            "cohorts": cohorts,
            "audience": audience,
            "drop_events": drops,
            "summary": summary,
            "warnings": warnings,
        },
    )
    store.save(run)

    _progress(run_id, models.Stage.CONVENING_ROOM, 75)
    try:
        notes, room_warnings = await a6_experts.convene_room(
            raw_text,
            beats,
            drops,
            llm,
        )
    except Exception:
        notes = []
        room_warnings = [
            models.Warning(
                code="EXPERT_DROPPED",
                message="Writers-room critics unavailable.",
            )
        ]
    warnings.extend(room_warnings)

    _progress(run_id, models.Stage.SYNTHESISING, 90)
    synthesis = None
    if notes:
        synthesis = await a7_synth.synthesise_room(
            notes,
            drops,
            summary.seats_total - summary.seats_retained,
            llm,
        )
        if synthesis is None:
            warnings.append(
                models.Warning(
                    code="ROOM_SYNTHESIS_FAILED",
                    message="Room synthesis was unavailable; notes are ungrouped.",
                )
            )

    ready = run.model_copy(
        deep=True,
        update={
            "status": "ready",
            "agents": _agents(),
            "notes": notes,
            "room_synthesis": synthesis,
            "warnings": warnings,
        },
    )
    store.save(ready)
    _progress(run_id, models.Stage.READY, 100)
    return ready


async def apply_recommended_fix(
    parent: models.Run,
    fix: str | None,
    run_id: str,
) -> models.Run:
    selected_fix = (
        fix
        if fix is not None
        else (
            parent.room_synthesis.recommended_fix
            if parent.room_synthesis is not None
            else None
        )
    )
    if selected_fix is None:
        raise ValueError("No fix or room recommendation is available.")

    run = models.Run(
        run_id=run_id,
        parent_run_id=parent.run_id,
        variant="fixed",
        status="analysing",
        created_at=_now(),
        script=parent.script.model_copy(deep=True),
        agents=[agent.model_copy(deep=True) for agent in parent.agents],
        notes=[note.model_copy(deep=True) for note in parent.notes],
        room_synthesis=(
            parent.room_synthesis.model_copy(deep=True)
            if parent.room_synthesis is not None
            else None
        ),
    )
    store.save(run)
    _progress(run_id, models.Stage.QUEUED, 0)

    try:
        _progress(run_id, models.Stage.PARSING_BEATS, 10)
        llm = get_llm()
        beats = await a8_fix.apply_fix(parent.beats, selected_fix, llm)
        run = run.model_copy(
            deep=True,
            update={
                "beats": beats,
                "script": parent.script.model_copy(
                    update={
                        "duration_sec": beats[-1].end_sec,
                        "word_count": sum(
                            len(beat.text_span.split()) for beat in beats
                        ),
                    }
                ),
            },
        )
        store.save(run)

        _progress(run_id, models.Stage.SEATING_AUDIENCE, 25)
        personas = _load_personas([cohort.id for cohort in parent.cohorts])
        kept, audience, drops, warnings = await _screen(
            run_id,
            beats,
            personas,
            llm,
        )
    except _AudienceFailure as error:
        run = run.model_copy(
            deep=True,
            update={"warnings": [*run.warnings, *error.warnings]},
        )
        return _terminal_error(
            run,
            code="FIX_FAILED",
            message=f"The recommended fix could not be applied: {error}",
        )
    except Exception as error:
        return _terminal_error(
            run,
            code="FIX_FAILED",
            message=f"The recommended fix could not be applied: {error}",
        )

    cohorts, summary = _summary(audience, drops, kept)

    # A cut removes a beat, and the notes inherited from the parent may be
    # anchored to it. The contract is explicit that a note without a valid
    # beat_id must not be emitted - A6 enforces that on the way in, and the
    # fix path has to hold the same line on the way through, or Track B ends
    # up rendering a note pointing at a beat that no longer exists.
    live_beat_ids = {beat.id for beat in beats}
    # Drop ids are renumbered from de_01 every time the audience is
    # re-simulated, so an inherited anchored_to_drop points at whatever
    # happens to hold that slot now — a different moment, or nothing. Re-anchor
    # to the drop on the same beat if the fix left one, otherwise clear it.
    drop_by_beat = {event.beat_id: event.id for event in drops}
    notes = [
        note.model_copy(update={"anchored_to_drop": drop_by_beat.get(note.beat_id)})
        for note in run.notes
        if note.beat_id in live_beat_ids
    ]
    orphaned = len(run.notes) - len(notes)
    if orphaned:
        warnings = [
            *warnings,
            models.Warning(
                code="NOTES_DROPPED",
                message=(
                    f"{orphaned} note(s) referred to a chunk the fix removed."
                ),
            ),
        ]

    synthesis = run.room_synthesis
    if synthesis is not None:
        synthesis = synthesis.model_copy(
            update={
                "consensus": [
                    c for c in synthesis.consensus if c.beat_id in live_beat_ids
                ],
                "conflict": [
                    c for c in synthesis.conflict if c.beat_id in live_beat_ids
                ],
            }
        )

    ready = run.model_copy(
        deep=True,
        update={
            "status": "ready",
            "cohorts": cohorts,
            "audience": audience,
            "drop_events": drops,
            "notes": notes,
            "room_synthesis": synthesis,
            "summary": summary,
            "warnings": warnings,
        },
    )
    store.save(ready)
    _progress(run_id, models.Stage.READY, 100)
    return ready
