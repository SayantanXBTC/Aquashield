from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.simulation_artifact import SimulationArtifact


class SimulationArtifactRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, artifact: SimulationArtifact) -> SimulationArtifact:
        self.session.add(artifact)
        self.session.flush()
        return artifact

    def get_latest_for_run(self, run_id: UUID) -> SimulationArtifact | None:
        stmt = (
            select(SimulationArtifact)
            .where(SimulationArtifact.simulation_run_id == run_id)
            .order_by(SimulationArtifact.created_at.desc())
            .limit(1)
        )
        return self.session.execute(stmt).scalars().first()
