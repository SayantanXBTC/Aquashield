"""Evidence references — the only currency an agent may use to justify a claim.

Every number the AI layer reports must trace to an `EvidenceRef` produced by
the Context Collector from a read-only tool call. Agents cite evidence by
`id`; the Synthesis & Safety node drops anything that cites an id it does not
know, so an LLM cannot smuggle in an invented water level or arrival time.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

EvidenceKind = Literal[
    "scenario",
    "simulation_run",
    "timeline_frame",
    "hazard_footprint",
    "asset_exposure",
    "structure_impact",
]

DATA_UNAVAILABLE = "DATA_UNAVAILABLE"
RESOURCE_DATA_UNAVAILABLE = "RESOURCE_DATA_UNAVAILABLE"
NOT_CONFIGURED = "NOT_CONFIGURED"


class EvidenceRef(BaseModel):
    """One citable fact from the deterministic data layer."""

    id: str = Field(description="Short stable id, e.g. E1, E2 — cited by agents.")
    kind: EvidenceKind
    simulation_run_id: str | None = None
    frame_index: int | None = None
    asset_id: str | None = None
    structure_id: str | None = None
    summary: str = Field(description="Human-readable restatement of the fact, numbers included.")
    values: dict[str, Any] = Field(default_factory=dict, description="The raw values the summary was built from.")
    source: str = Field(description="Tool that produced this evidence (Agent -> Tool -> Service -> Repository).")


class DataLimitation(BaseModel):
    """Something the AI wanted and could not obtain from the data layer."""

    code: str = Field(description="DATA_UNAVAILABLE, RESOURCE_DATA_UNAVAILABLE, NOT_CONFIGURED, ...")
    subject: str
    detail: str
