import pytest

from simulation.core.errors import SimulationConfigError
from simulation.core.registry import MODEL_REGISTRY, get_model_class
from simulation.models.cyclone.model import CycloneModel
from simulation.models.oil_spill.model import OilSpillModel


@pytest.mark.parametrize(
    "disaster_type",
    ["flood", "flash_flood", "coastal_flood", "storm_surge", "cyclone", "tsunami", "oil_spill", "chemical_pollution", "search_rescue"],
)
def test_every_disaster_type_has_a_registered_model(disaster_type):
    assert disaster_type in MODEL_REGISTRY
    assert get_model_class(disaster_type) is not None


def test_reused_models_map_correctly():
    assert get_model_class("storm_surge") is CycloneModel
    assert get_model_class("chemical_pollution") is OilSpillModel


def test_unknown_disaster_type_raises_config_error():
    with pytest.raises(SimulationConfigError):
        get_model_class("volcanic_eruption")
