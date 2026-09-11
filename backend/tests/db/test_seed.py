from app.db.models.infrastructure_asset import InfrastructureAsset
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.scenario import Scenario
from app.db.seed import seed
from tests.conftest import requires_postgres


@requires_postgres
def test_seed_creates_expected_demo_rows(db_session) -> None:
    seed(db_session, force=True)

    scenarios = db_session.query(Scenario).filter(Scenario.created_by == "seed:dev-demo").all()
    assert len(scenarios) >= 3
    assert {"flood", "tsunami", "oil_spill"} <= {s.disaster_type.value for s in scenarios}

    assets = db_session.query(InfrastructureAsset).all()
    assert len(assets) >= 3

    risks = db_session.query(RiskAssessment).all()
    assert len(risks) >= 2
