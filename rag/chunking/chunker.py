"""Semantic chunking: splits parsed text into 500-1000 token slices, carrying
section and page context so every chunk stays citable.

Splitting is paragraph-aware — it never cuts a sentence mid-way for the sake
of hitting the target size, and it flushes early at a heading or a page
break rather than let a chunk span them, so a citation's `section`/`page`
always describes the whole chunk, not just its start.

"Token" here means whitespace-split words, not a model's real tokenizer —
the 500-1000 target is a reasonable proxy without pulling in a tokenizer
dependency, and it is consistent for every provider this pipeline supports.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from rag.parsing.parsers import PAGE_BREAK

MIN_TOKENS = 500
TARGET_TOKENS = 800
MAX_TOKENS = 1000

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass(frozen=True)
class ChunkDraft:
    text: str
    section: str | None
    page: int | None
    token_count: int


def _token_count(text: str) -> int:
    return len(text.split())


def _paragraphs_with_context(text: str) -> list[tuple[str, str | None, int]]:
    """Splits on blank lines, tracking the current heading and page number
    (1-indexed) as it goes. A page break can fall inside a blank-line-
    delimited block (when the source had no blank line around it), so the
    page counter advances per `\f` crossed within a block, not only between
    blocks."""

    out: list[tuple[str, str | None, int]] = []
    section: str | None = None
    page = 1
    for raw_block in text.split("\n\n"):
        pieces = raw_block.split(PAGE_BREAK)
        for i, piece in enumerate(pieces):
            block = piece.strip()
            if block:
                heading = _HEADING_RE.match(block.splitlines()[0])
                if heading:
                    section = heading.group(2).strip()
                out.append((block, section, page))
            if i < len(pieces) - 1:
                page += 1
    return out


def chunk_document(text: str) -> list[ChunkDraft]:
    """Greedily accumulates paragraphs up to TARGET_TOKENS, flushing early on
    a section or page change so a chunk never silently spans two of either."""

    paragraphs = _paragraphs_with_context(text)
    chunks: list[ChunkDraft] = []
    buffer: list[str] = []
    buffer_section: str | None = None
    buffer_page: int | None = None
    buffer_tokens = 0

    def flush() -> None:
        nonlocal buffer, buffer_tokens
        if buffer:
            chunks.append(ChunkDraft(text="\n\n".join(buffer), section=buffer_section, page=buffer_page, token_count=buffer_tokens))
        buffer = []
        buffer_tokens = 0

    for text_block, section, page in paragraphs:
        tokens = _token_count(text_block)
        # A section or page change always flushes, even under MIN_TOKENS —
        # citation accuracy (which section/page a chunk is actually from)
        # matters more than hitting the target size on every chunk. Only the
        # pure length-based split below respects MIN_TOKENS, so one long
        # uniform section isn't fragmented into slivers.
        if buffer and (section != buffer_section or page != buffer_page):
            flush()
        if buffer_tokens + tokens > MAX_TOKENS and buffer_tokens >= MIN_TOKENS:
            flush()
        if not buffer:
            buffer_section, buffer_page = section, page
        buffer.append(text_block)
        buffer_tokens += tokens
        if buffer_tokens >= TARGET_TOKENS:
            flush()
    flush()

    # A trailing chunk under MIN_TOKENS is still real content (the tail of a
    # short section or document) — kept rather than dropped, and never
    # merged backwards into a chunk whose section/page it doesn't share.
    return chunks
