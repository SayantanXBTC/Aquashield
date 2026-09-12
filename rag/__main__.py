"""RAG CLI — `python -m rag <command>`.

    python -m rag ingest --source <path-or-source-id> [--fixtures] [--force]
    python -m rag ingest --root <dir> [--fixtures] [--force]
    python -m rag validate [--root <dir>]
    python -m rag list-sources [--root <dir>]

Requested as `python -m rag.ingest` / `python -m rag.validate` /
`python -m rag.list-sources` — `-m` requires a valid module path, and
`list-sources` is not a valid Python identifier (the hyphen), so this ships
as one `rag/__main__.py` with argparse subcommands instead. Documented here
rather than silently done differently.

Bridges two isolated domains on purpose: `rag/` is framework-free, and the
idempotent source registry lives in Postgres, which only the backend touches
(architecture.md ADR-003). This script is the bridge, exactly like
`backend/app/main.py` bridges the other direction to import `simulation.*`.
It is the ONLY file in `rag/` that reaches into `backend.app`.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
for p in (REPO_ROOT, BACKEND_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

DEFAULT_SOURCES_ROOT = REPO_ROOT / "rag" / "sources"
FIXTURES_ROOT = REPO_ROOT / "rag" / "tests" / "fixtures"


def _session():
    from app.db.session import SessionLocal

    return SessionLocal()


def _service(session):
    from app.services.rag_ingestion_service import RagIngestionService

    return RagIngestionService(session)


def cmd_ingest(args: argparse.Namespace) -> int:
    root = FIXTURES_ROOT if args.fixtures else Path(args.root) if args.root else DEFAULT_SOURCES_ROOT
    session = _session()
    try:
        service = _service(session)
        if args.source:
            path = Path(args.source)
            if not path.exists():
                # Treat it as a source_id: find the file whose frontmatter/
                # sidecar declares that source_id under `root`.
                from rag.ingestion.pipeline import IngestionError, build_source_metadata
                from rag.metadata.discovery import discover_source_files

                match = None
                for candidate in discover_source_files(root):
                    try:
                        meta, _ = build_source_metadata(candidate, repo_root=REPO_ROOT, is_test_fixture=args.fixtures)
                    except IngestionError:
                        continue
                    if meta.source_id == args.source:
                        match = candidate
                        break
                if match is None:
                    print(f"No source file under {root} declares source_id {args.source!r}.", file=sys.stderr)
                    return 1
                path = match
            log = service.ingest_path(path, is_test_fixture=args.fixtures, force=args.force)
        else:
            logs = service.ingest_root(root, is_test_fixture=args.fixtures, force=args.force)
            session.commit()
            for log in logs:
                print(f"{log.outcome:8s} {log.source_id:40s} chunks={log.chunk_count} {log.error or ''}")
            failures = sum(1 for log in logs if log.outcome == "failed")
            print(f"\n{len(logs)} file(s): {sum(1 for l in logs if l.outcome == 'ingested')} ingested, "
                  f"{sum(1 for l in logs if l.outcome == 'skipped')} skipped, {failures} failed.")
            return 1 if failures else 0
        session.commit()
        print(f"{log.outcome:8s} {log.source_id:40s} chunks={log.chunk_count} {log.error or ''}")
        return 1 if log.outcome == "failed" else 0
    finally:
        session.close()


def cmd_validate(args: argparse.Namespace) -> int:
    root = FIXTURES_ROOT if args.fixtures else Path(args.root) if args.root else DEFAULT_SOURCES_ROOT
    session = _session()
    try:
        service = _service(session)
        results = service.validate_root(root)
        if not results:
            print(f"No source files found under {root}.")
            return 0
        failures = 0
        for path, error in results:
            if error:
                failures += 1
                print(f"INVALID  {path}: {error}")
            else:
                print(f"OK       {path}")
        print(f"\n{len(results)} file(s) checked, {failures} invalid.")
        return 1 if failures else 0
    finally:
        session.close()


def cmd_list_sources(args: argparse.Namespace) -> int:
    session = _session()
    try:
        from app.repositories.rag_source_repository import RagSourceRepository

        repo = RagSourceRepository(session)
        sources = repo.list_all(disaster_type=args.disaster_type)
        if not sources:
            print("No sources ingested yet.")
            return 0
        for s in sources:
            fixture = " [TEST_FIXTURE]" if s.is_test_fixture else ""
            print(f"{s.source_id:40s} {s.trust_level.value:8s} {','.join(s.disaster_types):30s} chunks={s.chunk_count}{fixture}")
        return 0
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m rag", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="Parse, chunk, embed and register one source or every source under a root.")
    p_ingest.add_argument("--source", default=None, help="A file path or a source_id to ingest (default: every file under --root).")
    p_ingest.add_argument("--root", default=None, help=f"Directory to scan (default: {DEFAULT_SOURCES_ROOT}).")
    p_ingest.add_argument("--fixtures", action="store_true", help=f"Use {FIXTURES_ROOT} and mark rows is_test_fixture=True.")
    p_ingest.add_argument("--force", action="store_true", help="Re-ingest even if the checksum is unchanged.")
    p_ingest.set_defaults(func=cmd_ingest)

    p_validate = sub.add_parser("validate", help="Check every source's metadata without touching the vector store.")
    p_validate.add_argument("--root", default=None)
    p_validate.add_argument("--fixtures", action="store_true")
    p_validate.set_defaults(func=cmd_validate)

    p_list = sub.add_parser("list-sources", help="List every source in the Postgres registry.")
    p_list.add_argument("--disaster-type", dest="disaster_type", default=None)
    p_list.set_defaults(func=cmd_list_sources)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
