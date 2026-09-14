"""One-shot migration of already-fetched town data to the ocean_side
convention (architecture.md ADR-009).

This is NOT a data source. scripts/build_town_data.py is, and it now emits
the unmirrored orientation directly. This script exists because rebuilding
requires Natural Earth and the Overpass API, and the transform is exactly
algebraic: reflecting a mirrored east-facing city about x = 150 and setting
land_sign = -1 reproduces, to floating-point precision, what the builder
would fetch. Re-running the builder with network access must produce the
same file.

    .venv/bin/python scripts/migrate_town_orientation.py chennai
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TOWNS_DIR = REPO_ROOT / "shared" / "constants" / "towns"
WORLD_KM = 300.0

# Cities whose committed data was produced under the old mirror and whose
# real ocean side is east. Keep in step with CITIES in build_town_data.py.
EAST_FACING = {"chennai", "puri", "visakhapatnam"}


def reflect(city_id: str) -> None:
    path = TOWNS_DIR / f"{city_id}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("ocean_side") == "east":
        print(f"{city_id}: already east-facing, nothing to do")
        return

    data["shore_base_x_km"] = round(WORLD_KM - data["shore_base_x_km"], 3)
    data["shore_terms"] = [{**t, "amp": round(-t["amp"], 4)} for t in data["shore_terms"]]
    # rotY is deliberately left untouched: build_town_data.py's only mirroring was
    # `dx_km = -dx_km` inside to_local_km, applied to positions. rot_y is computed
    # separately from the raw lon/lat minimum rotated rectangle
    # (np.arctan2(...) on rect.exterior.coords) and was never mirrored, so the
    # committed values are already true bearings. Reflecting xKm makes the file
    # internally consistent; reflecting rotY too would store the mirror image of
    # every real bearing instead.
    data["buildings"] = [
        {**b, "xKm": round(WORLD_KM - b["xKm"], 3)}
        for b in data["buildings"]
    ]
    data["ocean_side"] = "east"
    data["data_provenance"]["migrated_by"] = "scripts/migrate_town_orientation.py"
    data["data_provenance"]["migration_note"] = (
        "Cross-shore axis un-mirrored to the ocean_side convention; geometry is "
        "the same fetched data reflected about x=150, not a re-fetch."
    )

    # chennai.json (and every other committed town profile) is written by
    # build_town_data.py with json.dumps(..., indent=2) plus a trailing
    # newline. Match that exactly so the diff is content-only.
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"{city_id}: reflected {len(data['buildings'])} buildings, base -> {data['shore_base_x_km']}")


def main() -> None:
    ids = sys.argv[1:] or sorted(EAST_FACING)
    for city_id in ids:
        if city_id not in EAST_FACING:
            print(f"{city_id} is not an east-facing city; nothing to migrate.", file=sys.stderr)
            continue
        if not (TOWNS_DIR / f"{city_id}.json").exists():
            print(f"No committed data for {city_id}; skipping.", file=sys.stderr)
            continue
        reflect(city_id)


if __name__ == "__main__":
    main()
