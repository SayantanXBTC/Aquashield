"""Development/demo seed data — NOT real operational data.

Prompt 12: scenarios are no longer seeded. Every scenario belongs to a
signed-in Firebase user (`scenarios.owner_uid`, app/core/auth.py) and is
created in the Command Center from a generic preset — a seeded, un-owned
scenario would be invisible to everyone and would reintroduce the
real-world place names the product deliberately dropped. Only the
reference infrastructure assets used by the (optional) exposure endpoints
remain; their coordinates are synthetic demo values.

Run with: python -m app.db.seed   (from backend/, with the venv active and
DATABASE_URL pointing at a migrated database)
"""

from geoalchemy2.shape import from_shape
from shapely.geometry import LineString, Point, Polygon
from sqlalchemy.orm import Session

from app.db.models.enums import AssetCriticality, AssetType
from app.db.models.infrastructure_asset import InfrastructureAsset
from app.db.session import SessionLocal


def seed(session: Session, force: bool = False) -> None:
    """Idempotent: the asset block checks for its own marker row before
    inserting. `force` is kept for backward compatibility with existing
    callers; it no longer gates anything."""
    del force

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

    session.commit()
    print("Seed complete: reference infrastructure assets ensured (no scenarios are seeded — they are user-owned).")


if __name__ == "__main__":
    with SessionLocal() as db_session:
        seed(db_session)
