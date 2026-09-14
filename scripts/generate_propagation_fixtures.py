"""Regenerates shared/fixtures/propagation_cases.json from the Python
propagation core + the four demo models. The frontend mirror test
(frontend/src/propagation/mirror.test.ts) replays these cases through the
TypeScript port and asserts equality within 1e-6 km, so the client-side
live preview can never silently diverge from what the backend records.

Every case is generated twice: once for the existing west-facing demo
shoreline (`DEFAULT_SHORE`, land east of the curve) and once for a synthetic
east-facing mirror (`EAST_FACING_SHORE`, land west of the curve), so a sign
error in `land_sign`/`landSign` cannot hide behind a single orientation.
Overriding `model.params.shore` after `model.initialize()` (see `main()`
below) is fixture-generation-only: production always uses the single
fictional demo shoreline — this script just needs a second, deliberately
different shore to exercise both signs.

Run from the repo root after any change to simulation/core/propagation.py
or a model's formulas:

    .venv/bin/python scripts/generate_propagation_fixtures.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace  # noqa: E402
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from simulation.core.propagation import (  # noqa: E402
    DEFAULT_SHORE,
    PropagationParams,
    ShoreParams,
    distance_to_coast_along_heading,
    front_state,
    nearest_shore_distance,
    shore_x,
)
from simulation.core.registry import get_model_class  # noqa: E402
from simulation.core.time import SimulationClock  # noqa: E402
from datetime import datetime, timezone  # noqa: E402
from random import Random  # noqa: E402

# A synthetic east-facing coast: the demo shoreline reflected about x = 150,
# with land to the west. Fixture geometry only — not a place.
EAST_FACING_SHORE = ShoreParams(
    base_x_km=300.0 - DEFAULT_SHORE.base_x_km,
    terms=tuple((-amp, freq, phase) for amp, freq, phase in DEFAULT_SHORE.terms),
    land_sign=-1.0,
)
SHORES = [("west", DEFAULT_SHORE), ("east", EAST_FACING_SHORE)]


def shore_to_json(shore: ShoreParams) -> dict:
    return {
        "base_x_km": shore.base_x_km,
        "terms": [{"amp": a, "freq": f, "phase": p} for a, f, p in shore.terms],
        "land_sign": shore.land_sign,
    }


SHORE_SAMPLES = [0.0, 25.0, 61.5, 100.0, 150.0, 199.9, 250.0, 300.0]
COAST_CASES = [
    (70.0, 150.0, 90.0),
    (40.0, 40.0, 45.0),
    (120.0, 260.0, 135.0),
    (20.0, 150.0, 0.0),
    (150.0, 120.0, 80.0),
    (250.0, 150.0, 90.0),
]
PARAM_SETS = [
    {"origin_x_km": 70, "origin_y_km": 150, "heading_deg": 90, "speed_kmh": 400, "intensity": 0.6, "spread_radius_km": 12, "dispersion_rate": 0.3},
    {"origin_x_km": 40, "origin_y_km": 60, "heading_deg": 60, "speed_kmh": 25, "intensity": 0.9, "spread_radius_km": 80, "dispersion_rate": 0.5},
    {"origin_x_km": 110, "origin_y_km": 220, "heading_deg": 120, "speed_kmh": 3, "intensity": 0.4, "spread_radius_km": 18, "dispersion_rate": 0.7},
    {"origin_x_km": 30, "origin_y_km": 150, "heading_deg": 270, "speed_kmh": 40, "intensity": 0.5, "spread_radius_km": 10, "dispersion_rate": 0.2},
]
TIMES_MIN = [0, 5, 15, 30, 60, 120, 240, 360]
MODELS = ["tsunami", "cyclone", "oil_spill", "coastal_flood"]
# User-placed structures: a port on the shore, a town just inland, a
# hospital far inland, a lighthouse on the coast to the north, a disabled one.
STRUCTURES = [
    {"id": "port", "type": "port", "name": "Port", "x_km": 192.0, "y_km": 150.0, "enabled": True},
    {"id": "town", "type": "building", "name": "Town", "x_km": 197.0, "y_km": 152.0, "enabled": True},
    {"id": "hosp", "type": "hospital", "name": "Hospital", "x_km": 240.0, "y_km": 120.0, "enabled": True},
    {"id": "light", "type": "lighthouse", "name": "Light", "x_km": 186.0, "y_km": 190.0, "enabled": True},
    {"id": "off", "type": "fuel_terminal", "name": "Off", "x_km": 190.0, "y_km": 150.0, "enabled": False},
]


def reflect_case(x: float, y: float, heading: float) -> tuple[float, float, float]:
    """Mirror a west-facing case about x = 150. A heading reflects as
    (360 - heading) % 360, because reflection negates the east component."""
    return 300.0 - x, y, (360.0 - heading) % 360.0


def reflect_params(raw: dict) -> dict:
    out = dict(raw)
    out["origin_x_km"] = 300.0 - raw["origin_x_km"]
    out["heading_deg"] = (360.0 - raw["heading_deg"]) % 360.0
    return out


def reflect_structures(structures: list[dict]) -> list[dict]:
    return [{**s, "x_km": 300.0 - s["x_km"]} for s in structures]


def main() -> None:
    cases: dict = {"shore_x": [], "distance_to_coast": [], "nearest_shore": [], "front_state": [], "models": []}

    for label, shore in SHORES:
        sj = shore_to_json(shore)
        coast_cases = COAST_CASES if label == "west" else [reflect_case(*c) for c in COAST_CASES]
        param_sets = PARAM_SETS if label == "west" else [reflect_params(p) for p in PARAM_SETS]
        structures = STRUCTURES if label == "west" else reflect_structures(STRUCTURES)

        cases["shore_x"] += [{"shore": sj, "y": y, "x": shore_x(y, shore)} for y in SHORE_SAMPLES]
        cases["distance_to_coast"] += [
            {"shore": sj, "x": x, "y": y, "heading": h, "distance": distance_to_coast_along_heading(x, y, h, shore)}
            for x, y, h in coast_cases
        ]
        cases["nearest_shore"] += [
            {"shore": sj, "x": x, "y": y, "distance": nearest_shore_distance(x, y, shore)} for x, y, _ in coast_cases
        ]

        for raw in param_sets:
            params = PropagationParams.from_config(raw, default_speed_kmh=1, default_spread_radius_km=1)
            params = replace(params, shore=shore)
            for stop in (True, False):
                for t in TIMES_MIN:
                    fs = front_state(params, t, stop_at_coast=stop)
                    cases["front_state"].append(
                        {
                            "shore": sj,
                            "params": raw,
                            "stop_at_coast": stop,
                            "elapsed_minutes": t,
                            "result": {
                                "traveled_km": fs.traveled_km,
                                "position_x_km": fs.position_x_km,
                                "position_y_km": fs.position_y_km,
                                "coast_distance_total_km": fs.coast_distance_total_km,
                                "distance_to_coast_km": fs.distance_to_coast_km,
                                "arrival_progress": fs.arrival_progress,
                                "arrived": fs.arrived,
                                "eta_minutes": fs.eta_minutes,
                                "minutes_since_arrival": fs.minutes_since_arrival,
                            },
                        }
                    )

        clock = SimulationClock(
            start_time=datetime(2026, 1, 1, tzinfo=timezone.utc), duration_minutes=360, timestep_minutes=5
        )
        for disaster_type in MODELS:
            model_cls = get_model_class(disaster_type)
            for raw in param_sets:
                config = {**raw, "structures": structures}
                model = model_cls(config=config, clock=clock, location=None, rng=Random(0))
                model.initialize()  # sets self.params; the override must follow it
                model.params = replace(model.params, shore=shore)
                frames = []
                for t in TIMES_MIN:
                    step = t // 5
                    _, hazard, _ = model.get_state(step)
                    impacts = model.get_infrastructure_impacts(step)
                    frames.append({"elapsed_minutes": t, "hazard_state": hazard, "infrastructure_impacts": impacts})
                cases["models"].append(
                    {"shore": sj, "disaster_type": disaster_type, "params": raw, "structures": structures, "frames": frames}
                )

    out = REPO_ROOT / "shared" / "fixtures" / "propagation_cases.json"
    out.write_text(json.dumps(cases, indent=1) + "\n")
    print(f"wrote {out} ({len(cases['front_state'])} front cases, {len(cases['models'])} model cases)")


if __name__ == "__main__":
    main()
