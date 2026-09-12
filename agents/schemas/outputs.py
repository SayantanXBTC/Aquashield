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
    evidence_ids: list[str] = Field(default_factory=list)

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
