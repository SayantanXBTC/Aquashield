"""Development/demo seed data — NOT real operational data.

Coordinates and risk values below are synthetic and picked for variety
across disaster types; they are not real predictions for any location.
See CLAUDE.md §7 (Do Not Overpromise Scientific Accuracy).

Idempotent per-scenario: `_ensure_scenario` looks a scenario up by its
(distinctive, demo-labeled) `name` before inserting it, so `seed()` can be
re-run safely against an already-partially-seeded database — it backfills
exactly the scenarios that are missing without duplicating ones that already
exist and without requiring a destructive full reseed. `scenario_config`
values are chosen to actually be read by that disaster type's underlying
simulation model (see docs/development/scenarios.md's parameter-consumption
table) — never a decorative field the model ignores.

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


def _ensure_scenario(
    session: Session,
    *,
    name: str,
    description: str,
    disaster_type: DisasterType,
    location_name: str,
    latitude: float,
    longitude: float,
    status: ScenarioStatus,
    scenario_config: dict,
    version_label: str = "Baseline",
) -> tuple[Scenario, ScenarioVersion, bool]:
    """Look up a demo scenario by name; create it (+ its version 1) only if
    it doesn't already exist. Returns (scenario, current_version, created)."""
    existing = session.query(Scenario).filter(Scenario.name == name).one_or_none()
    if existing is not None:
        version = (
            session.query(ScenarioVersion)
            .filter(ScenarioVersion.scenario_id == existing.id)
            .order_by(ScenarioVersion.version_number.desc())
            .first()
        )
        return existing, version, False

    scenario = Scenario(
        name=name,
        description=description,
        disaster_type=disaster_type,
        location_name=location_name,
        location=from_shape(Point(longitude, latitude), srid=4326),
        status=status,
        created_by="seed:dev-demo",
    )
    session.add(scenario)
    session.flush()

    version = ScenarioVersion(
        scenario_id=scenario.id,
        version_number=1,
        label=version_label,
        scenario_config=scenario_config,
    )
    session.add(version)
    session.flush()
    return scenario, version, True


def seed(session: Session, force: bool = False) -> None:
    """Idempotent: safe to call repeatedly (including against a database that
    already has some, but not all, of the demo rows below). `force` is kept
    for backward compatibility with existing callers/tests; per-scenario
    idempotency (via `_ensure_scenario`) makes the old "skip entirely if any
    Scenario exists" guard unnecessary, so it no longer gates anything."""
    del force  # no longer changes behavior — see docstring

    created_count = 0

    # --- Infrastructure assets (demo data — synthetic locations) ---
    if session.query(InfrastructureAsset).filter(InfrastructureAsset.name == "Demo General Hospital").count() == 0:
        session.add_all(
            [
                InfrastructureAsset(
                    name="Demo General Hospital",
                    asset_type=AssetType.HOSPITAL,
                    criticality=AssetCriticality.CRITICAL,
                    geometry=from_shape(Point(90.4125, 23.8103), srid=4326),  # near Dhaka, demo only
                    extra_metadata={"beds": 250, "demo_data": True},
                ),
                InfrastructureAsset(
                    name="Demo Coastal Highway",
                    asset_type=AssetType.ROAD,
                    criticality=AssetCriticality.HIGH,
                    geometry=from_shape(
                        LineString([(90.35, 22.30), (90.40, 22.35), (90.45, 22.40)]), srid=4326
                    ),
                    extra_metadata={"lanes": 4, "demo_data": True},
                ),
                InfrastructureAsset(
                    name="Demo Emergency Shelter",
                    asset_type=AssetType.SHELTER,
                    criticality=AssetCriticality.MEDIUM,
                    geometry=from_shape(
                        Polygon([(90.10, 23.00), (90.12, 23.00), (90.12, 23.02), (90.10, 23.02)]),
                        srid=4326,
                    ),
                    extra_metadata={"capacity": 500, "demo_data": True},
                ),
            ]
        )
        session.flush()

    # --- Scenario 1: Flood ---
    flood_scenario, flood_version, flood_created = _ensure_scenario(
        session,
        name="Demo Monsoon Flood — Ganges Delta",
        description="Synthetic demo scenario for development only.",
        disaster_type=DisasterType.FLOOD,
        location_name="Ganges-Brahmaputra Delta (demo)",
        latitude=23.00,
        longitude=90.40,
        status=ScenarioStatus.READY,
        scenario_config={
            "rainfall_mm_24h": 180,
            "river_level_m": 6.2,
            "water_rise_rate_m_per_hr": 0.15,
            "drainage_capacity_pct": 40,
        },
    )
    if flood_created:
        created_count += 1
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

    # --- Scenario 2: Tsunami (DRAFT) — deliberately left in draft status to
    # demonstrate that the Command Center's scenario selector (status=ready
    # filter) correctly excludes an in-progress scenario. See
    # docs/development/command-center.md. ---
    tsunami_scenario, tsunami_version, tsunami_created = _ensure_scenario(
        session,
        name="Demo Tsunami — Bay of Bengal",
        description="Synthetic demo scenario for development only.",
        disaster_type=DisasterType.TSUNAMI,
        location_name="Bay of Bengal (demo)",
        latitude=14.00,
        longitude=88.50,
        status=ScenarioStatus.DRAFT,
        scenario_config={
            "source_latitude": 14.0,
            "source_longitude": 88.5,
            "magnitude": 7.8,
            "initial_wave_height_m": 3.5,
            "propagation_direction_deg": 45,
        },
    )
    if tsunami_created:
        created_count += 1
        session.add(
            SimulationRun(
                scenario_version_id=tsunami_version.id,
                status=SimulationStatus.PENDING,
                timestep_config={"resolution_minutes": 5, "horizon_hours": 6},
            )
        )

    # --- Scenario 3: Oil spill ---
    spill_scenario, spill_version, spill_created = _ensure_scenario(
        session,
        name="Demo Oil Spill — Arabian Sea",
        description="Synthetic demo scenario for development only.",
        disaster_type=DisasterType.OIL_SPILL,
        location_name="Arabian Sea (demo)",
        latitude=20.00,
        longitude=65.00,
        status=ScenarioStatus.READY,
        scenario_config={
            "spill_volume_tonnes": 500,
            "oil_type": "crude",
            "wind_speed_kt": 12,
            "wind_direction_deg": 200,
            "current_speed_kt": 1.5,
        },
    )
    if spill_created:
        created_count += 1
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

    # --- Scenarios 4-10: one READY demo scenario per remaining disaster type
    # (Prompt 9.1 §A) so every DisasterType has at least one row visible in
    # the Command Center's status=ready scenario selector. A second, READY
    # tsunami scenario is added alongside the original DRAFT one above (kept
    # unchanged, on purpose) so tsunami is also represented. ---
    additional_scenarios = [
        dict(
            name="Demo Flash Flood — Uttarakhand Hill Streams",
            description="Synthetic demo scenario for development only.",
            disaster_type=DisasterType.FLASH_FLOOD,
            location_name="Uttarakhand hill streams (demo)",
            latitude=30.0668,
            longitude=79.0193,
            status=ScenarioStatus.READY,
            scenario_config={
                "rainfall_mm_24h": 220,
                "river_level_m": 2.5,
                "water_rise_rate_m_per_hr": 0.6,
                "drainage_capacity_pct": 15,
            },
        ),
        dict(
            name="Demo Coastal Flood — Sundarbans Fringe",
            description="Synthetic demo scenario for development only.",
            disaster_type=DisasterType.COASTAL_FLOOD,
            location_name="Sundarbans fringe (demo)",
            latitude=21.9497,
            longitude=89.1833,
            status=ScenarioStatus.READY,
            scenario_config={
                "rainfall_mm_24h": 90,
                "river_level_m": 4.0,
                "water_rise_rate_m_per_hr": 0.2,
                "drainage_capacity_pct": 25,
            },
        ),
        dict(
            name="Demo Storm Surge — Odisha Coast",
            description="Synthetic demo scenario for development only.",
            disaster_type=DisasterType.STORM_SURGE,
            location_name="Odisha coast (demo)",
            latitude=19.80,
            longitude=85.80,
            status=ScenarioStatus.READY,
            scenario_config={
                "central_pressure_hpa": 955,
                "wind_speed_kt": 85,
                "radius_km": 120,
            },
        ),
        dict(
            name="Demo Cyclone — Bay of Bengal Track",
            description="Synthetic demo scenario for development only.",
            disaster_type=DisasterType.CYCLONE,
            location_name="Bay of Bengal (demo)",
            latitude=15.50,
            longitude=87.00,
            status=ScenarioStatus.READY,
            scenario_config={
                "central_pressure_hpa": 930,
                "wind_speed_kt": 110,
                "radius_km": 150,
            },
        ),
        dict(
            name="Demo Chemical Pollution — Gulf of Kutch",
            description="Synthetic demo scenario for development only. "
            "'oil_type' is a generic category label, not real chemical handling detail.",
            disaster_type=DisasterType.CHEMICAL_POLLUTION,
            location_name="Gulf of Kutch (demo)",
            latitude=22.45,
            longitude=69.05,
            status=ScenarioStatus.READY,
            scenario_config={
                "spill_volume_tonnes": 300,
                "oil_type": "industrial_effluent",
                "wind_speed_kt": 8,
                "wind_direction_deg": 140,
                "current_speed_kt": 1.0,
                "current_direction_deg": 160,
            },
        ),
        dict(
            name="Demo Search & Rescue — Andaman Sea",
            description="Synthetic demo scenario for development only.",
            disaster_type=DisasterType.SEARCH_RESCUE,
            location_name="Andaman Sea (demo)",
            latitude=11.00,
            longitude=92.50,
            status=ScenarioStatus.READY,
            scenario_config={
                "incident_location": {"latitude": 11.0, "longitude": 92.5},
                "vessel_type": "fishing_trawler",
                "drift_conditions": {
                    "current_speed_kt": 1.2,
                    "current_direction_deg": 200,
                    "wind_speed_kt": 14,
                    "wind_direction_deg": 210,
                },
                "search_radius_km": 6,
            },
        ),
        dict(
            name="Demo Tsunami — Sulawesi Strait (Ready)",
            description=(
                "Synthetic demo scenario for development only. A second, READY "
                "tsunami scenario alongside the original DRAFT one, so the "
                "disaster type is also represented in the Command Center."
            ),
            disaster_type=DisasterType.TSUNAMI,
            location_name="Sulawesi Strait (demo)",
            latitude=-0.50,
            longitude=119.00,
            status=ScenarioStatus.READY,
            scenario_config={
                "source_latitude": -0.5,
                "source_longitude": 119.0,
                "magnitude": 7.5,
                "initial_wave_height_m": 2.8,
                "propagation_direction_deg": 90,
            },
        ),
    ]

    for spec in additional_scenarios:
        _, _, created = _ensure_scenario(session, **spec)
        if created:
            created_count += 1

    session.commit()
    print(
        f"Seed complete: {created_count} new scenario(s) created this run "
        "(existing demo scenarios were left untouched)."
    )


if __name__ == "__main__":
    with SessionLocal() as db_session:
        seed(db_session)
