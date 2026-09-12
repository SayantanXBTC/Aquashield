"""LLM provider abstraction.

`LLMProvider.generate` takes a task id, a system prompt, a JSON-able payload
and a Pydantic output model, and returns a validated instance. Two
implementations:

- `LocalDeterministicProvider` — no network, no credits. Runs the same
  graph, same schemas, same validation; the "model" is a set of transparent
  rules over the payload (agents/llm/local_rules.py). This is the default
  and what tests use.
- `AnthropicProvider` — the Claude API through the official SDK with
  structured outputs (`messages.parse`). Selected with AI_PROVIDER=anthropic.

Neither implementation ever sees an API key in the audit trail; the
provider name and model id are the only things recorded.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProviderError(RuntimeError):
    pass


class LLMProvider(ABC):
    name: str
    model: str

    @abstractmethod
    def generate(self, *, task: str, system: str, payload: dict[str, Any], output_model: type[T]) -> T: ...


class LocalDeterministicProvider(LLMProvider):
    name = "local"
    model = "deterministic-rules-v1"

    def generate(self, *, task: str, system: str, payload: dict[str, Any], output_model: type[T]) -> T:
        from agents.llm import local_rules

        generator = local_rules.GENERATORS.get(task)
        if generator is None:
            raise LLMProviderError(f"No local generator for task {task!r}")
        result = generator(payload)
        return output_model.model_validate(result if isinstance(result, dict) else result.model_dump())


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, *, model: str = "claude-opus-5", api_key: str | None = None, max_tokens: int = 8000, timeout_s: float = 120.0) -> None:
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise LLMProviderError("The 'anthropic' package is not installed; set AI_PROVIDER=local or install it.") from exc
        self.model = model
        self.max_tokens = max_tokens
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout_s) if api_key else anthropic.Anthropic(timeout=timeout_s)

    def generate(self, *, task: str, system: str, payload: dict[str, Any], output_model: type[T]) -> T:
        import anthropic

        user_text = (
            f"TASK: {task}\n\nPAYLOAD (JSON, evidence ids are authoritative):\n"
            + json.dumps(payload, sort_keys=True, default=str)
        )
        try:
            response = self._client.messages.parse(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": "user", "content": user_text}],
                output_format=output_model,
            )
        except anthropic.RateLimitError as exc:
            raise LLMProviderError(f"rate limited: {exc.message}") from exc
        except anthropic.APIStatusError as exc:
            raise LLMProviderError(f"api error {exc.status_code}: {exc.message}") from exc
        except anthropic.APIConnectionError as exc:
            raise LLMProviderError(f"connection error: {exc}") from exc
        if response.stop_reason == "refusal":
            raise LLMProviderError("model refused the request")
        parsed = response.parsed_output
        if parsed is None:
            raise LLMProviderError("model returned no parsable structured output")
        return parsed


def build_provider(name: str, *, model: str | None = None, api_key: str | None = None) -> LLMProvider:
    if name == "local":
        return LocalDeterministicProvider()
    if name == "anthropic":
        return AnthropicProvider(model=model or "claude-opus-5", api_key=api_key)
    raise LLMProviderError(f"Unknown AI provider {name!r} (expected 'local' or 'anthropic')")
