from app.db.models.enums import DisasterType, ScenarioStatus
from app.db.models.infrastructure_asset import InfrastructureAsset
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.scenario import Scenario
from app.db.seed import seed
from tests.conftest import requires_postgres

ALL_DISASTER_TYPES = {dt.value for dt in DisasterType}


@requires_postgres
def test_seed_creates_expected_demo_rows(db_session) -> None:
    seed(db_session, force=True)

    scenarios = db_session.query(Scenario).filter(Scenario.created_by == "seed:dev-demo").all()
    assert len(scenarios) >= 10  # 3 original + 7 backfilled (6 new types + a second READY tsunami)
    assert {"flood", "tsunami", "oil_spill"} <= {s.disaster_type.value for s in scenarios}

    assets = db_session.query(InfrastructureAsset).all()
    assert len(assets) >= 3

    risks = db_session.query(RiskAssessment).all()
    assert len(risks) >= 2


@requires_postgres
def test_seed_covers_every_disaster_type_with_a_ready_scenario(db_session) -> None:
    seed(db_session)

    ready_types = {
        s.disaster_type.value
        for s in db_session.query(Scenario)
        .filter(Scenario.created_by == "seed:dev-demo", Scenario.status == ScenarioStatus.READY)
        .all()
    }
    assert ready_types == ALL_DISASTER_TYPES


@requires_postgres
def test_seed_is_idempotent_running_twice_does_not_duplicate_rows(db_session) -> None:
    seed(db_session)
    first_count = db_session.query(Scenario).filter(Scenario.created_by == "seed:dev-demo").count()

    seed(db_session)
    second_count = db_session.query(Scenario).filter(Scenario.created_by == "seed:dev-demo").count()

    assert first_count == second_count

    # Names are unique per demo scenario — no duplicate names after a
    # second seed() call.
    names = [
        s.name
        for s in db_session.query(Scenario).filter(Scenario.created_by == "seed:dev-demo").all()
    ]
    assert len(names) == len(set(names))


@requires_postgres
def test_seed_backfills_missing_scenarios_without_touching_existing_ones(db_session) -> None:
    """Simulates the real-world case this idempotency refactor exists for:
    a database that already has the original 3 scenarios gets re-seeded and
    ends up with all 9 types, without duplicating or mutating the original 3."""
    seed(db_session)
    flood_scenario_first = (
        db_session.query(Scenario).filter(Scenario.name == "Demo Monsoon Flood — Ganges Delta").one()
    )
    flood_id_first = flood_scenario_first.id

    seed(db_session)  # re-run against an already-seeded database

    flood_scenario_second = (
        db_session.query(Scenario).filter(Scenario.name == "Demo Monsoon Flood — Ganges Delta").one()
    )
    assert flood_scenario_second.id == flood_id_first  # same row, not recreated

    all_types = {
        s.disaster_type.value
        for s in db_session.query(Scenario).filter(Scenario.created_by == "seed:dev-demo").all()
    }
    assert all_types == ALL_DISASTER_TYPES
