"""Finds ingestable source files under a root directory without ingesting
them — used by `rag list-sources` and by `rag validate`.

A source is one `.md`/`.txt`/`.pdf` file; `.meta.json` sidecars and the
markdown frontmatter block they pair with are not sources themselves."""

from __future__ import annotations

from pathlib import Path

SOURCE_SUFFIXES = (".md", ".markdown", ".txt", ".pdf")


def discover_source_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(
        p
        for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES and p.name.lower() != "readme.md"
    )
