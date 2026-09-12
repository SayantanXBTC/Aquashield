"""Embedding provider abstraction — mirrors agents/llm/provider.py's shape
(name + a pure `.embed()` method + a `build_embedding_provider` factory), so
the two "which model actually runs" decisions in this codebase read the same
way.

`DeterministicHashEmbedding` is the default and what every test runs
against: no network, no model download, no API key. It is a real (if crude)
bag-of-hashed-words vector — cosine similarity between it and a query
genuinely tracks vocabulary overlap, which is what makes threshold rejection
and role-scoped ranking testable offline. It is not a semantic embedding
model; ranking quality against real authoritative text will improve once a
hosted embedding API is wired in (see AnthropicEmbeddingProvider's absence,
below — Anthropic has no embeddings endpoint, so a real deployment needs a
separate embeddings provider, deliberately left as a documented gap rather
than an invented integration).
"""

from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class EmbeddingProviderError(RuntimeError):
    pass


class EmbeddingProvider(ABC):
    name: str
    dim: int

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class DeterministicHashEmbedding(EmbeddingProvider):
    """No network, no credits — the default and what CI runs against.

    Each token is hashed into one of `dim` buckets (stable across process,
    platform and Python version — sha256, not Python's salted `hash()`) and
    accumulated; the result is L2-normalised so cosine similarity is
    well-behaved. Two texts that share vocabulary score higher than two that
    don't, which is the property retrieval ranking and threshold rejection
    both depend on."""

    name = "local"

    def __init__(self, dim: int = 256) -> None:
        self.dim = dim

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * self.dim
        for token in _tokenize(text):
            index = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % self.dim
            vector[index] += 1.0
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [v / norm for v in vector]
        return vector

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]


def build_embedding_provider(name: str, **kwargs: object) -> EmbeddingProvider:
    if name == "local":
        return DeterministicHashEmbedding(**kwargs)  # type: ignore[arg-type]
    raise EmbeddingProviderError(
        f"Unknown embedding provider {name!r} (expected 'local'; a hosted embeddings API is not wired in yet)."
    )
