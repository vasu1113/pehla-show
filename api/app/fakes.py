from __future__ import annotations

import hashlib
import math
import random
import re
import types
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Annotated, Any, Literal, TypeVar, Union, get_args, get_origin
from uuid import UUID

from pydantic import BaseModel
from pydantic.fields import FieldInfo

from app import models

BaseModelT = TypeVar("BaseModelT", bound=BaseModel)
_NONE_TYPE = type(None)


class FakeLLM:
    async def structured(
        self,
        *,
        prompt: str,
        schema: type[BaseModelT],
        model: str,
        system: str | None = None,
    ) -> BaseModelT:
        digest = hashlib.sha256(
            (prompt + schema.__name__).encode("utf-8")
        ).digest()
        rng = random.Random(int.from_bytes(digest, byteorder="big"))

        if schema is models.BeatDraftList:
            return schema.model_validate(self._beat_drafts(prompt, rng))
        if schema is models.ScoredBeat:
            return schema.model_validate(self._scored_beat(rng, prompt))
        if schema.__name__ == "ExpertNoteDraftList":
            return schema.model_validate(self._expert_notes(prompt, rng))
        return schema.model_validate(self._model_values(schema, rng))

    def _beat_drafts(self, prompt: str, rng: random.Random) -> dict[str, object]:
        beat_count = rng.randint(15, 25)
        script = self._extract_script(prompt)
        spans = self._script_spans(script, beat_count)
        if spans is None:
            spans = [
                (
                    f"Maya follows clue {index + 1} through the crowded station "
                    "while the last train approaches."
                )
                for index in range(beat_count)
            ]

        beat_types = list(models.BeatType)
        characters = ("Maya", "Arjun", "Leela", "Kabir", "Inspector Rao")
        type_offset = rng.randrange(len(beat_types))
        tension_offset = rng.randrange(7)
        stakes_offset = rng.randrange(5)
        beats: list[dict[str, object]] = []

        for index, text_span in enumerate(spans):
            character_count = rng.randint(1, 3)
            opened = (
                [f"Who is behind clue {index + 1}?"]
                if index % 4 == 0
                else []
            )
            closed = (
                [f"The meaning of clue {max(1, index - 2)} is revealed."]
                if index > 2 and index % 5 == 0
                else []
            )
            beats.append(
                {
                    "text_span": text_span,
                    "type": beat_types[(index + type_offset) % len(beat_types)],
                    "tension_delta": ((index + tension_offset) % 7) - 3,
                    "questions_opened": opened,
                    "questions_closed": closed,
                    "characters_present": rng.sample(
                        characters, k=character_count
                    ),
                    "stakes_level": ((index + stakes_offset) % 5) + 1,
                }
            )
        return {"beats": beats}

    @staticmethod
    def _scored_beat(rng: random.Random, prompt: str) -> dict[str, object]:
        # Whether a beat drains is a property of the BEAT, not of who is
        # listening — otherwise a genuinely bad beat is bad for a random
        # subset of cohorts, every walkout is a taste split, and the
        # structural/taste_split distinction A4 exists to draw never fires.
        # So: the beat decides drain-vs-refill and the base magnitude; the
        # persona only modulates it. That also matches how the real thing
        # behaves — everyone hits a broken beat, they just hit it differently.
        beat_rng = random.Random(
            hashlib.sha256(
                FakeLLM._current_chunk(prompt).encode("utf-8")
            ).hexdigest()
        )
        is_drain = beat_rng.randrange(3) != 0
        base = beat_rng.randint(1, 3)

        # ±1 of persona wobble, so cohorts still disagree about how much.
        magnitude = max(1, min(3, base + rng.choice((-1, 0, 0, 1))))

        if is_drain:
            return {
                "delta": -magnitude,
                "reason_code": beat_rng.choice(models.DRAIN_CODES),
                "evidence": "The beat delays the central question.",
            }
        return {
            "delta": magnitude,
            "reason_code": beat_rng.choice(models.REFILL_CODES),
            "evidence": "A fresh reveal sharpens the central question.",
        }

    @staticmethod
    def _expert_notes(prompt: str, rng: random.Random) -> dict[str, object]:
        """Notes clustered on the beats where people actually left.

        The expert prompt tells each critic to prefer beats with drop events.
        A fake that scatters notes at random ignores that instruction, so no
        two critics land on the same beat, nothing agrees, nothing conflicts,
        and A7 synthesises an empty room — which would misrepresent the
        product to whoever builds screens against this fixture.
        """
        # Match the explicit "YOU ARE THE X" header, not a loose substring
        # scan: several lenses name each other in their briefs (the Historian
        # is told the Editor will want to cut the texture she defends), so
        # substring matching silently files one critic's notes under another
        # agent, and A6 then drops all of them for using the wrong note types.
        header = re.search(r"YOU ARE THE ([A-Z]+)", prompt)
        agent = (
            models.AgentId(header.group(1).lower())
            if header and header.group(1).lower() in {a.value for a in models.AgentId}
            else models.AgentId.editor
        )
        allowed = models.NOTE_TYPES_BY_AGENT[agent]

        # Pull the drop-event beats straight out of the digest the prompt
        # already carries: "[de_01] beat=9 lost=5 ...".
        hot = [int(m) for m in re.findall(r"\bbeat=(\d+)", prompt)]
        known = [int(m) for m in re.findall(r"^\[(\d+)\]", prompt, re.MULTILINE)]
        pool = hot or known or [0]

        notes: list[dict[str, object]] = []
        for i in range(3):
            # Mostly a contested beat, occasionally somewhere else — enough
            # overlap between critics to produce real agreement and conflict.
            beat_id = pool[i % len(pool)] if i < 2 else rng.choice(known or pool)
            notes.append(
                {
                    "beat_id": beat_id,
                    "note_type": allowed[i % len(allowed)].value,
                    "text": f"{agent.value.title()} note on chunk {beat_id}.",
                    "evidence": "and so it had been for many years",
                    "severity": rng.randint(2, 5),
                    "anchored_to_drop": None,
                }
            )
        return {"notes": notes}

    @staticmethod
    def _current_chunk(prompt: str) -> str:
        """The beat being scored, isolated from the persona and the history.

        blindfold.build_scorer_input puts it under a fixed header; falling
        back to the whole prompt keeps this safe if that copy ever changes.
        """
        marker = "THE CHUNK THEY ARE HEARING NOW"
        _, sep, tail = prompt.partition(marker)
        if not sep:
            return prompt
        return tail.split("─")[0].strip()

    @staticmethod
    def _extract_script(prompt: str) -> str | None:
        candidates: list[str] = []
        patterns = (
            r"<(?:script|screenplay)(?:\s[^>]*)?>(.*?)</(?:script|screenplay)>",
            r"```(?:screenplay|script|text)?\s*\n(.*?)```",
            r"(?:^|\n)(?:SCRIPT|SCREENPLAY)(?:\s+TEXT)?\s*:\s*(.*)",
        )
        for pattern in patterns:
            candidates.extend(
                match.strip()
                for match in re.findall(
                    pattern, prompt, flags=re.IGNORECASE | re.DOTALL
                )
                if match.strip()
            )
        if candidates:
            return max(candidates, key=len)
        if len(prompt.split()) >= 40:
            return prompt.strip()
        return None

    @staticmethod
    def _script_spans(script: str | None, count: int) -> list[str] | None:
        if script is None:
            return None
        words = list(re.finditer(r"\S+", script))
        if len(words) < count * 2:
            return None

        spans: list[str] = []
        for index in range(count):
            first = math.floor(index * len(words) / count)
            last = math.floor((index + 1) * len(words) / count) - 1
            start = words[first].start()
            end = words[last].end()
            spans.append(script[start:end])
        return spans

    def _model_values(
        self,
        schema: type[BaseModel],
        rng: random.Random,
        *,
        depth: int = 0,
    ) -> dict[str, object]:
        return {
            name: self._field_value(
                field.annotation,
                field,
                rng,
                name=name,
                depth=depth,
            )
            for name, field in schema.model_fields.items()
        }

    def _field_value(
        self,
        annotation: Any,
        field: FieldInfo | None,
        rng: random.Random,
        *,
        name: str,
        depth: int,
    ) -> object:
        origin = get_origin(annotation)
        args = get_args(annotation)

        if origin is Annotated:
            return self._field_value(
                args[0], field, rng, name=name, depth=depth
            )
        if origin in (Union, types.UnionType):
            choices = [choice for choice in args if choice is not _NONE_TYPE]
            if not choices:
                return None
            return self._field_value(
                choices[0], field, rng, name=name, depth=depth
            )
        if origin is Literal:
            return args[0]
        if origin is list:
            item_type = args[0] if args else str
            return [
                self._field_value(
                    item_type,
                    None,
                    rng,
                    name=self._singular(name),
                    depth=depth + 1,
                )
                for _ in range(2)
            ]
        if origin is dict:
            key_type, value_type = args if len(args) == 2 else (str, str)
            return {
                self._field_value(
                    key_type,
                    None,
                    rng,
                    name=f"{name}_key_{index}",
                    depth=depth + 1,
                ): self._field_value(
                    value_type,
                    None,
                    rng,
                    name=f"{name}_value",
                    depth=depth + 1,
                )
                for index in range(2)
            }
        if origin is tuple:
            if len(args) == 2 and args[1] is Ellipsis:
                return tuple(
                    self._field_value(
                        args[0], None, rng, name=name, depth=depth + 1
                    )
                    for _ in range(2)
                )
            return tuple(
                self._field_value(
                    item_type, None, rng, name=name, depth=depth + 1
                )
                for item_type in args
            )
        if origin in (set, frozenset):
            item_type = args[0] if args else str
            values = {
                self._field_value(
                    item_type,
                    None,
                    rng,
                    name=f"{name}_{index}",
                    depth=depth + 1,
                )
                for index in range(2)
            }
            return origin(values)

        if isinstance(annotation, type) and issubclass(annotation, Enum):
            return list(annotation)[rng.randrange(len(annotation))]
        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            if depth >= 8:
                return {}
            return self._model_values(annotation, rng, depth=depth + 1)
        if annotation is bool:
            return bool(rng.randrange(2))
        if annotation is int:
            return self._number_value(field, rng, integer=True)
        if annotation is float:
            return self._number_value(field, rng, integer=False)
        if annotation is Decimal:
            return Decimal(str(self._number_value(field, rng, integer=False)))
        if annotation is str:
            return self._string_value(name, field, rng)
        if annotation is bytes:
            return self._string_value(name, field, rng).encode("utf-8")
        if annotation is datetime:
            return datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        if annotation is date:
            return date(2026, 1, 1)
        if annotation is UUID:
            return UUID(int=rng.getrandbits(128), version=4)
        if annotation is Any:
            return self._string_value(name, field, rng)
        return self._string_value(name, field, rng)

    @staticmethod
    def _number_value(
        field: FieldInfo | None,
        rng: random.Random,
        *,
        integer: bool,
    ) -> int | float:
        constraints = list(field.metadata) if field is not None else []
        ge = next(
            (
                constraint.ge
                for constraint in constraints
                if getattr(constraint, "ge", None) is not None
            ),
            None,
        )
        gt = next(
            (
                constraint.gt
                for constraint in constraints
                if getattr(constraint, "gt", None) is not None
            ),
            None,
        )
        le = next(
            (
                constraint.le
                for constraint in constraints
                if getattr(constraint, "le", None) is not None
            ),
            None,
        )
        lt = next(
            (
                constraint.lt
                for constraint in constraints
                if getattr(constraint, "lt", None) is not None
            ),
            None,
        )

        if integer:
            low = math.ceil(ge) if ge is not None else 1
            if gt is not None:
                low = max(low, math.floor(gt) + 1)
            high = math.floor(le) if le is not None else low + 20
            if lt is not None:
                high = min(high, math.ceil(lt) - 1)
            return rng.randint(low, max(low, high))

        low_float = float(ge) if ge is not None else 0.5
        if gt is not None:
            low_float = max(low_float, float(gt) + 0.1)
        high_float = float(le) if le is not None else low_float + 10.0
        if lt is not None:
            high_float = min(high_float, float(lt) - 0.1)
        return round(rng.uniform(low_float, max(low_float, high_float)), 2)

    @staticmethod
    def _string_value(
        name: str,
        field: FieldInfo | None,
        rng: random.Random,
    ) -> str:
        lowered = name.lower()
        suffix = rng.randint(100, 999)
        if "reason_code" in lowered:
            value = rng.choice(models.ALL_REASON_CODES)
        elif lowered.endswith("url"):
            value = f"https://example.test/{lowered}/{suffix}"
        elif lowered in {"created_at", "timestamp_iso"}:
            value = "2026-01-01T12:00:00+00:00"
        elif lowered.endswith("id") or "_id" in lowered:
            value = f"{lowered.replace('_', '-')}-{suffix}"
        elif "evidence" in lowered:
            value = "The locked door changes what the audience expects."
        elif "text" in lowered or "claim" in lowered:
            value = "A concrete reveal raises the cost of turning back."
        elif "title" in lowered:
            value = "The Last Platform"
        elif "name" in lowered:
            value = f"Maya {suffix}"
        elif "label" in lowered:
            value = f"Focused audience {suffix}"
        elif "context" in lowered or "lens" in lowered:
            value = "Watching closely for pace, clarity, and emotional stakes."
        else:
            value = f"plausible-{lowered.replace('_', '-')}-{suffix}"

        constraints = list(field.metadata) if field is not None else []
        min_length = next(
            (
                constraint.min_length
                for constraint in constraints
                if getattr(constraint, "min_length", None) is not None
            ),
            0,
        )
        max_length = next(
            (
                constraint.max_length
                for constraint in constraints
                if getattr(constraint, "max_length", None) is not None
            ),
            None,
        )
        if len(value) < min_length:
            value = value + ("x" * (min_length - len(value)))
        if max_length is not None:
            value = value[:max_length]
        return value

    @staticmethod
    def _singular(name: str) -> str:
        return name[:-1] if name.endswith("s") else name
