"""Simulation execution domain logic. Routes call this; this calls the
simulation/ engine (a standalone package — see docs/development/simulation.md)
and the repositories below. No engine/model logic belongs here, only
orchestration: load config, run the engine, persist status + artifact."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.db.geo import point_to_latlon
from app.db.models.enums import ArtifactType, SimulationStatus
from app.db.models.simulation_artifact import SimulationArtifact
from app.db.models.simulation_run import SimulationRun
from app.repositories.simulation_artifact_repository import SimulationArtifactRepository
from app.repositories.simulation_run_repository import SimulationRunRepository

from simulation.core.engine import SimulationEngine
from simulation.core.errors import SimulationConfigError, SimulationExecutionError


class SimulationServiceError(Exception):
    """Base class for domain errors the API layer maps to HTTP responses."""


class SimulationRunNotFoundError(SimulationServiceError):
    pass


class SimulationRunConflictError(SimulationServiceError):
    """The run is not in a state that can be executed (already running,
    completed, failed, or cancelled)."""


class SimulationConfigurationError(SimulationServiceError):
    """The scenario/timestep configuration was invalid — a client input
    problem (maps to SimulationConfigError from the engine)."""


class SimulationExecutionFailedError(SimulationServiceError):
    """The engine failed while executing — a model bug, not a client input
    problem (maps to SimulationExecutionError from the engine)."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SimulationService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.runs = SimulationRunRepository(session)
        self.artifacts = SimulationArtifactRepository(session)

    def get_run(self, run_id: UUID) -> SimulationRun:
        run = self.runs.get(run_id)
        if run is None:
            raise SimulationRunNotFoundError(f"SimulationRun {run_id} not found")
        return run

    def execute_run(self, run_id: UUID) -> SimulationRun:
        """Executes a pending run synchronously (Prompt 7 §26: no Celery/Redis
        job queue in this phase — documented as a synchronous prototype).
        PENDING -> RUNNING -> COMPLETED, or -> FAILED with error_message set
        and the original error re-raised, never swallowed."""
        run = self.get_run(run_id)
        if run.status != SimulationStatus.PENDING:
            raise SimulationRunConflictError(
                f"SimulationRun {run_id} is {run.status.value}; only a pending run can be executed. "
                "Create a new run (POST /scenarios/{scenario_id}/runs) to re-execute this scenario version."
            )

        version = run.scenario_version
        scenario = version.scenario
        latlon = point_to_latlon(scenario.location)
        location = {"latitude": latlon[0], "longitude": latlon[1]} if latlon else None

        run.status = SimulationStatus.RUNNING
        run.started_at = _now()
        self.session.commit()

        try:
            engine = SimulationEngine(
                simulation_run_id=run.id,
                disaster_type=scenario.disaster_type.value,
                scenario_config=version.scenario_config,
                timestep_config=run.timestep_config,
                location=location,
                seed=(run.timestep_config or {}).get("seed"),
            )
            frames = engine.run()
        except SimulationConfigError as exc:
            run.status = SimulationStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = _now()
            self.session.commit()
            raise SimulationConfigurationError(str(exc)) from exc
        except SimulationExecutionError as exc:
            run.status = SimulationStatus.FAILED
            run.error_message = str(exc)
            run.completed_at = _now()
            self.session.commit()
            raise SimulationExecutionFailedError(str(exc)) from exc

        run.completed_at = _now()
        run.duration_seconds = (run.completed_at - run.started_at).total_seconds()

        artifact = self._persist_artifact(run.id, engine, frames)
        self.artifacts.add(artifact)

        run.status = SimulationStatus.COMPLETED
        run.model_identifier = engine.model.model_identifier
        # Record the seed actually used (explicit or the engine's
        # deterministic default) so this run stays reproducible — Prompt 7 §9.
        run.timestep_config = {**(run.timestep_config or {}), "seed": engine.seed}
        self.session.commit()
        self.session.refresh(run)
        return run

    def get_timeline(self, run_id: UUID) -> list[dict[str, Any]]:
        self.get_run(run_id)  # 404 if missing
        artifact = self.artifacts.get_latest_for_run(run_id)
        if artifact is None:
            return []
        path = Path(artifact.storage_location)
        if not path.exists():
            raise SimulationExecutionFailedError(f"Artifact file missing at {path}")
        with path.open() as f:
            payload = json.load(f)
        return payload["frames"]

    def _persist_artifact(self, run_id: UUID, engine: SimulationEngine, frames: list) -> SimulationArtifact:
        out_dir = Path(settings.simulation_output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / f"{run_id}.json"
        payload = {
            "simulation_run_id": str(run_id),
            "model_identifier": engine.model.model_identifier,
            "frame_count": len(frames),
            "generated_at": _now().isoformat(),
            "frames": [f.to_dict() for f in frames],
        }
        with path.open("w") as f:
            json.dump(payload, f, indent=2)

        return SimulationArtifact(
            simulation_run_id=run_id,
            artifact_type=ArtifactType.JSON,
            storage_location=str(path),
            format="json",
            timestep_start=0,
            timestep_end=frames[-1].timestep if frames else 0,
            extra_metadata={
                "model_identifier": engine.model.model_identifier,
                "model_card": engine.model.describe(),
                "frame_count": len(frames),
                "seed": engine.seed,
                "note": (
                    "Prototype JSON artifact — Prompt 7 §21/§22 explicitly defer "
                    "NetCDF/Zarr/object storage to a future phase."
                ),
            },
        )
