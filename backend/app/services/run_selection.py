"""Pure "best default run" selection logic for Prompt 10.1.

Extracted as a standalone, dependency-free module (no SQLAlchemy Session, no
repository access) specifically so the priority rule itself is unit-testable
without a database — see backend/tests/services/test_run_selection.py.
`ScenarioService.get_default_run` (app/services/scenario_service.py) is the
only caller: it loads the real candidates (status + created_at + frame_count,
the last sourced from SimulationArtifact.extra_metadata via
SimulationArtifactRepository) and hands them to `select_default_run_id` here.

Priority (see docs/geospatial/impact-visualization.md for the full rationale):
  (a) the most recent COMPLETED run that actually has usable timeline data
      (frame_count > 0) — a `status == COMPLETED` run with zero persisted
      frames is NOT usable and falls through to the next tier.
  (b) the most recent RUNNING run, if no usable completed run exists.
  (c) the most recent PENDING run, if nothing else is usable.
  (d) never a FAILED or CANCELLED run — those are only ever selected by an
      explicit user action in the run selector UI, never auto-selected.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.db.models.enums import SimulationStatus


@dataclass(frozen=True)
class RunSelectionCandidate:
    """The minimal per-run facts the priority rule needs. Deliberately not a
    SimulationRun ORM object — keeps this module importable/testable with no
    database at all."""

    id: UUID
    status: SimulationStatus
    created_at: datetime
    frame_count: int | None = None


def select_default_run_id(candidates: list[RunSelectionCandidate]) -> UUID | None:
    """Returns the id of the "best default" run per the priority above, or
    None if nothing in `candidates` qualifies (e.g. the scenario has no runs
    yet, or every run is FAILED/CANCELLED). Candidates may be passed in any
    order — this function sorts by `created_at` descending itself."""
    ordered = sorted(candidates, key=lambda c: c.created_at, reverse=True)

    for candidate in ordered:
        if candidate.status == SimulationStatus.COMPLETED and (candidate.frame_count or 0) > 0:
            return candidate.id

    for candidate in ordered:
        if candidate.status == SimulationStatus.RUNNING:
            return candidate.id

    for candidate in ordered:
        if candidate.status == SimulationStatus.PENDING:
            return candidate.id

    return None
