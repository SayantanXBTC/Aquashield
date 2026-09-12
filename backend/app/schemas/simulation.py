"""API request/response schemas for simulation run execution/timeline
retrieval. Mirrors the shape of shared/contracts/simulation_run.schema.json
and timeline_frame.schema.json where the concept is shared cross-domain;
these envelope/detail shapes are API-local, same convention as
backend/app/schemas/scenario.py."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models.enums import ArtifactType, SimulationStatus


class SimulationArtifactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    artifact_type: ArtifactType
    format: str | None
    timestep_start: int | None
    timestep_end: int | None
    extra_metadata: dict[str, Any]


class SimulationRunDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_version_id: UUID
    status: SimulationStatus
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: float | None
    timestep_config: dict[str, Any]
    model_identifier: str | None
    error_message: str | None
    created_at: datetime
    artifact: SimulationArtifactOut | None = None
    frame_count: int | None = None


class TimelineFrameOut(BaseModel):
    simulation_run_id: str
    timestep: int
    simulation_time: str | None
    state: dict[str, Any]
    is_key_event: bool = False


class TimelineResponse(BaseModel):
    simulation_run_id: UUID
    frame_count: int
    frames: list[TimelineFrameOut]
