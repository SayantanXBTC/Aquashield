"""Precaution Agent — protective measures that reduce exposure before impact.

Tier 2; runs in parallel with the Response Agent, after the three Tier 1
agents have written their findings. Advice only: every precaution is
human-gated and carries RESOURCE_DATA_UNAVAILABLE."""

from __future__ import annotations

from typing import Any

from agents.llm.provider import LLMProvider
from agents.prompts.versions import PRECAUTION_AGENT_SYSTEM
from agents.schemas.context import ContextPayload
from agents.schemas.outputs import PrecautionSet
from agents.tools.retrieval.evidence_retriever import EvidencePack

AGENT_NAME = "precaution_agent"
TASK = "precaution_set"


def advise_precautions(provider: LLMProvider, context: ContextPayload, findings: dict[str, Any], evidence: EvidencePack | None = None) -> PrecautionSet:
    """`evidence` is this role's retrieved authoritative-source pack (or
    None if retrieval was never wired in / found nothing). The agent MAY
    cite an item's `evidence_id` in a precaution's `citations`; the Safety
    Validator drops any citation that isn't actually in `evidence.items`."""

    payload = {
        "context": context.model_dump(mode="json"),
        "findings": findings,
        "evidence": evidence.model_dump(mode="json") if evidence else None,
    }
    return provider.generate(task=TASK, system=PRECAUTION_AGENT_SYSTEM, payload=payload, output_model=PrecautionSet)
