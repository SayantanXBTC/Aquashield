"""Disaster model registry/factory. SimulationEngine selects a model class by
`disaster_type` string through this module only — never an if/elif chain in
the engine itself (Prompt 7 §11). New disaster types register here without
touching engine.py, backend/, agents/, or frontend/ (architecture.md §18).

`flash_flood`/`coastal_flood` reuse FloodModel, `storm_surge` reuses
CycloneModel, and `chemical_pollution` reuses OilSpillModel — the same reuse
pattern backend/app/schemas/scenario_config.py already uses for config
validation (DISASTER_CONFIG_SCHEMAS)."""

from __future__ import annotations

from simulation.core.errors import SimulationConfigError
from simulation.core.model import DisasterModel
from simulation.models.cyclone.model import CycloneModel
from simulation.models.flood.model import FloodModel
from simulation.models.oil_spill.model import OilSpillModel
from simulation.models.search_rescue.model import SearchRescueModel
from simulation.models.tsunami.model import TsunamiModel

MODEL_REGISTRY: dict[str, type[DisasterModel]] = {
    "flood": FloodModel,
    "flash_flood": FloodModel,
    "coastal_flood": FloodModel,
    "storm_surge": CycloneModel,
    "cyclone": CycloneModel,
    "tsunami": TsunamiModel,
    "oil_spill": OilSpillModel,
    "chemical_pollution": OilSpillModel,
    "search_rescue": SearchRescueModel,
}


def get_model_class(disaster_type: str) -> type[DisasterModel]:
    try:
        return MODEL_REGISTRY[disaster_type]
    except KeyError as exc:
        raise SimulationConfigError(
            f"No simulation model registered for disaster_type={disaster_type!r}. "
            f"Known: {sorted(MODEL_REGISTRY)}"
        ) from exc
