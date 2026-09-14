"""Retrieval query construction — turns simulation/impact context into the
text and metadata filter a hybrid retriever needs.

Query text is deliberately role-phrased (architecture.md §10 "Role-Specific
Scopes"): the same hazard state produces a different query for the Hazard
Analyst (thresholds, wave/wind dynamics) than for the Precaution Agent
(life-safety, evacuation) — different vocabulary retrieves different
sections of the same authoritative document.
"""

from __future__ import annotations

from rag.schemas.models import AgentRole, RetrievalQuery

_ROLE_FOCUS: dict[AgentRole, str] = {
    "hazard": "warning thresholds hazard progression dynamics monitoring",
    "damage": "critical infrastructure vulnerability exposure standards",
    "risk": "risk prioritisation criticality ranking vulnerable population",
    "precaution": "life safety evacuation shelter warning protocol immediate action",
    "response": "multi-agency coordination incident command response framework",
}


def build_query_text(query: RetrievalQuery) -> str:
    parts = [query.disaster_type.replace("_", " "), _ROLE_FOCUS[query.role]]
    if query.hazard_summary:
        parts.append(query.hazard_summary)
    if query.impacted_asset_types:
        parts.append(" ".join(sorted(set(query.impacted_asset_types))))
    if query.operator_question:
        # Untrusted operator text — included as additional retrieval
        # vocabulary only, exactly like the analysis agents' sanitised
        # operator_question (agents/tools/sanitize.py). It steers WHICH
        # evidence is retrieved; it can never become part of a citation's
        # content, and the same injection sanitizer runs on it before it
        # ever reaches here (see rag/retrieval/retriever.py).
        parts.append(query.operator_question)
    return " ".join(p for p in parts if p).strip()
