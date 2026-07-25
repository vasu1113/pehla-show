from __future__ import annotations

import hashlib

from app import config
from app.llm import LLM, get_llm
from app.models import Beat, BeatDraftList
from app.prompts import beat_parser


def content_hash(raw_text: str) -> str:
    return hashlib.sha256(raw_text.encode("utf-8")).hexdigest()


async def parse_beats(raw_text: str, llm: LLM | None = None) -> list[Beat]:
    active_llm = get_llm() if llm is None else llm
    drafts = await active_llm.structured(
        prompt=beat_parser.build_prompt(raw_text),
        schema=BeatDraftList,
        model=config.MODEL_PARSER,
        system=beat_parser.build_system(),
    )

    words_before = 0
    beats: list[Beat] = []
    for index, draft in enumerate(drafts.beats):
        start_sec = round(words_before / config.WORDS_PER_MINUTE * 60)
        words_before += len(draft.text_span.split())
        end_sec = round(words_before / config.WORDS_PER_MINUTE * 60)
        beats.append(
            Beat(
                id=index,
                index=index,
                start_sec=start_sec,
                end_sec=end_sec,
                **draft.model_dump(),
            )
        )
    return beats


def beats_digest(beats: list[Beat]) -> str:
    lines: list[str] = []
    for beat in beats:
        minutes, seconds = divmod(beat.start_sec, 60)
        text = " ".join(beat.text_span.split())
        excerpt = text[:80]
        if len(text) > len(excerpt):
            excerpt = f"{excerpt[:-1]}…"
        lines.append(
            f"[{beat.id}] {minutes:02d}:{seconds:02d} {beat.type.value} — {excerpt}"
        )
    return "\n".join(lines)
