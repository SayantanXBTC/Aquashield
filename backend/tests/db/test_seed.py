from app.db.models.infrastructure_asset import InfrastructureAsset
from app.db.models.scenario import Scenario
from app.db.seed import seed
from tests.conftest import requires_postgres

pytestmark = requires_postgres


def test_seed_creates_reference_assets_and_no_scenarios(db_session) -> None:
    before = db_session.query(Scenario).count()
    seed(db_session)
    assets = db_session.query(InfrastructureAsset).filter(InfrastructureAsset.name == "Demo General Hospital").all()
    assert len(assets) == 1
    # Scenarios are user-owned (Prompt 12) — the seed never creates any.
    assert db_session.query(Scenario).count() == before


def test_seed_is_idempotent(db_session) -> None:
    seed(db_session)
    seed(db_session)
    names = [a.name for a in db_session.query(InfrastructureAsset).all()]
    assert len(names) == len(set(names))
