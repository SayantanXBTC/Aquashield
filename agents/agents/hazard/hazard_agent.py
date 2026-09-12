"""Hazard Agent — how the hazard is progressing across the frame window.

Tier 1 of the analysis graph; runs in parallel with the Damage and Risk
agents. It reads the deterministic frame evidence the Context Collector
produced and restates it — it never computes or predicts physics itself
(CLAUDE.md §5)."""

from __future__ import annotations

from agents.llm.provider import LLMProvider
from agents.prompts.versions import HAZARD_AGENT_SYSTEM
from agents.schemas.context import ContextPayload
from agents.schemas.outputs import HazardAssessment

AGENT_NAME = "hazard_agent"
TASK = "hazard_assessment"


def assess_hazard(provider: LLMProvider, context: ContextPayload) -> HazardAssessment:
    return provider.generate(task=TASK, system=HAZARD_AGENT_SYSTEM, payload=context.model_dump(mode="json"), output_model=HazardAssessment)
