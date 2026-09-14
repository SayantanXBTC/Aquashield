"""API shapes for the AI layer. The Command Brief itself is the agents
package's Pydantic model, re-exported so the API contract and the graph
output are the same object."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from agents.schemas.brief import CommandBrief  # noqa: F401 — re-exported

from app.db.models.enums import AIRequestStatus


AIRequestType = Literal["playback", "scrub", "paused", "complete", "manual"]


class AIAnalyzeRequest(BaseModel):
    scenario_id: UUID
    simulation_run_id: UUID
    frame_index: int = Field(ge=0)
    # Optional, but when supplied it is checked against the run's own version:
    # an analysis of a configuration the operator has already moved on from is
    # refused as stale rather than answered (Prompt 15).
    scenario_version_id: UUID | None = None
    request_type: AIRequestType | None = None
    user_question: str | None = Field(default=None, max_length=2000)


class AIRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_id: UUID
    simulation_run_id: UUID
    scenario_version_id: UUID | None = None
    frame_index: int
    request_type: str | None = None
    user_question: str | None = None
    status: AIRequestStatus
    provider: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    agent_versions: dict[str, Any] = Field(default_factory=dict)
    tools_called: list[dict[str, Any]] = Field(default_factory=list)
    execution_ms: float | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class AIRequestStatusOut(BaseModel):
    id: UUID
    status: AIRequestStatus
    execution_ms: float | None = None
    error: str | None = None


class AIRequestResultOut(BaseModel):
    id: UUID
    status: AIRequestStatus
    result: CommandBrief | None = None
    error: str | None = None
