"""AquaShieldAgentState — the LangGraph state shared by all nodes.

Pydantic, strongly typed. List fields that several nodes append to carry an
`operator.add` reducer so the parallel Agent 2 / Agent 3 branch can merge
without clobbering each other; scalar outputs are written by exactly one
node each."""

from __future__ import annotations

import operator
from typing import Annotated

from pydantic import BaseModel, Field

from agents.schemas.brief import AgentExecutionStatus, CommandBrief
from agents.schemas.context import ContextPayload
from agents.schemas.evidence import DataLimitation
from agents.schemas.outputs import ImpactAnalysis, TacticalPlan


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

    # --- Agent 2 / Agent 3 (parallel) ---
    impact_analysis: ImpactAnalysis | None = None
    tactical_plan: TacticalPlan | None = None

    # --- Join ---
    command_brief: CommandBrief | None = None

    # --- audit (append-merged across branches) ---
    tools_called: Annotated[list[ToolCallRecord], operator.add] = Field(default_factory=list)
    uncertainties: Annotated[list[str], operator.add] = Field(default_factory=list)
    limitations: Annotated[list[DataLimitation], operator.add] = Field(default_factory=list)
    agent_versions: Annotated[dict[str, str], operator.or_] = Field(default_factory=dict)
    errors: Annotated[list[str], operator.add] = Field(default_factory=list)

    status: AgentExecutionStatus = "PENDING"
