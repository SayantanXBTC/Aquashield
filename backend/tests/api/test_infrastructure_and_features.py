from tests.conftest import requires_postgres


@requires_postgres
def test_list_infrastructure_assets_returns_seeded_assets_with_no_active_hazard(client) -> None:
    response = client.get("/infrastructure-assets")
    assert response.status_code == 200
    body = response.json()
    assert body["data_quality"] == "available"
    assert len(body["assets"]) >= 3
    names = {a["asset_name"] for a in body["assets"]}
    assert "Demo General Hospital" in names
    for asset in body["assets"]:
        # Never "damaged"/"exposed" without a hazard footprint to evaluate
        # against — see app/services/infrastructure_service.py.
        assert asset["status"] == "no_active_hazard"
        assert asset["distance_km"] is None


@requires_postgres
def test_nearby_features_returns_real_clipped_coastline_near_dhaka(client) -> None:
    response = client.get(
        "/geographic-features/nearby", params={"latitude": 23.81, "longitude": 90.41, "radius_km": 300}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data_quality"] == "available"
    assert len(body["features"]) >= 1

    feature = body["features"][0]
    assert feature["source_provider"] == "Natural Earth"
    assert feature["license"]
    assert feature["geometry"]["type"] in {"LineString", "MultiLineString"}

    # Clipped server-side to the query radius — every coordinate should stay
    # roughly within the search circle, not span an entire continent (see
    # GeographicFeatureRepository.find_within_distance_clipped).
    coords = feature["geometry"]["coordinates"]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    assert max(lons) - min(lons) < 10  # a 300km clip is well under 10 degrees wide
    assert max(lats) - min(lats) < 10


@requires_postgres
def test_nearby_features_reports_unavailable_when_nothing_within_a_tiny_radius(client) -> None:
    # An inland point far from any 110m-resolution coastline vertex, with a
    # deliberately tiny radius — real absence of data, not a fabricated one.
    response = client.get(
        "/geographic-features/nearby", params={"latitude": 45.0, "longitude": 90.0, "radius_km": 1}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data_quality"] == "unavailable"
    assert body["features"] == []


@requires_postgres
def test_nearby_features_rejects_an_unbounded_radius(client) -> None:
    response = client.get(
        "/geographic-features/nearby", params={"latitude": 23.81, "longitude": 90.41, "radius_km": 5000}
    )
    assert response.status_code == 422
