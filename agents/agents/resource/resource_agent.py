"""Resource Agent.

Tier 3. AQUASHIELD has no verified resource inventory, so this agent never
calls a model: it reports RESOURCE_DATA_UNAVAILABLE deterministically. It
exists as a node so the graph already has the seam a real inventory would
plug into — and so the UI states the gap explicitly rather than leaving the
operator to assume resources were considered (CLAUDE.md §26a)."""

from __future__ import annotations

from agents.schemas.context import ContextPayload
from agents.schemas.evidence import DataLimitation
from agents.schemas.outputs import ResourceAssessment

AGENT_NAME = "resource_agent"
TASK = "resource_assessment"

NOTE = "No verified resource inventory is connected to AQUASHIELD; resource availability cannot be assessed."


def has_resource_inventory(context: ContextPayload) -> bool:
    """True only when a verified resource data source exists. There is none
    today; the check is a single place to flip when one is connected."""

    return False


def assess_resources(context: ContextPayload) -> tuple[ResourceAssessment, DataLimitation]:
    return (
        ResourceAssessment(note=NOTE),
        DataLimitation(code="RESOURCE_DATA_UNAVAILABLE", subject="resource_inventory", detail=NOTE),
    )
