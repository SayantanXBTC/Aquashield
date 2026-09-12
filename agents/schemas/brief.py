"""The Command Brief — the AI layer's only deliverable."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from agents.schemas.evidence import DataLimitation, EvidenceRef
from agents.schemas.outputs import ExposureFinding, GroundedStatement, Priority, RecommendedAction

AgentExecutionStatus = Literal["PENDING", "RUNNING", "COMPLETED", "FAILED"]


class CommandBrief(BaseModel):
    scenario_id: str
    simulation_run_id: str
    frame_index: int
    generated_at: datetime
    situation: str
    current_hazard: str
    hazard_progression: list[GroundedStatement] = Field(default_factory=list)
    key_exposures: list[ExposureFinding] = Field(default_factory=list)
    priorities: list[Priority] = Field(default_factory=list)
    recommended_actions: list[RecommendedAction] = Field(default_factory=list)
    evidence_references: list[EvidenceRef] = Field(default_factory=list)
    data_limitations: list[DataLimitation] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    human_review_required: Literal[True] = True
    validation_notes: list[str] = Field(
        default_factory=list, description="What Synthesis & Safety stripped or flagged (audit visibility, no chain-of-thought)."
    )
    disclaimer: str = (
        "Generated from SIMPLIFIED DEMONSTRATION MODEL output. Spatial intersection means potentially "
        "exposed, never destroyed. Not an official forecast; every action requires human approval."
    )
