"""AquaShieldAgentState — the LangGraph state shared by all nodes.

Pydantic, strongly typed. List fields that several nodes append to carry an
`operator.add` reducer so the parallel Agent 2 / Agent 3 branch can merge
without clobbering each other; scalar outputs are written by exactly one
node each."""

from __future__ import annotations

import operator
from typing import Annotated

from pydantic import BaseModel, Field

from agents.schemas.brief import AgentExecutionStatus, AgentRun, CommandBrief
from agents.tools.retrieval.evidence_retriever import ClaimMapping, EvidenceItem, EvidencePack
from agents.schemas.context import ContextPayload
from agents.schemas.evidence import DataLimitation
from agents.schemas.outputs import (
    DamageAssessment,
    ExposureFinding,
    GroundedStatement,
    HazardAssessment,
    ImpactAnalysis,
    PrecautionSet,
    Priority,
    RecommendedAction,
    ResourceAssessment,
    ResponsePlan,
    RiskAssessment,
    TacticalPlan,
)


class ToolCallRecord(BaseModel):
    agent: str
    tool: str
    arguments: dict = Field(default_factory=dict)
    ok: bool = True
    duration_ms: float = 0.0
    note: str | None = None


class AquaShieldAgentState(BaseModel):
    # --- request ---
    request_id: str
    scenario_id: str
    simulation_run_id: str
    frame_index: int
    user_question_raw: str | None = None

    # --- Agent 1 ---
    context: ContextPayload | None = None

    # --- Tier 1 (parallel): hazard / damage / risk ---
    hazard_assessment: HazardAssessment | None = None
    damage_assessment: DamageAssessment | None = None
    risk_assessment: RiskAssessment | None = None

    # --- Retrieval: role-scoped authoritative evidence for Tier 2 ---
    # Written once by the evidence_retrieval node (no reducer needed — it is
    # not a parallel branch); keyed "precaution" / "response".
    evidence_packs: dict[str, EvidencePack] = Field(default_factory=dict)

    # --- Tier 2 (parallel): precaution / response ---
    precaution_set: PrecautionSet | None = None
    response_plan: ResponsePlan | None = None

    # --- Tier 3: resource (only if a verified inventory exists) ---
    resource_assessment: ResourceAssessment | None = None

    # --- Safety Validator output: only evidence-grounded findings survive ---
    validated_progression: list[GroundedStatement] = Field(default_factory=list)
    validated_exposures: list[ExposureFinding] = Field(default_factory=list)
    validated_priorities: list[Priority] = Field(default_factory=list)
    validated_precautions: list[RecommendedAction] = Field(default_factory=list)
    validated_actions: list[RecommendedAction] = Field(default_factory=list)
    hazard_trend: str = "unknown"
    validation_notes: list[str] = Field(default_factory=list)
    evidence_citations: list[EvidenceItem] = Field(default_factory=list)
    claim_mappings: list[ClaimMapping] = Field(default_factory=list)

    # --- Legacy composite views (kept so existing callers/tests still read
    # the pre-Prompt-15 shapes; assembled by the Safety Validator) ---
    impact_analysis: ImpactAnalysis | None = None
    tactical_plan: TacticalPlan | None = None

    # --- Command Synthesizer ---
    command_brief: CommandBrief | None = None

    # --- audit (append-merged across branches) ---
    tools_called: Annotated[list[ToolCallRecord], operator.add] = Field(default_factory=list)
    uncertainties: Annotated[list[str], operator.add] = Field(default_factory=list)
    limitations: Annotated[list[DataLimitation], operator.add] = Field(default_factory=list)
    agent_versions: Annotated[dict[str, str], operator.or_] = Field(default_factory=dict)
    errors: Annotated[list[str], operator.add] = Field(default_factory=list)
    agent_runs: Annotated[list[AgentRun], operator.add] = Field(default_factory=list)

    status: AgentExecutionStatus = "PENDING"
