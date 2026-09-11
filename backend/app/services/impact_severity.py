"""AQUASHIELD's own illustrative severity banding for a hazard footprint's
raw `intensity` value — NOT an official meteorological/hydrological/hazard
classification standard (e.g. this is not the Saffir-Simpson scale, not any
national flood-warning tier). It exists purely so the UI/impact summary has
a consistent LOW/MODERATE/HIGH/CRITICAL vocabulary across disaster types,
using thresholds chosen for this prototype's demo models and documented
here, not hidden in a formula.

Dispatch is by `disaster_type` through `SEVERITY_THRESHOLDS` only, mirroring
simulation/core/registry.py / simulation/core/hazard_footprint.py's
registry-over-if/elif pattern.
"""

from __future__ import annotations

from app.db.models.enums import RiskLevel

# Each entry: ascending (upper_bound_exclusive, RiskLevel) pairs; a value
# below the first bound gets that band, otherwise the next, and any value at
# or above the last bound is the final (CRITICAL) band. Units match
# simulation/core/hazard_footprint.py's `intensity_units` for that type.
SEVERITY_THRESHOLDS: dict[str, list[tuple[float, RiskLevel]]] = {
    # water_level_m — demo bands, not a hydrological flood-stage standard.
    "flood": [(0.3, RiskLevel.LOW), (1.0, RiskLevel.MODERATE), (2.5, RiskLevel.HIGH)],
    "flash_flood": [(0.3, RiskLevel.LOW), (1.0, RiskLevel.MODERATE), (2.5, RiskLevel.HIGH)],
    "coastal_flood": [(0.3, RiskLevel.LOW), (1.0, RiskLevel.MODERATE), (2.5, RiskLevel.HIGH)],
    # coastal_impact_m — demo bands, not a tsunami-warning-center standard.
    "tsunami": [(0.5, RiskLevel.LOW), (2.0, RiskLevel.MODERATE), (5.0, RiskLevel.HIGH)],
    # wind_speed_kt — demo bands loosely modeled on the *shape* of
    # conventional tropical-cyclone wind categories, but explicitly NOT an
    # implementation of the Saffir-Simpson scale or any national warning
    # system (no pressure/eye-structure data is used, only this model's
    # illustrative wind_speed_kt).
    "cyclone": [(34.0, RiskLevel.LOW), (64.0, RiskLevel.MODERATE), (96.0, RiskLevel.HIGH)],
    "storm_surge": [(34.0, RiskLevel.LOW), (64.0, RiskLevel.MODERATE), (96.0, RiskLevel.HIGH)],
    # concentration_index (0-1, illustrative weathering decay) — demo bands.
    "oil_spill": [(0.2, RiskLevel.LOW), (0.5, RiskLevel.MODERATE), (0.8, RiskLevel.HIGH)],
    "chemical_pollution": [(0.2, RiskLevel.LOW), (0.5, RiskLevel.MODERATE), (0.8, RiskLevel.HIGH)],
    # search_radius_km (position-uncertainty growth) — demo bands; larger
    # radius means a worse/more-severe search problem.
    "search_rescue": [(10.0, RiskLevel.LOW), (25.0, RiskLevel.MODERATE), (50.0, RiskLevel.HIGH)],
}


def hazard_severity_band(disaster_type: str, intensity: float | None) -> RiskLevel:
    """Returns AQUASHIELD's own severity band for `intensity`. Unknown
    disaster_type or missing intensity both resolve to the safest assumption
    the data supports: unregistered type raises (never silently guessed),
    missing intensity is treated as LOW (nothing observed yet, e.g. a t0
    frame) rather than fabricating a higher band."""
    if disaster_type not in SEVERITY_THRESHOLDS:
        raise ValueError(
            f"No severity thresholds registered for disaster_type={disaster_type!r}. "
            f"Known: {sorted(SEVERITY_THRESHOLDS)}"
        )
    if intensity is None:
        return RiskLevel.LOW
    for upper_bound, level in SEVERITY_THRESHOLDS[disaster_type]:
        if intensity < upper_bound:
            return level
    return RiskLevel.CRITICAL
