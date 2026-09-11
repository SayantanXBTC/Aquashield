"""API request/response schemas for the scenario system.

These are the API contracts — never expose a SQLAlchemy model directly as a
response. Shapes here mirror shared/contracts/scenario*.schema.json where
the concept is shared cross-domain; request/response envelopes (pagination,
create/update requests) are API-local and not part of the cross-domain
shared contracts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.db.models.enums import DisasterType, ScenarioStatus, SimulationStatus
from app.schemas.scenario_config import validate_scenario_config

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


def _validate_coordinates(latitude: float | None, longitude: float | None) -> None:
    if (latitude is None) != (longitude is None):
        raise ValueError("latitude and longitude must be provided together")


class ScenarioCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    disaster_type: DisasterType
    location_name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    scenario_config: dict[str, Any] = Field(default_factory=dict)
    version_label: str | None = None
    created_by: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "ScenarioCreateRequest":
        _validate_coordinates(self.latitude, self.longitude)
        self.scenario_config = validate_scenario_config(self.disaster_type, self.scenario_config)
        return self


class ScenarioUpdateRequest(BaseModel):
    """All fields optional (PATCH semantics). Updating `scenario_config`
    creates a new ScenarioVersion; every other field updates the Scenario
    row in place — see docs/development/scenarios.md."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    location_name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    status: ScenarioStatus | None = None
    scenario_config: dict[str, Any] | None = None
    version_label: str | None = None
    version_notes: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "ScenarioUpdateRequest":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class ScenarioVersionCreateRequest(BaseModel):
    scenario_config: dict[str, Any]
    label: str | None = None
    notes: str | None = None


class ScenarioVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_id: UUID
    version_number: int
    label: str | None
    scenario_config: dict[str, Any]
    notes: str | None
    created_at: datetime


class ScenarioListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    disaster_type: DisasterType
    status: ScenarioStatus
    location_name: str | None
    latitude: float | None
    longitude: float | None
    current_version_number: int | None
    updated_at: datetime


class ScenarioDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    disaster_type: DisasterType
    status: ScenarioStatus
    location_name: str | None
    latitude: float | None
    longitude: float | None
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    current_version: ScenarioVersionOut | None
    version_count: int


class SimulationRunCreateRequest(BaseModel):
    scenario_version_id: UUID | None = Field(
        default=None,
        description="Defaults to the scenario's current (latest) version if omitted.",
    )
    model_identifier: str | None = None
    timestep_config: dict[str, Any] = Field(default_factory=dict)


class SimulationRunOut(BaseModel):
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
    message: str = "Simulation run created; simulation engine not yet executed."
