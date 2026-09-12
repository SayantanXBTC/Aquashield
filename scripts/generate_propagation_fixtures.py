"""Regenerates shared/fixtures/propagation_cases.json from the Python
propagation core + the four demo models. The frontend mirror test
(frontend/src/propagation/mirror.test.ts) replays these cases through the
TypeScript port and asserts equality within 1e-6 km, so the client-side
live preview can never silently diverge from what the backend records.

Run from the repo root after any change to simulation/core/propagation.py
or a model's formulas:

    .venv/bin/python scripts/generate_propagation_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from simulation.core.propagation import (  # noqa: E402
    PropagationParams,
    distance_to_coast_along_heading,
    front_state,
    nearest_shore_distance,
    shore_x,
)
from simulation.core.registry import get_model_class  # noqa: E402
from simulation.core.time import SimulationClock  # noqa: E402
from datetime import datetime, timezone  # noqa: E402
from random import Random  # noqa: E402

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


def main() -> None:
    cases: dict = {
        "shore_x": [{"y": y, "x": shore_x(y)} for y in SHORE_SAMPLES],
        "distance_to_coast": [
            {"x": x, "y": y, "heading": h, "distance": distance_to_coast_along_heading(x, y, h)}
            for x, y, h in COAST_CASES
        ],
        "nearest_shore": [{"x": x, "y": y, "distance": nearest_shore_distance(x, y)} for x, y, _ in COAST_CASES],
        "front_state": [],
        "models": [],
    }
    for raw in PARAM_SETS:
        params = PropagationParams.from_config(raw, default_speed_kmh=1, default_spread_radius_km=1)
        for stop in (True, False):
            for t in TIMES_MIN:
                fs = front_state(params, t, stop_at_coast=stop)
                cases["front_state"].append(
                    {
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
        for raw in PARAM_SETS:
            config = {**raw, "structures": STRUCTURES}
            model = model_cls(config=config, clock=clock, location=None, rng=Random(0))
            model.initialize()
            frames = []
            for t in TIMES_MIN:
                step = t // 5
                _, hazard, _ = model.get_state(step)
                impacts = model.get_infrastructure_impacts(step)
                frames.append({"elapsed_minutes": t, "hazard_state": hazard, "infrastructure_impacts": impacts})
            cases["models"].append({"disaster_type": disaster_type, "params": raw, "structures": STRUCTURES, "frames": frames})

    out = REPO_ROOT / "shared" / "fixtures" / "propagation_cases.json"
    out.write_text(json.dumps(cases, indent=1) + "\n")
    print(f"wrote {out} ({len(cases['front_state'])} front cases, {len(cases['models'])} model cases)")


if __name__ == "__main__":
    main()
