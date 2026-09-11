"""Python (Pydantic v2) mirror of the JSON Schema contracts in shared/contracts/.

The JSON Schema files are the canonical, cross-language source of truth for
shape and validation rules. These models are a synchronized, hand-maintained
representation for Python consumers (backend, agents, rag) — see
docs/development/database.md for the cross-language contract strategy and
why this project isn't generating them automatically yet.

No business logic belongs here — validation/shape only.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DisasterType(str, Enum):
    FLOOD = "flood"
    FLASH_FLOOD = "flash_flood"
    COASTAL_FLOOD = "coastal_flood"
    STORM_SURGE = "storm_surge"
    CYCLONE = "cyclone"
    TSUNAMI = "tsunami"
    OIL_SPILL = "oil_spill"
    CHEMICAL_POLLUTION = "chemical_pollution"
    SEARCH_RESCUE = "search_rescue"


class ScenarioStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class RiskCategory(str, Enum):
    OVERALL = "overall"
    POPULATION = "population"
    INFRASTRUCTURE = "infrastructure"
    ENVIRONMENTAL = "environmental"
    ECONOMIC = "economic"
    EVACUATION = "evacuation"
    ACCESSIBILITY = "accessibility"


class RecommendationPriority(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class RecommendationStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


class RecommendationSource(str, Enum):
    RULE_BASED = "rule_based"
    SIMULATION_ANALYSIS = "simulation_analysis"
    AI_AGENT = "ai_agent"
    HUMAN_OPERATOR = "human_operator"


class AgentResponseStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    ERROR = "error"


class WebSocketEventType(str, Enum):
    SIMULATION_STARTED = "simulation_started"
    SIMULATION_FRAME = "simulation_frame"
    SIMULATION_PAUSED = "simulation_paused"
    SIMULATION_COMPLETED = "simulation_completed"
    SIMULATION_ERROR = "simulation_error"
    RISK_UPDATED = "risk_updated"
    ALERT_CREATED = "alert_created"
    AGENT_UPDATE = "agent_update"
    RECOMMENDATION_CREATED = "recommendation_created"


class GeoPoint(BaseModel):
    type: str = Field(default="Point", pattern="^Point$")
    coordinates: tuple[float, float]


class Scenario(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    disaster_type: DisasterType
    location_name: str | None = None
    location: GeoPoint | None = None
    status: ScenarioStatus
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ScenarioVersion(BaseModel):
    id: UUID
    scenario_id: UUID
    version_number: int
    label: str | None = None
    scenario_config: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None
    created_at: datetime | None = None


class SimulationState(BaseModel):
    simulation_run_id: UUID
    simulation_time: datetime | None = None
    timestep: int
    disaster_type: DisasterType
    environmental_state: dict[str, Any] = Field(default_factory=dict)
    hazard_state: dict[str, Any] = Field(default_factory=dict)
    affected_area: dict[str, Any] | None = None
    risk_state: dict[str, Any] = Field(default_factory=dict)
    infrastructure_impacts: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TimelineFrame(BaseModel):
    simulation_run_id: UUID
    timestep: int
    simulation_time: datetime | None = None
    state: dict[str, Any]
    is_key_event: bool = False


class RiskAssessment(BaseModel):
    id: UUID
    simulation_run_id: UUID
    category: RiskCategory
    level: RiskLevel
    score: float | None = None
    explanation: str | None = None
    timestep: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class VulnerabilityResult(BaseModel):
    id: UUID
    simulation_run_id: UUID
    infrastructure_asset_id: UUID | None = None
    region_label: str | None = None
    level: RiskLevel
    reason: str | None = None
    impact_description: str | None = None
    timestep: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class AgentRequest(BaseModel):
    request_id: UUID
    agent_type: str
    scenario_id: UUID | None = None
    simulation_run_id: UUID | None = None
    simulation_state: dict[str, Any] | None = None
    task: str
    context: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentResponse(BaseModel):
    request_id: UUID
    agent_type: str
    status: AgentResponseStatus
    findings: list[dict[str, Any]] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RAGQuery(BaseModel):
    disaster_type: DisasterType | None = None
    location: str | None = None
    query: str
    simulation_context: dict[str, Any] | None = None
    required_source_type: str | None = None
    filters: dict[str, Any] = Field(default_factory=dict)


class RAGResult(BaseModel):
    source_id: str
    title: str
    source_type: str | None = None
    publisher: str | None = None
    publication_date: date | None = None
    relevance_score: float | None = Field(default=None, ge=0, le=1)
    excerpt: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ResponseRecommendation(BaseModel):
    id: UUID
    simulation_run_id: UUID
    priority: RecommendationPriority
    action: str
    rationale: str | None = None
    evidence_reference: str | None = None
    responsible_role: str | None = None
    deadline_timestep: int | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    source: RecommendationSource
    status: RecommendationStatus
    created_at: datetime | None = None


class IncidentActionPlan(BaseModel):
    id: UUID
    simulation_run_id: UUID
    incident_overview: str | None = None
    situation_summary: str | None = None
    objectives: list[str] = Field(default_factory=list)
    priority_actions: list[dict[str, Any]] = Field(default_factory=list)
    operational_period: dict[str, Any] = Field(default_factory=dict)
    resources: dict[str, Any] = Field(default_factory=dict)
    evacuation_strategy: str | None = None
    safety_considerations: str | None = None
    communication_plan: str | None = None
    environmental_considerations: str | None = None
    monitoring_plan: str | None = None
    decision_triggers: list[dict[str, Any]] = Field(default_factory=list)
    sources: list[dict[str, Any]] = Field(default_factory=list)
    generation_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class WebSocketEvent(BaseModel):
    event_type: WebSocketEventType
    timestamp: datetime
    simulation_run_id: UUID | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
