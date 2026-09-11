"""Converts a TimelineFrame's already-computed `hazard_state`/`affected_area`
into a disaster-agnostic `HazardFootprint` shape. This is repackaging, not
computation — it never derives a new physical value, only re-labels fields
that a DisasterModel already put in the frame (CLAUDE.md §5: the AI/analysis
layer interprets simulation output, it doesn't invent it).

Dispatch is by `disaster_type` string through `HAZARD_FOOTPRINT_EXTRACTORS`
only, mirroring simulation/core/registry.py's MODEL_REGISTRY pattern — no
if/elif chain, and the same disaster-type reuse decisions (flash_flood/
coastal_flood -> flood extractor, storm_surge -> cyclone extractor,
chemical_pollution -> oil_spill extractor).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from simulation.core.state import TimelineFrame

# (intensity value, intensity units, fallback Point geometry dict-or-None)
ExtractorResult = tuple[float | None, str, dict[str, Any] | None]
Extractor = Callable[[dict[str, Any]], ExtractorResult]


def _point(lat: Any, lon: Any) -> dict[str, Any] | None:
    if lat is None or lon is None:
        return None
    return {"type": "Point", "coordinates": [float(lon), float(lat)]}


def _flood_extract(hazard_state: dict[str, Any]) -> ExtractorResult:
    return hazard_state.get("water_level_m"), "m", None


def _tsunami_extract(hazard_state: dict[str, Any]) -> ExtractorResult:
    source = hazard_state.get("source") or {}
    fallback = _point(source.get("latitude"), source.get("longitude"))
    return hazard_state.get("coastal_impact_m"), "m", fallback


def _cyclone_extract(hazard_state: dict[str, Any]) -> ExtractorResult:
    center = hazard_state.get("center") or {}
    fallback = _point(center.get("latitude"), center.get("longitude"))
    return hazard_state.get("wind_speed_kt"), "kt", fallback


def _oil_spill_extract(hazard_state: dict[str, Any]) -> ExtractorResult:
    center = hazard_state.get("center") or {}
    fallback = _point(center.get("latitude"), center.get("longitude"))
    return hazard_state.get("concentration_index"), "index_0_1", fallback


def _search_rescue_extract(hazard_state: dict[str, Any]) -> ExtractorResult:
    center = hazard_state.get("probable_center") or {}
    fallback = _point(center.get("latitude"), center.get("longitude"))
    # Search radius (not `confidence`) is used as "intensity" here — a larger
    # search area is the worse/more-severe outcome for this disaster type,
    # matching the severity-band convention used elsewhere (bigger number ==
    # more severe), unlike `confidence` where bigger is better.
    return hazard_state.get("search_radius_km"), "km", fallback


HAZARD_FOOTPRINT_EXTRACTORS: dict[str, Extractor] = {
    "flood": _flood_extract,
    "flash_flood": _flood_extract,
    "coastal_flood": _flood_extract,
    "tsunami": _tsunami_extract,
    "cyclone": _cyclone_extract,
    "storm_surge": _cyclone_extract,
    "oil_spill": _oil_spill_extract,
    "chemical_pollution": _oil_spill_extract,
    "search_rescue": _search_rescue_extract,
}


class HazardFootprintError(Exception):
    """Raised for an unregistered disaster_type — never silently defaulted to
    an empty/fabricated footprint."""


@dataclass
class HazardFootprint:
    disaster_type: str
    simulation_run_id: str
    frame_index: int
    geometry: dict[str, Any] | None  # GeoJSON geometry, or None (no hazard footprint yet, e.g. a
    # tsunami's t0 frame before any wave has left the source)
    intensity: float | None
    intensity_units: str
    model_id: str
    model_version: str
    is_demo_model: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "disaster_type": self.disaster_type,
            "simulation_run_id": self.simulation_run_id,
            "frame_index": self.frame_index,
            "geometry": self.geometry,
            "geometry_type": self.geometry.get("type") if self.geometry else None,
            "intensity": self.intensity,
            "intensity_units": self.intensity_units,
            "model_id": self.model_id,
            "model_version": self.model_version,
            "is_demo_model": self.is_demo_model,
        }


def build_hazard_footprint(frame: TimelineFrame, *, model_identifier: str) -> HazardFootprint:
    """Repackages one TimelineFrame into a HazardFootprint. `model_version`
    is currently the same string as `model_identifier` (e.g. "flood-demo-v1")
    since no disaster model has an independent version number yet distinct
    from its identifier — see simulation/core/model.py's `model_identifier`
    ClassVar; this field exists so a future model that DOES version
    independently of its identifier doesn't require an API shape change."""
    disaster_type = frame.state.disaster_type
    try:
        extractor = HAZARD_FOOTPRINT_EXTRACTORS[disaster_type]
    except KeyError as exc:
        raise HazardFootprintError(
            f"No hazard footprint extractor registered for disaster_type={disaster_type!r}. "
            f"Known: {sorted(HAZARD_FOOTPRINT_EXTRACTORS)}"
        ) from exc

    intensity, units, fallback_point = extractor(frame.state.hazard_state)
    geometry = frame.state.affected_area or fallback_point

    return HazardFootprint(
        disaster_type=disaster_type,
        simulation_run_id=frame.simulation_run_id,
        frame_index=frame.timestep,
        geometry=geometry,
        intensity=intensity,
        intensity_units=units,
        model_id=model_identifier,
        model_version=model_identifier,
        is_demo_model=True,
    )
