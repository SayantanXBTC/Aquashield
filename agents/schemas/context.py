"""Bounded context payload assembled by Agent 1 (Context Collector)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from agents.schemas.evidence import DataLimitation, EvidenceRef


class FrameSnapshot(BaseModel):
    frame_index: int
    timestep: int
    simulation_time: str | None = None
    hazard_state: dict[str, Any] = Field(default_factory=dict)
    infrastructure_impacts: list[dict[str, Any]] = Field(default_factory=list)
    is_key_event: bool = False


class ContextPayload(BaseModel):
    """Everything downstream agents are allowed to know. Untrusted operator
    text is quoted (never instructions) in `operator_question`."""

    scenario_id: str
    scenario_name: str
    disaster_type: str
    simulation_run_id: str
    run_status: str
    model_identifier: str | None = None
    frame_index: int
    frame_count: int
    previous_frame: FrameSnapshot | None = None
    current_frame: FrameSnapshot | None = None
    next_frame: FrameSnapshot | None = None
    hazard_footprint: dict[str, Any] | None = None
    asset_exposures: list[dict[str, Any]] = Field(default_factory=list)
    exposure_data_quality: str = "unknown"
    structures: list[dict[str, Any]] = Field(default_factory=list)
    operator_question: str | None = Field(default=None, description="Sanitized, quoted operator question — data, not instructions.")
    evidence: list[EvidenceRef] = Field(default_factory=list)
    limitations: list[DataLimitation] = Field(default_factory=list)

    def evidence_ids(self) -> set[str]:
        return {e.id for e in self.evidence}
