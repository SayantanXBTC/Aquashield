from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.enums import RiskCategory
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.vulnerability_assessment import VulnerabilityAssessment


class ImpactRepository:
    """Persistence + cache lookup for the impact-analysis domain. Reuses the
    existing RiskAssessment/VulnerabilityAssessment tables (see
    ImpactService's module docstring for why a new table wasn't added)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def find_cached_risk_assessment(
        self, simulation_run_id: UUID, frame_index: int, analysis_version: str
    ) -> RiskAssessment | None:
        stmt = select(RiskAssessment).where(
            RiskAssessment.simulation_run_id == simulation_run_id,
            RiskAssessment.timestep == frame_index,
            RiskAssessment.category == RiskCategory.INFRASTRUCTURE,
            RiskAssessment.extra_metadata["analysis_version"].astext == analysis_version,
        )
        return self.session.execute(stmt).scalars().first()

    def find_vulnerability_assessments(
        self, simulation_run_id: UUID, frame_index: int, analysis_version: str
    ) -> list[VulnerabilityAssessment]:
        stmt = select(VulnerabilityAssessment).where(
            VulnerabilityAssessment.simulation_run_id == simulation_run_id,
            VulnerabilityAssessment.timestep == frame_index,
            VulnerabilityAssessment.extra_metadata["analysis_version"].astext == analysis_version,
        )
        return list(self.session.execute(stmt).scalars().all())

    def add_risk_assessment(self, risk_assessment: RiskAssessment) -> RiskAssessment:
        self.session.add(risk_assessment)
        self.session.flush()
        return risk_assessment

    def add_vulnerability_assessments(
        self, assessments: list[VulnerabilityAssessment]
    ) -> list[VulnerabilityAssessment]:
        self.session.add_all(assessments)
        self.session.flush()
        return assessments
