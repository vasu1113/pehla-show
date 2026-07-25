from __future__ import annotations

from app import config
from app.llm import LLM, get_llm
from app.models import DropEvent, Note, RoomSynthesis
from app.prompts import synthesis


def _notes_digest(notes: list[Note]) -> str:
    return "\n".join(
        (
            f"[{note.id}] beat={note.beat_id} {note.agent_id.value}/"
            f"{note.note_type.value} severity={note.severity}: "
            f"{' '.join(note.text.split())}"
        )
        for note in notes
    )


def _drops_digest(drop_events: list[DropEvent]) -> str:
    return "\n".join(
        (
            f"[{event.id}] beat={event.beat_id} lost={len(event.seats_lost)} "
            f"{event.reason_code}: {' '.join(event.evidence.split())}"
        )
        for event in drop_events
    )


async def synthesise_room(
    notes: list[Note],
    drop_events: list[DropEvent],
    seats_lost: int,
    llm: LLM | None = None,
) -> RoomSynthesis | None:
    try:
        active_llm = get_llm() if llm is None else llm
        result = await active_llm.structured(
            prompt=synthesis.build_prompt(
                _notes_digest(notes),
                _drops_digest(drop_events),
                seats_lost,
            ),
            schema=RoomSynthesis,
            model=config.MODEL_SYNTH,
            system=synthesis.build_system(),
        )
    except Exception:
        return None

    valid_beat_ids = {
        note.beat_id for note in notes
    } | {
        event.beat_id for event in drop_events
    }
    return result.model_copy(
        update={
            "consensus": [
                item
                for item in result.consensus
                if item.beat_id in valid_beat_ids
            ],
            "conflict": [
                item
                for item in result.conflict
                if item.beat_id in valid_beat_ids
            ],
        }
    )
