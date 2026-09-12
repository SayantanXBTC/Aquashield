from app.db.models.enums import (
    DisasterType,
    RecommendationPriority,
    RecommendationSource,
    RecommendationStatus,
    RiskCategory,
    RiskLevel,
    ScenarioStatus,
    SimulationStatus,
)
from app.db.models.response_recommendation import ResponseRecommendation
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.scenario import Scenario
from app.db.models.scenario_version import ScenarioVersion
from app.db.models.simulation_run import SimulationRun
from tests.conftest import requires_postgres


@requires_postgres
def test_create_scenario(db_session) -> None:
    scenario = Scenario(
owner_uid="test-user", name="Test Flood Scenario",
        disaster_type=DisasterType.FLOOD,
        status=ScenarioStatus.DRAFT,
    )
    db_session.add(scenario)
    db_session.commit()

    fetched = db_session.get(Scenario, scenario.id)
    assert fetched is not None
    assert fetched.disaster_type == DisasterType.FLOOD
    assert fetched.status == ScenarioStatus.DRAFT
    assert fetched.created_at is not None


@requires_postgres
def test_create_scenario_version(db_session) -> None:
    scenario = Scenario(owner_uid="test-user", name="Test Cyclone", disaster_type=DisasterType.CYCLONE, status=ScenarioStatus.DRAFT)
    db_session.add(scenario)
    db_session.flush()

    version = ScenarioVersion(
        scenario_id=scenario.id,
        version_number=1,
        scenario_config={"wind_speed_kt": 90},
    )
    db_session.add(version)
    db_session.commit()

    assert version.id is not None
    assert scenario.versions == [version]
    assert version.scenario_config["wind_speed_kt"] == 90


@requires_postgres
def test_create_simulation_run(db_session) -> None:
    scenario = Scenario(owner_uid="test-user", name="Test Tsunami", disaster_type=DisasterType.TSUNAMI, status=ScenarioStatus.DRAFT)
    db_session.add(scenario)
    db_session.flush()
    version = ScenarioVersion(scenario_id=scenario.id, version_number=1, scenario_config={})
    db_session.add(version)
    db_session.flush()

    run = SimulationRun(scenario_version_id=version.id, status=SimulationStatus.PENDING)
    db_session.add(run)
    db_session.commit()

    assert run.id is not None
    assert run.status == SimulationStatus.PENDING
    assert version.simulation_runs == [run]


@requires_postgres
def test_risk_assessment_relationship(db_session) -> None:
    scenario = Scenario(owner_uid="test-user", name="Test Flood 2", disaster_type=DisasterType.FLOOD, status=ScenarioStatus.DRAFT)
    db_session.add(scenario)
    db_session.flush()
    version = ScenarioVersion(scenario_id=scenario.id, version_number=1, scenario_config={})
    db_session.add(version)
    db_session.flush()
    run = SimulationRun(scenario_version_id=version.id, status=SimulationStatus.COMPLETED)
    db_session.add(run)
    db_session.flush()

    risk = RiskAssessment(
        simulation_run_id=run.id,
        category=RiskCategory.POPULATION,
        level=RiskLevel.HIGH,
        score=0.8,
    )
    db_session.add(risk)
    db_session.commit()

    assert risk in run.risk_assessments
    assert risk.simulation_run is run


@requires_postgres
def test_response_recommendation_relationship(db_session) -> None:
    scenario = Scenario(owner_uid="test-user", name="Test Oil Spill", disaster_type=DisasterType.OIL_SPILL, status=ScenarioStatus.DRAFT)
    db_session.add(scenario)
    db_session.flush()
    version = ScenarioVersion(scenario_id=scenario.id, version_number=1, scenario_config={})
    db_session.add(version)
    db_session.flush()
    run = SimulationRun(scenario_version_id=version.id, status=SimulationStatus.RUNNING)
    db_session.add(run)
    db_session.flush()

    recommendation = ResponseRecommendation(
        simulation_run_id=run.id,
        priority=RecommendationPriority.P0,
        action="Deploy containment boom.",
        source=RecommendationSource.RULE_BASED,
        status=RecommendationStatus.PROPOSED,
    )
    db_session.add(recommendation)
    db_session.commit()

    assert recommendation in run.response_recommendations
    assert recommendation.priority == RecommendationPriority.P0
