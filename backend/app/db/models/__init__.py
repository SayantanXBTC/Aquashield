"""Import every model so Base.metadata is fully populated — required by
Alembic autogenerate and by anything calling Base.metadata.create_all()."""

from app.db.models.ai_request import AIRequest
from app.db.models.audit_event import AuditEvent
from app.db.models.geographic_dataset import GeographicDataset
from app.db.models.geographic_feature import GeographicFeature
from app.db.models.incident_action_plan import IncidentActionPlan
from app.db.models.infrastructure_asset import InfrastructureAsset
from app.db.models.rag_source import RagIngestionLog, RagSource
from app.db.models.response_recommendation import ResponseRecommendation
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.scenario import Scenario
from app.db.models.scenario_version import ScenarioVersion
from app.db.models.simulation_artifact import SimulationArtifact
from app.db.models.simulation_run import SimulationRun
from app.db.models.vulnerability_assessment import VulnerabilityAssessment

__all__ = [
    "AIRequest",
    "AuditEvent",
    "GeographicDataset",
    "GeographicFeature",
    "IncidentActionPlan",
    "InfrastructureAsset",
    "ResponseRecommendation",
    "RiskAssessment",
    "Scenario",
    "ScenarioVersion",
    "SimulationArtifact",
    "SimulationRun",
    "VulnerabilityAssessment",
]
