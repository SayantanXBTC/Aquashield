"""API request/response schemas for the geospatial/hazard-footprint/exposure/
impact endpoints — mirrors the TypeScript contracts added to
shared/types/index.ts in this same phase (CLAUDE.md: matching Pydantic
schema). API-local envelope shapes, same convention as
backend/app/schemas/simulation.py."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel


class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: Any


class GeographicDatasetOut(BaseModel):
    id: UUID
    name: str
    dataset_type: str
    source_provider: str
    source_url: str
    license: str
    version: str
    resolution: str | None
    units: str | None
    data_quality: str
    coverage: str
    feature_count: int
    provenance: dict[str, Any]


class HazardFootprintOut(BaseModel):
    disaster_type: str
    simulation_run_id: str
    frame_index: int
    geometry: dict[str, Any] | None
    geometry_type: str | None
    intensity: float | None
    intensity_units: str
    model_id: str
    model_version: str
    is_demo_model: Literal[True] = True


class HazardFootprintListResponse(BaseModel):
    simulation_run_id: UUID
    frame_count: int
    footprints: list[HazardFootprintOut]


class ExposureResultOut(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    criticality: str
    status: Literal["within_hazard_footprint", "potentially_exposed"]
    distance_km: float | None


class ExposureResponse(BaseModel):
    simulation_run_id: UUID
    frame_index: int | None
    data_quality: Literal["available", "partial", "unavailable", "stale", "unknown"]
    exposure_results: list[ExposureResultOut]


class ImpactFrameOut(BaseModel):
    simulation_run_id: str
    frame_index: int | None
    disaster_type: str | None
    data_quality: Literal["available", "partial", "unavailable", "stale", "unknown"]
    severity_band: Literal["low", "moderate", "high", "critical"] | None
    exposed_asset_count: int
    exposed_counts_by_type: dict[str, int]
    exposed_counts_by_criticality: dict[str, int]
    hazard_footprint: HazardFootprintOut | None
    exposure_results: list[ExposureResultOut]
    vulnerability_assessment_ids: list[str]
    risk_assessment_id: str | None
    is_demo_model: Literal[True] = True
    cached: bool
