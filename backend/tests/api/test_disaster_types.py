from app.db.models.enums import DisasterType
from simulation.core.registry import get_model_class
from tests.conftest import requires_postgres

ALL_DISASTER_TYPES = [dt.value for dt in DisasterType]


@requires_postgres
def test_list_disaster_types_returns_all_nine(client) -> None:
    response = client.get("/disaster-types")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 9
    assert {entry["disaster_type"] for entry in body} == set(ALL_DISASTER_TYPES)


@requires_postgres
def test_disaster_type_entries_report_real_resolved_model_identifier(client) -> None:
    response = client.get("/disaster-types")
    by_type = {entry["disaster_type"]: entry for entry in response.json()}

    for disaster_type in ALL_DISASTER_TYPES:
        expected_model_id = get_model_class(disaster_type).model_identifier
        assert by_type[disaster_type]["model_identifier"] == expected_model_id

    # The aliasing cases explicitly, so a fabricated per-type model id
    # (e.g. "storm-surge-demo-v1") would be caught even if the generic loop
    # above had a typo.
    assert by_type["storm_surge"]["model_identifier"] == "cyclone-demo-v2"
    assert by_type["chemical_pollution"]["model_identifier"] == "oil-spill-demo-v2"
    assert by_type["flash_flood"]["model_identifier"] == "coastal-flood-demo-v2"
    assert by_type["coastal_flood"]["model_identifier"] == "coastal-flood-demo-v2"


@requires_postgres
def test_disaster_type_entries_have_non_empty_display_metadata(client) -> None:
    response = client.get("/disaster-types")
    for entry in response.json():
        assert entry["display_name"]
        assert entry["short_description"]
        assert entry["category"]
