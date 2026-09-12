"""Disaster catalog — additive discovery/documentation metadata for all 9
supported `DisasterType` values (CLAUDE.md §25, docs/development/scenarios.md
"Discovery endpoint").

This is NOT a replacement for the existing hand-maintained parallel
registries (`DISASTER_CONFIG_SCHEMAS` in app/schemas/scenario_config.py,
`disasterFieldSpecs.ts` on the frontend, `MODEL_REGISTRY` in
simulation/core/registry.py) — CLAUDE.md §25 already documents and justifies
keeping those hand-kept-in-sync rather than generated from one another. This
module only *reads* the existing sources of truth (the config schemas for
parameter keys, the simulation model registry for the real model_identifier)
to answer "what disaster types exist and what actually powers them" — it
never becomes a second place field lists or model selection are defined.
"""

from __future__ import annotations

from typing import TypedDict

from app.db.models.enums import DisasterType
from app.schemas.scenario_config import DISASTER_CONFIG_SCHEMAS

from simulation.core.registry import get_model_class

# Short, factual descriptions only — no claim of forecasting accuracy or
# operational validity anywhere in this catalog (CLAUDE.md §7/§31; every
# underlying model is a SIMPLIFIED DEMONSTRATION MODEL — see
# docs/development/simulation.md).
_DISPLAY_NAMES: dict[DisasterType, str] = {
    DisasterType.FLOOD: "Flood",
    DisasterType.FLASH_FLOOD: "Flash Flood",
    DisasterType.COASTAL_FLOOD: "Coastal Flood",
    DisasterType.STORM_SURGE: "Storm Surge",
    DisasterType.CYCLONE: "Cyclone",
    DisasterType.TSUNAMI: "Tsunami",
    DisasterType.OIL_SPILL: "Oil Spill",
    DisasterType.CHEMICAL_POLLUTION: "Chemical Pollution",
    DisasterType.SEARCH_RESCUE: "Search & Rescue",
}

_SHORT_DESCRIPTIONS: dict[DisasterType, str] = {
    DisasterType.FLOOD: "River / rainfall-driven inundation.",
    DisasterType.FLASH_FLOOD: "Rapid-onset flooding from intense, short-duration rainfall.",
    DisasterType.COASTAL_FLOOD: "Coastal inundation from tidal/surge-driven water rise.",
    DisasterType.STORM_SURGE: "Cyclone-driven abnormal coastal water rise.",
    DisasterType.CYCLONE: "Rotating wind storm with a moving center and expanding wind field.",
    DisasterType.TSUNAMI: "Wave train propagating from an offshore source toward the coast.",
    DisasterType.OIL_SPILL: "Oil slick drift and weathering on open water.",
    DisasterType.CHEMICAL_POLLUTION: "Pollutant plume drift and dilution on open water.",
    DisasterType.SEARCH_RESCUE: "Drifting person/vessel position and search-area growth.",
}

_CATEGORIES: dict[DisasterType, str] = {
    DisasterType.FLOOD: "hydrological",
    DisasterType.FLASH_FLOOD: "hydrological",
    DisasterType.COASTAL_FLOOD: "hydrological",
    DisasterType.STORM_SURGE: "meteorological",
    DisasterType.CYCLONE: "meteorological",
    DisasterType.TSUNAMI: "geophysical",
    DisasterType.OIL_SPILL: "maritime_pollution",
    DisasterType.CHEMICAL_POLLUTION: "maritime_pollution",
    DisasterType.SEARCH_RESCUE: "maritime_emergency",
}


class DisasterCatalogEntryDict(TypedDict):
    disaster_type: DisasterType
    display_name: str
    short_description: str
    category: str
    model_identifier: str
    parameter_keys: list[str]


def _parameter_keys(disaster_type: DisasterType) -> list[str]:
    """Introspects `DISASTER_CONFIG_SCHEMAS` rather than hand-typing a second
    copy of each disaster type's field list, so this can't drift from the
    schema that actually validates `scenario_config`."""
    schema_cls = DISASTER_CONFIG_SCHEMAS.get(disaster_type)
    if schema_cls is None:
        return []
    return sorted(schema_cls.model_fields.keys())


def build_disaster_catalog() -> list[DisasterCatalogEntryDict]:
    """One entry per `DisasterType`, in enum declaration order. `model_identifier`
    is resolved live through `simulation.core.registry.get_model_class` — never
    a hardcoded per-type string — so a storm_surge entry always reports the
    real `cyclone-demo-v1`, matching what a storm_surge SimulationRun actually
    records (see docs/development/simulation.md's aliasing table)."""
    entries: list[DisasterCatalogEntryDict] = []
    for disaster_type in DisasterType:
        model_cls = get_model_class(disaster_type.value)
        entries.append(
            {
                "disaster_type": disaster_type,
                "display_name": _DISPLAY_NAMES[disaster_type],
                "short_description": _SHORT_DESCRIPTIONS[disaster_type],
                "category": _CATEGORIES[disaster_type],
                "model_identifier": model_cls.model_identifier,
                "parameter_keys": _parameter_keys(disaster_type),
            }
        )
    return entries
