from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.enums import SimulationStatus
from app.db.models.scenario_version import ScenarioVersion
from app.db.models.simulation_run import SimulationRun


class SimulationRunRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, run: SimulationRun) -> SimulationRun:
        self.session.add(run)
        self.session.flush()
        return run

    def get(self, run_id: UUID) -> SimulationRun | None:
        return self.session.get(SimulationRun, run_id)

    def list_for_scenario(
        self, scenario_id: UUID, *, status: SimulationStatus | None = None
    ) -> list[SimulationRun]:
        stmt = (
            select(SimulationRun)
            .join(ScenarioVersion, SimulationRun.scenario_version_id == ScenarioVersion.id)
            .where(ScenarioVersion.scenario_id == scenario_id)
            .order_by(SimulationRun.created_at.desc())
        )
        if status is not None:
            stmt = stmt.where(SimulationRun.status == status)
        return list(self.session.execute(stmt).scalars().all())
