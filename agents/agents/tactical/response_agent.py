"""Tactical Response Agent — targeted actions for the specific subjects the
deterministic layer reports as potentially exposed.

Tier 2; runs in parallel with the Precaution Agent. Advice only: every
action is human-gated and carries RESOURCE_DATA_UNAVAILABLE."""

from __future__ import annotations

from typing import Any

from agents.llm.provider import LLMProvider
from agents.prompts.versions import RESPONSE_AGENT_SYSTEM
from agents.schemas.context import ContextPayload
from agents.schemas.outputs import ResponsePlan

AGENT_NAME = "response_agent"
TASK = "response_plan"


def plan_response(provider: LLMProvider, context: ContextPayload, findings: dict[str, Any]) -> ResponsePlan:
    payload = {"context": context.model_dump(mode="json"), "findings": findings}
    return provider.generate(task=TASK, system=RESPONSE_AGENT_SYSTEM, payload=payload, output_model=ResponsePlan)
