"""The Command Brief — the AI layer's only deliverable."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from agents.schemas.evidence import RESOURCE_DATA_UNAVAILABLE, DataLimitation, EvidenceRef
from agents.schemas.outputs import ExposureFinding, GroundedStatement, Priority, RecommendedAction

AgentExecutionStatus = Literal["PENDING", "RUNNING", "COMPLETED", "FAILED", "UNAVAILABLE", "SKIPPED"]


class AgentRun(BaseModel):
    """One node's execution record — what the Agent Execution HUD renders.

    Purely an audit of the graph run: which agent, whether it completed, how
    long it took and a one-line factual summary. Never chain-of-thought."""

    agent: str
    label: str
    status: AgentExecutionStatus = "PENDING"
    summary: str | None = None
    duration_ms: float = 0.0


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
    precautions: list[RecommendedAction] = Field(default_factory=list)
    recommended_actions: list[RecommendedAction] = Field(default_factory=list)
    resource_status: str = Field(default=RESOURCE_DATA_UNAVAILABLE, description="No verified resource inventory exists; never an estimate.")
    agent_runs: list[AgentRun] = Field(default_factory=list, description="Per-agent execution record for the Agent Execution HUD.")
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
