"""Structured agent outputs. These are the ONLY shapes an LLM provider may
return — every free-text field is a narrative over cited evidence, every
enum is closed, and every recommendation is human-gated by construction."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from agents.schemas.evidence import RESOURCE_DATA_UNAVAILABLE

ClaimKind = Literal["observed_simulation_fact", "spatial_exposure"]
PriorityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]


class GroundedStatement(BaseModel):
    """A sentence that must cite evidence ids the Context Collector produced."""

    statement: str = Field(max_length=600)
    evidence_ids: list[str] = Field(default_factory=list)


class HazardProgression(BaseModel):
    trend: Literal["approaching", "landfall", "inland", "receding", "stationary", "unknown"] = "unknown"
    statements: list[GroundedStatement] = Field(default_factory=list)


class ExposureFinding(BaseModel):
    subject: str = Field(description="Asset or structure name.")
    subject_ref: str = Field(description="asset_id / structure_id / 'region'.")
    claim_kind: ClaimKind
    statement: str = Field(max_length=600)
    evidence_ids: list[str] = Field(default_factory=list)
    severity_hint: PriorityLevel = "LOW"


class ImpactAnalysis(BaseModel):
    """Agent 2 output."""

    hazard_progression: HazardProgression = Field(default_factory=HazardProgression)
    exposures: list[ExposureFinding] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class Priority(BaseModel):
    level: PriorityLevel
    subject: str
    rationale: str = Field(max_length=600)
    evidence_ids: list[str] = Field(default_factory=list)


class RecommendedAction(BaseModel):
    action: str = Field(max_length=400)
    priority: PriorityLevel
    prerequisites: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    resources: str = Field(default=RESOURCE_DATA_UNAVAILABLE)
    requires_human_approval: Literal[True] = True
    evidence_ids: list[str] = Field(default_factory=list, description="Simulation evidence ids (E1, E2, ...) from the Context Collector.")
    citations: list[str] = Field(
        default_factory=list,
        description="Authoritative-source evidence ids (RAG-...) from the role's EvidencePack. Never invented — "
        "the Safety Validator drops any id that isn't in the pack it was actually given.",
    )

    @field_validator("resources")
    @classmethod
    def _resources_never_invented(cls, value: str) -> str:
        # The AI layer has no verified resource inventory; anything else is a
        # fabrication until a resource data source exists.
        return RESOURCE_DATA_UNAVAILABLE if not value or value.strip() != RESOURCE_DATA_UNAVAILABLE else value


class TacticalPlan(BaseModel):
    """Agent 3 output."""

    priorities: list[Priority] = Field(default_factory=list)
    actions: list[RecommendedAction] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class SituationNarrative(BaseModel):
    """Synthesis node LLM output: prose over already-validated findings."""

    situation: str = Field(max_length=1200)
    current_hazard: str = Field(max_length=800)


# --- Prompt 15: one closed output schema per specialised agent ---------------
# The graph splits the former Impact Analyst / Tactical Advisor pair into six
# specialised agents. Each still returns ONLY the shapes below, and every
# claim still carries evidence ids — the Safety Validator treats them all
# identically.


class HazardAssessment(BaseModel):
    """Hazard Agent output — how the hazard is progressing across the frame
    window. Never a prediction of its own; a restatement of frame evidence."""

    hazard_progression: HazardProgression = Field(default_factory=HazardProgression)
    uncertainties: list[str] = Field(default_factory=list)


class DamageAssessment(BaseModel):
    """Damage / Impact Agent output — which assets and structures the
    deterministic layer reports as POTENTIALLY EXPOSED. Never destroyed."""

    exposures: list[ExposureFinding] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class RiskAssessment(BaseModel):
    """Risk / Vulnerability Agent output — criticality-ranked priorities."""

    priorities: list[Priority] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class PrecautionSet(BaseModel):
    """Precaution Agent output — protective measures taken before impact."""

    precautions: list[RecommendedAction] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class ResponsePlan(BaseModel):
    """Tactical Response Agent output — targeted actions per exposed subject."""

    actions: list[RecommendedAction] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class ResourceAssessment(BaseModel):
    """Resource Agent output.

    AQUASHIELD has no verified resource inventory, so this agent reports
    RESOURCE_DATA_UNAVAILABLE and nothing else. `status` is a closed literal
    precisely so a model cannot invent "3 rescue boats"; when a real
    inventory data source exists, this schema gains the fields it feeds."""

    status: Literal["RESOURCE_DATA_UNAVAILABLE"] = RESOURCE_DATA_UNAVAILABLE
    note: str = Field(
        default="No verified resource inventory is connected to AQUASHIELD; resource availability cannot be assessed.",
        max_length=400,
    )
