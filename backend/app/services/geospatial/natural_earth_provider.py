"""Real geospatial provider: Natural Earth's 110m physical coastline dataset.

Fixed, code-configured source — never a user-supplied URL (CLAUDE.md). This
is the "at least one real public geospatial source, genuinely verified"
requirement for Prompt 10: manually verified in this session by downloading
the exact URL below and parsing it with geopandas — 134 LineString features,
already EPSG:4326, ~85KB. See GeospatialService.ingest_natural_earth_coastline
for how the parsed result becomes GeographicDataset/GeographicFeature rows.

Why this source and format: Natural Earth is public domain (no API key, no
usage restriction to document/attribute beyond courtesy), the 110m resolution
is the smallest/coarsest they publish (keeps the ingested row count small for
a prototype), and geopandas + pyogrio (already a transitive dependency of the
pinned geopandas==1.1.4 — verified importable, no new package added) can read
a zipped shapefile directly via a `zip://` path without needing `fiona`,
which is not installed in this environment.
"""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timezone
from typing import Any

import httpx

from app.db.models.enums import GeographicDatasetType, GeospatialDataCoverage
from app.services.geospatial.provider import GeospatialProvider, ProviderDataset, ProviderFeature

NATURAL_EARTH_COASTLINE_URL = (
    "https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_coastline.zip"
)
DATASET_VERSION = "ne_110m_coastline-v5.1.1"  # Natural Earth's own vintage label for this layer
REQUEST_TIMEOUT_SECONDS = 30.0


class NaturalEarthCoastlineProviderError(Exception):
    """Raised when the fixed Natural Earth URL can't be fetched or the
    response can't be parsed as the expected shapefile — never swallowed into
    a fabricated empty dataset."""


class NaturalEarthCoastlineProvider(GeospatialProvider):
    """Downloads and parses Natural Earth's public-domain 110m coastline
    layer. A global-coverage LineString dataset — deliberately not clipped to
    any single country/region, since the architecture must not special-case
    one location (CLAUDE.md §3/this task's non-negotiable rules), and at 134
    features the unclipped dataset is already small enough for this
    prototype's storage/row-count expectations."""

    def fetch_and_parse(self) -> ProviderDataset:
        try:
            response = httpx.get(NATURAL_EARTH_COASTLINE_URL, timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise NaturalEarthCoastlineProviderError(
                f"Could not fetch {NATURAL_EARTH_COASTLINE_URL}: {exc}"
            ) from exc

        try:
            # geopandas/pyogrio can read a shapefile directly out of a zip
            # given a real file path with a zip:// prefix — write the
            # downloaded bytes to a temp file rather than trying to hand it
            # an in-memory buffer (pyogrio's GDAL backend needs a path).
            import tempfile
            from pathlib import Path

            import geopandas as gpd

            with tempfile.TemporaryDirectory() as tmp:
                zip_path = Path(tmp) / "ne_110m_coastline.zip"
                zip_path.write_bytes(response.content)
                # Sanity-check it's actually a zip before handing it to GDAL,
                # so a corrupted/HTML-error download fails loudly here.
                if not zipfile.is_zipfile(zip_path):
                    raise NaturalEarthCoastlineProviderError(
                        f"Response from {NATURAL_EARTH_COASTLINE_URL} was not a zip file"
                    )
                gdf = gpd.read_file(f"zip://{zip_path}")
        except NaturalEarthCoastlineProviderError:
            raise
        except Exception as exc:  # pragma: no cover - defensive, unexpected parse failure
            raise NaturalEarthCoastlineProviderError(f"Failed to parse coastline shapefile: {exc}") from exc

        if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        features: list[ProviderFeature] = []
        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None:
                continue
            properties: dict[str, Any] = {
                col: (None if _is_nan(row[col]) else row[col])
                for col in gdf.columns
                if col != "geometry"
            }
            from shapely.geometry import mapping

            features.append(
                ProviderFeature(
                    feature_type=geom.geom_type,
                    geometry=mapping(geom),
                    properties=properties,
                )
            )

        minx, miny, maxx, maxy = gdf.total_bounds
        return ProviderDataset(
            name="Natural Earth 110m Coastline",
            dataset_type=GeographicDatasetType.COASTLINE,
            source_provider="Natural Earth",
            source_url=NATURAL_EARTH_COASTLINE_URL,
            license="Public Domain (Natural Earth — https://www.naturalearthdata.com/about/terms-of-use/)",
            version=DATASET_VERSION,
            resolution="110m",
            units="degrees",
            coverage=GeospatialDataCoverage.GLOBAL,
            provenance={
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "feature_count": len(features),
                "content_length_bytes": len(response.content),
                "http_status": response.status_code,
                "bounds": {"min_lon": minx, "min_lat": miny, "max_lon": maxx, "max_lat": maxy},
                "attribution": "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.",
            },
            features=features,
        )


def _is_nan(value: Any) -> bool:
    try:
        return value != value  # noqa: PLR0124 - NaN != NaN is the standard float check
    except Exception:
        return False
