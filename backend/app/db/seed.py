"""Development/demo seed data — NOT real operational data.

Coordinates and risk values below are synthetic and picked for variety
across disaster types; they are not real predictions for any location.
See CLAUDE.md §7 (Do Not Overpromise Scientific Accuracy).

Run with: python -m app.db.seed   (from backend/, with the venv active and
DATABASE_URL pointing at a migrated database)
"""

from datetime import datetime, timedelta, timezone

from geoalchemy2.shape import from_shape
from shapely.geometry import LineString, Point, Polygon
from sqlalchemy.orm import Session

from app.db.models.enums import (
    AssetCriticality,
    AssetType,
    DisasterType,
    RecommendationPriority,
    RecommendationSource,
    RecommendationStatus,
    RiskCategory,
    RiskLevel,
    ScenarioStatus,
    SimulationStatus,
)
from app.db.models.infrastructure_asset import InfrastructureAsset
from app.db.models.response_recommendation import ResponseRecommendation
from app.db.models.risk_assessment import RiskAssessment
from app.db.models.scenario import Scenario
from app.db.models.scenario_version import ScenarioVersion
from app.db.models.simulation_run import SimulationRun
from app.db.session import SessionLocal


def seed(session: Session, force: bool = False) -> None:
    if not force and session.query(Scenario).count() > 0:
        print("Seed data already present (Scenario rows exist) — skipping. Pass force=True to seed anyway.")
        return

    # --- Infrastructure assets (demo data — synthetic locations) ---
    hospital = InfrastructureAsset(
        name="Demo General Hospital",
        asset_type=AssetType.HOSPITAL,
        criticality=AssetCriticality.CRITICAL,
        geometry=from_shape(Point(90.4125, 23.8103), srid=4326),  # near Dhaka, demo only
        extra_metadata={"beds": 250, "demo_data": True},
    )
    coastal_road = InfrastructureAsset(
        name="Demo Coastal Highway",
        asset_type=AssetType.ROAD,
        criticality=AssetCriticality.HIGH,
        geometry=from_shape(
            LineString([(90.35, 22.30), (90.40, 22.35), (90.45, 22.40)]), srid=4326
        ),
        extra_metadata={"lanes": 4, "demo_data": True},
    )
    shelter_zone = InfrastructureAsset(
        name="Demo Emergency Shelter",
        asset_type=AssetType.SHELTER,
        criticality=AssetCriticality.MEDIUM,
        geometry=from_shape(
            Polygon([(90.10, 23.00), (90.12, 23.00), (90.12, 23.02), (90.10, 23.02)]),
            srid=4326,
        ),
        extra_metadata={"capacity": 500, "demo_data": True},
    )
    session.add_all([hospital, coastal_road, shelter_zone])
    session.flush()

    # --- Scenario 1: Flood ---
    flood_scenario = Scenario(
        name="Demo Monsoon Flood — Ganges Delta",
        description="Synthetic demo scenario for development only.",
        disaster_type=DisasterType.FLOOD,
        location_name="Ganges-Brahmaputra Delta (demo)",
        location=from_shape(Point(90.40, 23.00), srid=4326),
        status=ScenarioStatus.ACTIVE,
        created_by="seed:dev-demo",
    )
    session.add(flood_scenario)
    session.flush()

    flood_version = ScenarioVersion(
        scenario_id=flood_scenario.id,
        version_number=1,
        label="Baseline",
        scenario_config={
            "rainfall_mm_24h": 180,
            "river_level_m": 6.2,
            "water_rise_rate_m_per_hr": 0.15,
            "drainage_capacity_pct": 40,
        },
        notes="Synthetic baseline configuration for demo purposes.",
    )
    session.add(flood_version)
    session.flush()

    flood_run = SimulationRun(
        scenario_version_id=flood_version.id,
        status=SimulationStatus.COMPLETED,
        started_at=datetime.now(timezone.utc) - timedelta(hours=2),
        completed_at=datetime.now(timezone.utc) - timedelta(hours=1),
        duration_seconds=3600,
        timestep_config={"resolution_minutes": 15, "horizon_hours": 24},
        model_identifier="demo-placeholder-v0",
    )
    session.add(flood_run)
    session.flush()

    session.add(
        RiskAssessment(
            simulation_run_id=flood_run.id,
            category=RiskCategory.POPULATION,
            level=RiskLevel.HIGH,
            score=0.72,
            explanation="Demo risk output — not a validated prediction.",
            timestep=48,
            extra_metadata={"demo_data": True},
        )
    )
    session.add(
        ResponseRecommendation(
            simulation_run_id=flood_run.id,
            priority=RecommendationPriority.P1,
            action="Pre-position evacuation transport near Demo Emergency Shelter.",
            rationale="Demo recommendation based on synthetic risk output.",
            responsible_role="Local emergency management (demo)",
            source=RecommendationSource.SIMULATION_ANALYSIS,
            status=RecommendationStatus.PROPOSED,
        )
    )

    # --- Scenario 2: Tsunami ---
    tsunami_scenario = Scenario(
        name="Demo Tsunami — Bay of Bengal",
        description="Synthetic demo scenario for development only.",
        disaster_type=DisasterType.TSUNAMI,
        location_name="Bay of Bengal (demo)",
        location=from_shape(Point(88.50, 14.00), srid=4326),
        status=ScenarioStatus.DRAFT,
        created_by="seed:dev-demo",
    )
    session.add(tsunami_scenario)
    session.flush()

    tsunami_version = ScenarioVersion(
        scenario_id=tsunami_scenario.id,
        version_number=1,
        label="Baseline",
        scenario_config={
            "source_location": {"lat": 14.0, "lon": 88.5},
            "magnitude": 7.8,
            "initial_wave_height_m": 3.5,
            "propagation_direction_deg": 45,
        },
    )
    session.add(tsunami_version)
    session.flush()

    session.add(
        SimulationRun(
            scenario_version_id=tsunami_version.id,
            status=SimulationStatus.PENDING,
            timestep_config={"resolution_minutes": 5, "horizon_hours": 6},
        )
    )

    # --- Scenario 3: Oil spill ---
    spill_scenario = Scenario(
        name="Demo Oil Spill — Arabian Sea",
        description="Synthetic demo scenario for development only.",
        disaster_type=DisasterType.OIL_SPILL,
        location_name="Arabian Sea (demo)",
        location=from_shape(Point(65.00, 20.00), srid=4326),
        status=ScenarioStatus.ACTIVE,
        created_by="seed:dev-demo",
    )
    session.add(spill_scenario)
    session.flush()

    spill_version = ScenarioVersion(
        scenario_id=spill_scenario.id,
        version_number=1,
        label="Baseline",
        scenario_config={
            "spill_volume_tonnes": 500,
            "oil_type": "crude",
            "wind_speed_kt": 12,
            "wind_direction_deg": 200,
            "current_speed_kt": 1.5,
        },
    )
    session.add(spill_version)
    session.flush()

    spill_run = SimulationRun(
        scenario_version_id=spill_version.id,
        status=SimulationStatus.RUNNING,
        started_at=datetime.now(timezone.utc) - timedelta(minutes=20),
        timestep_config={"resolution_minutes": 30, "horizon_hours": 48},
    )
    session.add(spill_run)
    session.flush()

    session.add(
        RiskAssessment(
            simulation_run_id=spill_run.id,
            category=RiskCategory.ENVIRONMENTAL,
            level=RiskLevel.CRITICAL,
            score=0.88,
            explanation="Demo risk output — not a validated prediction.",
            timestep=4,
            extra_metadata={"demo_data": True},
        )
    )

    session.commit()
    print("Seeded: 3 scenarios, 3 versions, 3 simulation runs, 3 infrastructure assets, "
          "2 risk assessments, 1 recommendation.")


if __name__ == "__main__":
    with SessionLocal() as db_session:
        seed(db_session)
