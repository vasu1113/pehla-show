from __future__ import annotations

from app import blindfold, config, models
from app.llm import LLM, LLMError, get_llm
from app.models import AttentionDelta, Beat, Persona, ScoredBeat
from app.prompts import scorer


def _neutral_delta(beat_id: int) -> AttentionDelta:
    return AttentionDelta(
        beat_id=beat_id,
        delta=0,
        reason_code="PACING_FLAT",
        evidence="",
        reaction_line="",
    )


async def score_persona_verbose(
    beats: list[Beat], persona: Persona, llm: LLM | None = None
) -> tuple[list[AttentionDelta], int]:
    active_llm = get_llm() if llm is None else llm
    deltas: list[AttentionDelta] = []
    degraded_beats = 0

    for upto, beat in enumerate(beats):
        rendered = blindfold.build_scorer_input(beats, upto, persona)
        try:
            scored = await active_llm.structured(
                prompt=scorer.build_prompt(rendered, persona),
                schema=ScoredBeat,
                model=config.MODEL_SCORER,
                system=scorer.build_system(),
            )
        except LLMError:
            deltas.append(_neutral_delta(beat.id))
            degraded_beats += 1
            continue

        if scored.reason_code not in models.ALL_REASON_CODES:
            deltas.append(_neutral_delta(beat.id))
            degraded_beats += 1
            continue

        deltas.append(
            AttentionDelta(
                beat_id=beat.id,
                delta=scored.delta,
                reason_code=scored.reason_code,
                evidence=scored.evidence,
                reaction_line=scored.reaction_line,
            )
        )

    return deltas, degraded_beats


async def score_persona(
    beats: list[Beat], persona: Persona, llm: LLM | None = None
) -> list[AttentionDelta]:
    deltas, _ = await score_persona_verbose(beats, persona, llm)
    return deltas
