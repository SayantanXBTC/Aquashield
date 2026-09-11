"""One-off ingestion entrypoint for the real Natural Earth coastline dataset —
mirrors app/db/seed.py's `python -m` convention, but this is REAL public data,
not synthetic demo data (see docs/development/database.md for the
distinction). Idempotent: re-running it does not duplicate the dataset unless
`--force` is passed.

Run with: python -m app.services.geospatial.ingest_natural_earth
(from backend/, with the venv active and DATABASE_URL pointing at a migrated
database)
"""

from __future__ import annotations

import sys

from app.db.session import SessionLocal
from app.services.geospatial.geospatial_service import GeospatialService
from app.services.geospatial.natural_earth_provider import NaturalEarthCoastlineProvider


def ingest(force: bool = False) -> None:
    with SessionLocal() as session:
        service = GeospatialService(session)
        dataset = service.ingest(NaturalEarthCoastlineProvider(), force=force)
        feature_count = service.features.count_for_dataset(dataset.id)
        print(
            f"Ingested dataset {dataset.id} ({dataset.name!r}) — "
            f"source={dataset.source_url} version={dataset.version} "
            f"features={feature_count} quality={dataset.data_quality.value}"
        )


if __name__ == "__main__":
    ingest(force="--force" in sys.argv)
