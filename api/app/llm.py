from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Iterable
from dataclasses import dataclass
from typing import Generic, Protocol, TypeVar

import openai
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app import config
from app.fakes import FakeLLM

BaseModelT = TypeVar("BaseModelT", bound=BaseModel)
ResultT = TypeVar("ResultT")


class LLM(Protocol):
    async def structured(
        self,
        *,
        prompt: str,
        schema: type[BaseModelT],
        model: str,
        system: str | None = None,
    ) -> BaseModelT: ...


class LLMError(RuntimeError):
    def __init__(self, message: str, *, cause: BaseException | None = None) -> None:
        super().__init__(message)
        self.cause = cause


class _MissingParsedOutputError(ValueError):
    pass


class OpenAILLM:
    def __init__(self, api_key: str | None = None) -> None:
        resolved_key = config.OPENAI_API_KEY if api_key is None else api_key
        if not resolved_key.strip():
            raise LLMError(
                "OpenAI LLM backend selected, but OPENAI_API_KEY is empty."
            )
        self._client = AsyncOpenAI(api_key=resolved_key, max_retries=0)

    async def structured(
        self,
        *,
        prompt: str,
        schema: type[BaseModelT],
        model: str,
        system: str | None = None,
    ) -> BaseModelT:
        # LLM_MAX_RETRIES is a count of *retries*, so N retries is N+1 attempts.
        attempts = max(1, config.LLM_MAX_RETRIES + 1)
        last_error: BaseException | None = None

        for attempt in range(attempts):
            try:
                async with asyncio.timeout(config.LLM_TIMEOUT_SEC):
                    # The installed SDK exposes responses.parse with Pydantic output.
                    response = await self._client.responses.parse(
                        model=model,
                        instructions=system,
                        input=prompt,
                        text_format=schema,
                        timeout=config.LLM_TIMEOUT_SEC,
                    )
                parsed = response.output_parsed
                if parsed is None:
                    raise _MissingParsedOutputError(
                        "OpenAI returned no parsed structured output."
                    )
                return schema.model_validate(parsed)
            except BaseException as error:
                if isinstance(error, asyncio.CancelledError):
                    raise
                if not self._is_retryable(error):
                    raise LLMError(
                        "OpenAI structured-output request failed.",
                        cause=error,
                    ) from error
                last_error = error
                if attempt + 1 < attempts:
                    delay = 0.5 * (2**attempt)
                    await asyncio.sleep(delay + random.uniform(0.0, delay * 0.25))

        error = LLMError(
            f"OpenAI structured-output request failed after {attempts} attempts.",
            cause=last_error,
        )
        raise error from last_error

    @staticmethod
    def _is_retryable(error: BaseException) -> bool:
        if isinstance(
            error,
            (
                ValidationError,
                _MissingParsedOutputError,
                TimeoutError,
                openai.APITimeoutError,
                openai.APIConnectionError,
                openai.RateLimitError,
                openai.LengthFinishReasonError,
            ),
        ):
            return True
        if isinstance(error, openai.APIStatusError):
            return error.status_code == 408 or error.status_code >= 500
        return False


@dataclass(frozen=True, slots=True)
class Result(Generic[ResultT]):
    ok: bool
    value: ResultT | None = None
    error: BaseException | None = None


def get_llm() -> LLM:
    if config.LLM_BACKEND == "fake":
        return FakeLLM()
    if config.LLM_BACKEND == "openai":
        return OpenAILLM()
    raise LLMError(
        f"Unsupported LLM_BACKEND {config.LLM_BACKEND!r}; expected 'fake' or 'openai'."
    )


async def gather_structured(
    calls: Iterable[Awaitable[ResultT]],
) -> list[Result[ResultT]]:
    outcomes = await asyncio.gather(*calls, return_exceptions=True)
    return [
        Result(ok=False, error=outcome)
        if isinstance(outcome, BaseException)
        else Result(ok=True, value=outcome)
        for outcome in outcomes
    ]
