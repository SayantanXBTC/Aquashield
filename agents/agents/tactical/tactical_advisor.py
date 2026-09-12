"""Agent 3 — Tactical Advisor. Runs in parallel with Agent 2."""

from __future__ import annotations

from agents.llm.provider import LLMProvider
from agents.prompts.versions import TACTICAL_ADVISOR_SYSTEM
from agents.schemas.context import ContextPayload
from agents.schemas.outputs import TacticalPlan

AGENT_NAME = "tactical_advisor"
TASK = "tactical_plan"


def advise(provider: LLMProvider, context: ContextPayload) -> TacticalPlan:
    payload = context.model_dump(mode="json")
    return provider.generate(task=TASK, system=TACTICAL_ADVISOR_SYSTEM, payload=payload, output_model=TacticalPlan)
