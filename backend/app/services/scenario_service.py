"""Scenario domain/business logic. Routes call this; this calls repositories.
No SQLAlchemy query construction here beyond what the repositories return —
and no HTTP-shape concerns (status codes, response schemas) here either."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.db.geo import latlon_to_point
from app.db.models.enums import DisasterType, ScenarioStatus, SimulationStatus
from app.db.models.scenario import Scenario
from app.db.models.scenario_version import ScenarioVersion
from app.db.models.simulation_run import SimulationRun
from app.repositories.scenario_repository import ScenarioRepository
from app.repositories.simulation_artifact_repository import SimulationArtifactRepository
from app.repositories.simulation_run_repository import SimulationRunRepository
from app.schemas.scenario import (
    ScenarioCreateRequest,
    ScenarioUpdateRequest,
    ScenarioVersionCreateRequest,
    SimulationRunCreateRequest,
)
from app.schemas.scenario_config import is_config_populated, validate_scenario_config
from app.services.run_selection import RunSelectionCandidate, select_default_run_id


class ScenarioServiceError(Exception):
    """Base class for domain errors the API layer maps to HTTP responses."""


class ScenarioNotFoundError(ScenarioServiceError):
    pass


class ScenarioValidationError(ScenarioServiceError):
    pass


class ScenarioService:
    """Every method is scoped to `owner_uid` — the verified Firebase uid
    (app/core/auth.py). A scenario belonging to another user is treated
    exactly like a missing one (ScenarioNotFoundError), never as a 403."""

    def __init__(self, session: Session, *, owner_uid: str) -> None:
        self.session = session
        self.owner_uid = owner_uid
        self.scenarios = ScenarioRepository(session)
        self.runs = SimulationRunRepository(session)
        # Only needed here for get_run_frame_count/get_default_run below —
        # actual artifact persistence stays SimulationService's job
        # (app/services/simulation_service.py).
        self.artifacts = SimulationArtifactRepository(session)

    # --- Scenarios ---

    def create_scenario(self, data: ScenarioCreateRequest) -> Scenario:
        # data.scenario_config was already validated/normalized by the request schema.
        ready = is_config_populated(data.disaster_type, data.scenario_config)
        scenario = Scenario(
            name=data.name,
            description=data.description,
            disaster_type=data.disaster_type,
            location_name=data.location_name,
            location=latlon_to_point(data.latitude, data.longitude),
            status=ScenarioStatus.READY if ready else ScenarioStatus.DRAFT,
            created_by=data.created_by or self.owner_uid,
            owner_uid=self.owner_uid,
        )
        self.scenarios.add(scenario)

        version = ScenarioVersion(
            scenario_id=scenario.id,
            version_number=1,
            label=data.version_label or "Initial version",
            scenario_config=data.scenario_config,
        )
        self.scenarios.add_version(version)
        self.session.commit()
        self.session.refresh(scenario)
        return scenario

    def get_scenario(self, scenario_id: UUID) -> Scenario:
        scenario = self.scenarios.get(scenario_id, owner_uid=self.owner_uid)
        if scenario is None:
            raise ScenarioNotFoundError(f"Scenario {scenario_id} not found")
        return scenario

    def list_scenarios(
        self,
        *,
        disaster_type: DisasterType | None = None,
        status: ScenarioStatus | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Scenario], int]:
        try:
            return self.scenarios.list(
                owner_uid=self.owner_uid,
                disaster_type=disaster_type,
                status=status,
                search=search,
                sort_by=sort_by,
                sort_dir=sort_dir,
                limit=limit,
                offset=offset,
            )
        except ValueError as exc:
            raise ScenarioValidationError(str(exc)) from exc

    def update_scenario(self, scenario_id: UUID, data: ScenarioUpdateRequest) -> Scenario:
        """Metadata fields (name/description/location/status) update the
        Scenario row in place. `scenario_config` is versioned — a change
        there creates a new immutable ScenarioVersion instead. See
        docs/development/scenarios.md."""
        scenario = self.get_scenario(scenario_id)

        if data.name is not None:
            scenario.name = data.name
        if data.description is not None:
            scenario.description = data.description
        if data.location_name is not None:
            scenario.location_name = data.location_name
        if data.latitude is not None and data.longitude is not None:
            scenario.location = latlon_to_point(data.latitude, data.longitude)
        if data.status is not None:
            scenario.status = data.status

        if data.scenario_config is not None:
            validated = validate_scenario_config(scenario.disaster_type, data.scenario_config)
            version = ScenarioVersion(
                scenario_id=scenario.id,
                version_number=self.scenarios.next_version_number(scenario.id),
                label=data.version_label,
                notes=data.version_notes,
                scenario_config=validated,
            )
            self.scenarios.add_version(version)

        self.session.commit()
        self.session.refresh(scenario)
        return scenario

    def create_version(self, scenario_id: UUID, data: ScenarioVersionCreateRequest) -> ScenarioVersion:
        scenario = self.get_scenario(scenario_id)
        validated = validate_scenario_config(scenario.disaster_type, data.scenario_config)
        version = ScenarioVersion(
            scenario_id=scenario.id,
            version_number=self.scenarios.next_version_number(scenario.id),
            label=data.label,
            notes=data.notes,
            scenario_config=validated,
        )
        self.scenarios.add_version(version)
        self.session.commit()
        self.session.refresh(version)
        return version

    def list_versions(self, scenario_id: UUID) -> list[ScenarioVersion]:
        self.get_scenario(scenario_id)  # 404 if missing
        return self.scenarios.list_versions(scenario_id)

    def duplicate_scenario(self, scenario_id: UUID) -> Scenario:
        """Creates a brand-new Scenario with its own identity and a fresh
        version 1 copying the current configuration. Simulation run history
        is intentionally NOT copied — it belongs to the original run of the
        original scenario, not a hypothetical duplicate."""
        original = self.get_scenario(scenario_id)
        current_version = self.scenarios.get_current_version(scenario_id)

        duplicate = Scenario(
            name=f"{original.name} (Copy)",
            description=original.description,
            disaster_type=original.disaster_type,
            location_name=original.location_name,
            location=original.location,
            status=ScenarioStatus.DRAFT,
            created_by=original.created_by,
            owner_uid=self.owner_uid,
        )
        self.scenarios.add(duplicate)

        version = ScenarioVersion(
            scenario_id=duplicate.id,
            version_number=1,
            label="Duplicated from " + original.name,
            scenario_config=current_version.scenario_config if current_version else {},
        )
        self.scenarios.add_version(version)
        self.session.commit()
        self.session.refresh(duplicate)
        return duplicate

    def archive_scenario(self, scenario_id: UUID) -> Scenario:
        """DELETE /scenarios/{id} archives rather than hard-deletes: Scenario
        -> ScenarioVersion -> SimulationRun cascades on delete, which would
        destroy simulation history. Archiving preserves it while removing the
        scenario from active use. See docs/development/scenarios.md."""
        scenario = self.get_scenario(scenario_id)
        scenario.status = ScenarioStatus.ARCHIVED
        self.session.commit()
        self.session.refresh(scenario)
        return scenario

    # --- Simulation runs ---

    def create_simulation_run(self, scenario_id: UUID, data: SimulationRunCreateRequest) -> SimulationRun:
        self.get_scenario(scenario_id)  # 404 if missing

        if data.scenario_version_id is not None:
            version = self.scenarios.get_version(scenario_id, data.scenario_version_id)
            if version is None:
                raise ScenarioValidationError(
                    f"Version {data.scenario_version_id} does not belong to scenario {scenario_id}"
                )
        else:
            version = self.scenarios.get_current_version(scenario_id)
            if version is None:
                raise ScenarioValidationError("Scenario has no versions to run")

        run = SimulationRun(
            scenario_version_id=version.id,
            status=SimulationStatus.PENDING,
            model_identifier=data.model_identifier,
            timestep_config=data.timestep_config,
        )
        self.runs.add(run)
        self.session.commit()
        self.session.refresh(run)
        return run

    def list_simulation_runs(
        self, scenario_id: UUID, *, status: SimulationStatus | None = None
    ) -> list[SimulationRun]:
        self.get_scenario(scenario_id)  # 404 if missing
        return self.runs.list_for_scenario(scenario_id, status=status)

    def get_run_frame_count(self, run_id: UUID) -> int | None:
        """None means "no artifact yet" (pending/running/failed run) — never
        confused with 0, which means "an artifact exists but produced no
        frames" (see docs/geospatial/impact-visualization.md — a COMPLETED
        run is not assumed to have usable frames)."""
        artifact = self.artifacts.get_latest_for_run(run_id)
        if artifact is None:
            return None
        return artifact.extra_metadata.get("frame_count")

    def get_default_run(self, scenario_id: UUID) -> SimulationRun | None:
        """Prompt 10.1: picks the "best default" run for the Command Center
        to auto-select, per the priority documented in
        app/services/run_selection.py — never blindly "the newest run"
        (Prompt 8's original `runList[0]` bug, which could select a PENDING
        run created after a perfectly good COMPLETED one). Returns None if
        the scenario has no run that qualifies (e.g. only FAILED/CANCELLED
        runs exist) — the frontend leaves nothing auto-selected in that case
        and the user picks explicitly via the run selector."""
        self.get_scenario(scenario_id)  # 404 if missing
        runs = self.runs.list_for_scenario(scenario_id)
        if not runs:
            return None
        candidates = [
            RunSelectionCandidate(
                id=run.id,
                status=run.status,
                created_at=run.created_at,
                frame_count=self.get_run_frame_count(run.id),
            )
            for run in runs
        ]
        best_id = select_default_run_id(candidates)
        if best_id is None:
            return None
        return next(run for run in runs if run.id == best_id)
