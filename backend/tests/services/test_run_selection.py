"""Pure unit tests for the Prompt 10.1 "best default run" priority rule —
no database, no FastAPI: exactly the point of extracting
app/services/run_selection.py as its own dependency-free module."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.models.enums import SimulationStatus
from app.services.run_selection import RunSelectionCandidate, select_default_run_id

_BASE_TIME = datetime(2026, 9, 12, 0, 0, 0, tzinfo=timezone.utc)


def _candidate(offset_minutes: int, status: SimulationStatus, frame_count: int | None = None) -> RunSelectionCandidate:
    return RunSelectionCandidate(
        id=uuid4(),
        status=status,
        created_at=_BASE_TIME + timedelta(minutes=offset_minutes),
        frame_count=frame_count,
    )


def test_no_candidates_returns_none() -> None:
    assert select_default_run_id([]) is None


def test_prefers_the_only_usable_completed_run() -> None:
    completed = _candidate(0, SimulationStatus.COMPLETED, frame_count=25)
    assert select_default_run_id([completed]) == completed.id


def test_reproduces_the_live_geo_test_flood_scenario() -> None:
    """Exact shape of the diagnostic's live test case: a scenario with a
    newest PENDING run and two older COMPLETED runs, both with real frames —
    the newest usable COMPLETED run must win, not the newest run overall."""
    pending_newest = _candidate(20, SimulationStatus.PENDING)
    completed_newer = _candidate(10, SimulationStatus.COMPLETED, frame_count=25)
    completed_older = _candidate(0, SimulationStatus.COMPLETED, frame_count=25)

    result = select_default_run_id([pending_newest, completed_newer, completed_older])

    assert result == completed_newer.id


def test_a_completed_run_with_zero_frames_is_not_usable() -> None:
    """A COMPLETED status alone is never assumed to mean usable frames exist
    — this is the exact case the diagnostic explicitly warns about."""
    completed_empty = _candidate(10, SimulationStatus.COMPLETED, frame_count=0)
    completed_usable = _candidate(0, SimulationStatus.COMPLETED, frame_count=3)

    assert select_default_run_id([completed_empty, completed_usable]) == completed_usable.id


def test_a_completed_run_with_none_frame_count_is_not_usable() -> None:
    """frame_count=None (no artifact at all — shouldn't normally happen for
    a COMPLETED run, but defensively treated the same as 0, never as
    "usable")."""
    completed_no_artifact = _candidate(10, SimulationStatus.COMPLETED, frame_count=None)
    pending = _candidate(0, SimulationStatus.PENDING)

    assert select_default_run_id([completed_no_artifact, pending]) == pending.id


def test_falls_back_to_running_when_no_usable_completed_run_exists() -> None:
    running = _candidate(5, SimulationStatus.RUNNING)
    pending = _candidate(0, SimulationStatus.PENDING)
    failed = _candidate(10, SimulationStatus.FAILED)

    assert select_default_run_id([running, pending, failed]) == running.id


def test_falls_back_to_pending_when_nothing_else_usable() -> None:
    pending_older = _candidate(0, SimulationStatus.PENDING)
    pending_newer = _candidate(5, SimulationStatus.PENDING)
    failed = _candidate(10, SimulationStatus.FAILED)

    assert select_default_run_id([pending_older, pending_newer, failed]) == pending_newer.id


def test_never_auto_selects_a_failed_or_cancelled_run() -> None:
    failed = _candidate(10, SimulationStatus.FAILED)
    cancelled = _candidate(5, SimulationStatus.CANCELLED)

    assert select_default_run_id([failed, cancelled]) is None


def test_candidate_order_does_not_matter() -> None:
    completed_newer = _candidate(10, SimulationStatus.COMPLETED, frame_count=1)
    completed_older = _candidate(0, SimulationStatus.COMPLETED, frame_count=1)

    forward = select_default_run_id([completed_older, completed_newer])
    reversed_order = select_default_run_id([completed_newer, completed_older])

    assert forward == reversed_order == completed_newer.id
