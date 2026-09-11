import pytest

from app.db.models.enums import RiskLevel
from app.services.impact_severity import hazard_severity_band


@pytest.mark.parametrize(
    "disaster_type,intensity,expected",
    [
        ("flood", 0.1, RiskLevel.LOW),
        ("flood", 0.5, RiskLevel.MODERATE),
        ("flood", 1.5, RiskLevel.HIGH),
        ("flood", 5.0, RiskLevel.CRITICAL),
        ("cyclone", 20.0, RiskLevel.LOW),
        ("cyclone", 96.0, RiskLevel.CRITICAL),
        ("search_rescue", 5.0, RiskLevel.LOW),
        ("search_rescue", 60.0, RiskLevel.CRITICAL),
    ],
)
def test_hazard_severity_band_thresholds(disaster_type, intensity, expected):
    assert hazard_severity_band(disaster_type, intensity) == expected


def test_missing_intensity_defaults_to_low_not_fabricated():
    assert hazard_severity_band("flood", None) == RiskLevel.LOW


def test_unregistered_disaster_type_raises():
    with pytest.raises(ValueError):
        hazard_severity_band("not_a_real_type", 1.0)
