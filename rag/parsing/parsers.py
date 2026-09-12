"""Document parsing: PDF / Markdown / plain text -> (SourceMetadata fields, raw text, optional page breaks).

Markdown carries its own metadata as a YAML-lite frontmatter block (a
`---`-delimited `key: value` header — no nested structures, no external YAML
dependency). Plain text and PDF sources are metadata-free by nature, so they
require a sibling `<file>.meta.json` with the same fields.

Page boundaries (PDF) are preserved as `\\f` (form feed) markers in the
returned text, so the chunker can attribute a chunk to a page number without
re-parsing the source.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

FRONTMATTER_DELIMITER = "---"
PAGE_BREAK = "\f"


class ParseError(Exception):
    pass


@dataclass(frozen=True)
class ParsedDocument:
    metadata: dict[str, Any]
    text: str
    """Raw text, `\\f`-separated by page for a PDF; one implicit page for
    Markdown/text sources."""


def _parse_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    lines = raw.splitlines()
    if not lines or lines[0].strip() != FRONTMATTER_DELIMITER:
        return {}, raw
    meta: dict[str, Any] = {}
    i = 1
    while i < len(lines) and lines[i].strip() != FRONTMATTER_DELIMITER:
        line = lines[i]
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                items = [v.strip().strip("'\"") for v in value[1:-1].split(",") if v.strip()]
                meta[key] = items
            else:
                meta[key] = value.strip("'\"")
        i += 1
    body = "\n".join(lines[i + 1 :]) if i < len(lines) else raw
    return meta, body.lstrip("\n")


def parse_markdown(path: Path) -> ParsedDocument:
    raw = path.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(raw)
    if not meta:
        raise ParseError(f"{path}: markdown source has no frontmatter metadata block (--- ... ---).")
    return ParsedDocument(metadata=meta, text=body)


def _sidecar_metadata(path: Path) -> dict[str, Any]:
    sidecar = path.with_suffix(path.suffix + ".meta.json")
    if not sidecar.exists():
        raise ParseError(f"{path}: no frontmatter and no sidecar metadata file ({sidecar.name}).")
    try:
        return json.loads(sidecar.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ParseError(f"{sidecar}: invalid JSON ({exc}).") from exc


def parse_text(path: Path) -> ParsedDocument:
    return ParsedDocument(metadata=_sidecar_metadata(path), text=path.read_text(encoding="utf-8"))


def parse_pdf(path: Path) -> ParsedDocument:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover — dependency guard
        raise ParseError("The 'pypdf' package is required to parse PDF sources; see requirements.txt.") from exc
    reader = PdfReader(str(path))
    pages = [page.extract_text() or "" for page in reader.pages]
    if not any(p.strip() for p in pages):
        raise ParseError(f"{path}: no extractable text (scanned/image-only PDFs are not supported — OCR is out of scope).")
    return ParsedDocument(metadata=_sidecar_metadata(path), text=PAGE_BREAK.join(pages))


_PARSERS = {".md": parse_markdown, ".markdown": parse_markdown, ".txt": parse_text, ".pdf": parse_pdf}


def parse_document(path: Path) -> ParsedDocument:
    parser = _PARSERS.get(path.suffix.lower())
    if parser is None:
        raise ParseError(f"{path}: unsupported source type {path.suffix!r} (expected .md, .txt or .pdf).")
    return parser(path)
