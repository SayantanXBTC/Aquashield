import math

from simulation.core.geo import circle_polygon, haversine_km, move_point


def test_haversine_zero_distance():
    assert haversine_km(10.0, 20.0, 10.0, 20.0) == 0.0


def test_haversine_known_distance():
    # London to Paris, ~344 km great-circle.
    d = haversine_km(51.5074, -0.1278, 48.8566, 2.3522)
    assert 330 < d < 360


def test_move_point_zero_distance_is_noop():
    lat, lon = move_point(10.0, 20.0, 90.0, 0.0)
    assert (lat, lon) == (10.0, 20.0)


def test_move_point_matches_haversine_distance():
    lat, lon = move_point(0.0, 0.0, 90.0, 111.0)
    d = haversine_km(0.0, 0.0, lat, lon)
    assert math.isclose(d, 111.0, rel_tol=0.01)


def test_circle_polygon_shape():
    poly = circle_polygon(10.0, 20.0, 5.0, num_points=8)
    assert poly["type"] == "Polygon"
    assert len(poly["coordinates"][0]) == 9  # closed ring: num_points + 1


def test_circle_polygon_zero_radius_is_point():
    result = circle_polygon(10.0, 20.0, 0.0)
    assert result == {"type": "Point", "coordinates": [20.0, 10.0]}
