from __future__ import annotations

from pydantic import BaseModel

from app import config
from app.llm import LLM, LLMError, get_llm
from app.models import Beat
from app.prompts import surgeon
from app.stages.a1_parse import beats_digest


class BeatOrder(BaseModel):
    order: list[int]


def classify_change(before: list[int], after: list[int]) -> str:
    if len(before) != len(set(before)) or len(after) != len(set(after)):
        return "invalid"

    if len(after) == len(before) - 1:
        removals = [
            index
            for index in range(len(before))
            if before[:index] + before[index + 1 :] == after
        ]
        return "cut" if len(removals) == 1 else "invalid"

    if len(after) != len(before) or set(after) != set(before) or after == before:
        return "invalid"

    # If removing some single beat from both lists makes them equal, `after`
    # is `before` with exactly one beat relocated. That is a valid move.
    #
    # More than one candidate does NOT mean more than one move — it means the
    # move was short enough to be ambiguous about which neighbour travelled.
    # Swapping adjacent beats reads as "move 2 earlier" or "move 1 later"; it
    # is one move either way. Requiring a unique candidate here rejected every
    # minimal nudge, so "move the reveal slightly earlier" — exactly the kind
    # of fix the room recommends — failed twice and killed the fix path.
    moved_ids = [
        beat_id
        for beat_id in before
        if (
            [candidate for candidate in before if candidate != beat_id]
            == [candidate for candidate in after if candidate != beat_id]
        )
    ]
    return "move" if moved_ids else "invalid"


def _invalid_order_reason(before: list[int], after: list[int]) -> str:
    if len(after) != len(set(after)):
        return "the returned order contains duplicate chunk ids"
    unknown = [beat_id for beat_id in after if beat_id not in set(before)]
    if unknown:
        return f"the returned order contains unknown chunk ids: {unknown}"
    return "the returned order is not exactly one unambiguous move or one cut"


def _rebuild_beats(beats: list[Beat], order: list[int]) -> list[Beat]:
    by_id = {beat.id: beat for beat in beats}
    words_before = 0
    rebuilt: list[Beat] = []

    for index, beat_id in enumerate(order):
        beat = by_id[beat_id]
        start_sec = round(words_before / config.WORDS_PER_MINUTE * 60)
        words_before += len(beat.text_span.split())
        end_sec = round(words_before / config.WORDS_PER_MINUTE * 60)
        rebuilt.append(
            beat.model_copy(
                update={
                    "index": index,
                    "start_sec": start_sec,
                    "end_sec": end_sec,
                }
            )
        )
    return rebuilt


async def apply_fix(
    beats: list[Beat], fix: str, llm: LLM | None = None
) -> list[Beat]:
    active_llm = get_llm() if llm is None else llm
    before = [beat.id for beat in beats]
    prompt = surgeon.build_prompt(beats_digest(beats), fix)
    last_order: list[int] = []

    for attempt in range(2):
        result = await active_llm.structured(
            prompt=prompt,
            schema=BeatOrder,
            model=config.MODEL_SYNTH,
            system=surgeon.build_system(),
        )
        last_order = result.order
        if classify_change(before, last_order) in {"move", "cut"}:
            return _rebuild_beats(beats, last_order)

        if attempt == 0:
            reason = _invalid_order_reason(before, last_order)
            prompt = (
                f"{prompt}\n\n"
                "PREVIOUS RESULT REJECTED\n"
                f"You returned {last_order}. It was rejected because {reason}. "
                "Try once more and return exactly one valid move or cut."
            )

    raise LLMError(
        f"Surgeon returned an invalid structural change twice: {last_order}."
    )
