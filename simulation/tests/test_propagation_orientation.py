"""Coastal orientation: a west-facing coast (ocean west, land east, the
historical default) and an east-facing coast (ocean east, land west) are the
same geometry with an opposite sign."""

from simulation.core.propagation import (
    DEFAULT_SHORE,
    ShoreParams,
    distance_to_coast_along_heading,
    is_land,
    land_depth_km,
    shore_x,
)
from simulation.core.structures import inland_depth_km

# The demo shoreline reflected about x = 150: shore_x'(y) = 300 - shore_x(y).
EAST_FACING = ShoreParams(
    base_x_km=300.0 - DEFAULT_SHORE.base_x_km,
    terms=tuple((-amp, freq, phase) for amp, freq, phase in DEFAULT_SHORE.terms),
    land_sign=-1.0,
)


def test_default_shore_is_west_facing():
    assert DEFAULT_SHORE.land_sign == 1.0


def test_west_facing_land_is_east_of_the_curve():
    x = shore_x(150.0)
    assert is_land(x + 10.0, 150.0) is True
    assert is_land(x - 10.0, 150.0) is False
    assert land_depth_km(x + 10.0, 150.0) == 10.0


def test_east_facing_land_is_west_of_the_curve():
    x = shore_x(150.0, EAST_FACING)
    assert is_land(x - 10.0, 150.0, EAST_FACING) is True
    assert is_land(x + 10.0, 150.0, EAST_FACING) is False
    assert land_depth_km(x - 10.0, 150.0, EAST_FACING) == 10.0


def test_reflection_preserves_inland_depth():
    """A point and its mirror image are equally far inland.

    Compared with a tolerance, not `==`: the two sides reach the same real
    value via differently-ordered floating-point sums (base +/- terms,
    then a subtraction on one side vs. an addition on the other), so they
    can differ by a couple of ULPs even though they're mathematically
    identical.
    """
    for x, y in ((70.0, 150.0), (210.0, 40.0), (196.0, 299.0)):
        assert abs(land_depth_km(x, y) - land_depth_km(300.0 - x, y, EAST_FACING)) < 1e-9


def test_headings_reverse_between_orientations():
    """East is landward on a west-facing coast; west is landward on an
    east-facing one. The mirrored pair must agree on the distance."""
    west = distance_to_coast_along_heading(70.0, 150.0, 90.0)
    east = distance_to_coast_along_heading(230.0, 150.0, 270.0, EAST_FACING)
    assert west is not None and east is not None
    assert abs(west - east) < 1e-9


def test_east_facing_hazard_moving_seaward_never_lands():
    assert distance_to_coast_along_heading(230.0, 150.0, 90.0, EAST_FACING) is None


def test_structures_inland_depth_is_signed():
    x = shore_x(150.0, EAST_FACING)
    assert inland_depth_km(x - 5.0, 150.0, EAST_FACING) == 5.0
