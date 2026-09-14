# Simulation Engine — AQUASHIELD

## Prompt 12 — Demo shoreline world (2026-09-12)

> Current behaviour for tsunami / cyclone / oil_spill / flood (+ their reuse aliases). `search_rescue` keeps
> its v1 model. Sections below describe the engine, which is unchanged.

`simulation/core/propagation.py` defines the one world every v2 demo model runs in: a 300 km square,
ocean west of `shore_x(y)` (base 196 km + three sine terms, constants in `shared/constants/demo_world.json`),
land east — the fictional world's default orientation; `land_sign` (below) generalizes this per scenario
for Real City mode. `PropagationParams.from_config` reads the common block (with per-model defaults for speed and
spread), `distance_to_coast_along_heading` marches the heading line to the first land point (0.5 km steps +
bisection), and `front_state(params, minutes, stop_at_coast)` advances the front and reports remaining
distance, ETA, arrival, minutes since arrival. Every frame's `hazard_state` carries the disaster-agnostic keys
(`world`, `origin_km`, `position_km`, `heading_deg`, `speed_kmh`, `intensity`, `traveled_km`,
`coast_distance_total_km`, `distance_to_coast_km`, `arrival_progress`, `arrived`, `eta_minutes`, `phase`,
`radius_km`) plus the model's own (`wave_height_m`/`front_radius_km`/`coastal_impact_m`/`inundation_km`;
`wind_speed_kt`/`hazard_radius_km`/`wind_decay`; `slick_radius_km`/`slick_area_km2`/`concentration_index`/
`beached`; `water_level_m`/`peak_level_m`/`inundation_km`). `affected_area` is `None` — there is no
real-world geometry; the hazard-footprint/exposure endpoints report `partial`.

Model identifiers: `tsunami-demo-v2`, `cyclone-demo-v2`, `oil-spill-demo-v2`, `coastal-flood-demo-v2`. Each
model's `assumptions` list its illustrative constants (e.g. tsunami initial height 0.5 m + 9.5 m × intensity,
35% decay over the approach, 30-minute run-up ramp; cyclone 35 kt + 125 kt × intensity with
exp(−0.6·dispersion·hours inland) decay; oil radius → spread × (1 − exp(−(0.4 + 1.6·dispersion)·h)),
concentration exp(−0.35·dispersion·h); flood peak 0.5 m + 5.5 m × intensity over a 60-minute smoothstep,
receding as exp(−0.3·dispersion·h past peak)).

**Structures.** `config["structures"]` (see scenarios.md) is assessed each frame by
`simulation/core/structures.py` — `DisasterModel.get_infrastructure_impacts(timestep)` (default `[]`) is
called by the engine right after `get_state` and lands in `SimulationState.infrastructure_impacts`. Rules
per kind and status bands are documented in that module's docstring; `simulation/tests/test_structures.py`
covers them.

**Mirror discipline.** `frontend/src/propagation/` ports these formulas for the live preview. After any
change here run `.venv/bin/python scripts/generate_propagation_fixtures.py` and update the TS side until
`frontend/src/propagation/mirror.test.ts` passes.

The deterministic, disaster-agnostic engine that turns a `ScenarioVersion` into a time-evolving
`SimulationRun`. **This calculates WHAT IS HAPPENING — never WHAT HUMANS SHOULD DO.** Risk scoring, AI
interpretation, and response planning are later phases (see "Future integration" below).

## Architecture

```
Scenario
        ↓
ScenarioVersion (scenario_config — validated by backend/app/schemas/scenario_config.py)
        ↓
SimulationRun (backend/app/api/routes/simulation_runs.py — thin, no business logic)
        ↓
SimulationService (backend/app/services/simulation_service.py — orchestration only)
        ↓
SimulationEngine (simulation/core/engine.py — standalone, no FastAPI/SQLAlchemy dependency)
        ↓
DisasterModel (simulation/models/<type>/model.py — one per disaster family)
        ↓
TimelineFrame × N (simulation/core/state.py)
        ↓
SimulationArtifact (JSON file on disk + PostgreSQL metadata row)
```

`simulation/` is a standalone Python package — importable and testable with no FastAPI, SQLAlchemy,
React, or Three.js dependency (CLAUDE.md §3/§5, architecture.md §18). `backend/app/services/
simulation_service.py` is its only caller.

### Why `simulation/` needs a `sys.path` bootstrap

`simulation/` is a sibling top-level domain to `backend/` (architecture.md §18/§21), and this monorepo
deliberately has no per-domain packaging step (architecture.md ADR-002 — one root `requirements.txt`,
no per-domain `pyproject.toml`). So the repo root must be on `sys.path` before `app.services.
simulation_service` can `import simulation.core...`. `backend/app/main.py` and `backend/tests/
conftest.py` each insert the repo root at the top of the file, before any `app.*` import that could
trigger it — this is the one place that bootstrap lives; don't repeat it ad hoc elsewhere.

## Core design principle

Per CLAUDE.md §5: the engine computes hazard/environmental state deterministically. It never invents a
risk conclusion or a response recommendation — `SimulationState.risk_state` stays an empty dict until a
future risk engine (Prompt 10) populates it from this engine's raw output.

## The engine (`simulation/core/`)

- **`time.py` — `SimulationClock` / `build_clock`.** Integer-minute arithmetic throughout (never adding a
  float delta timestep-by-timestep) to avoid time drift. `build_clock` reads the common `start_time`/
  `duration_hours` window from `scenario_config` and `timestep_minutes` from a run's `timestep_config`
  (default 15 minutes), and rounds `duration_minutes` **down** to the nearest whole timestep rather than
  raising — a scenario with `duration_hours=1.4` and a 15-minute timestep is a normal input, not an error.
  A non-positive `timestep_minutes`/`duration_hours` still raises `SimulationConfigError`.
- **`state.py` — `SimulationState` / `TimelineFrame`.** Plain dataclasses whose field names match
  `shared/contracts/simulation_state.schema.json` / `timeline_frame.schema.json`, with a `to_dict()` for
  JSON serialization. Deliberately not the Pydantic mirror in `shared/schemas/python/contracts.py`, so
  this package stays dependency-light (CLAUDE.md §16/§17).
- **`model.py` — `DisasterModel` (ABC).** `initialize()`, `step(timestep)`, `get_state(timestep) ->
  (environmental_state, hazard_state, affected_area)`, `is_complete(timestep)` (default: clock exhausted),
  `is_key_event(timestep)` (default: `False`), and a `describe()` classmethod every model must satisfy —
  see "Scientific disclaimer" below.
- **`registry.py` — `MODEL_REGISTRY` / `get_model_class`.** `SimulationEngine` selects a model class by
  `disaster_type` string through this module only, never an if/elif chain. `flash_flood`/`coastal_flood`
  reuse `FloodModel`, `storm_surge` reuses `CycloneModel`, `chemical_pollution` reuses `OilSpillModel` —
  the same reuse pattern `backend/app/schemas/scenario_config.py`'s `DISASTER_CONFIG_SCHEMAS` already
  uses for config validation. An unregistered `disaster_type` raises `SimulationConfigError`.
- **`engine.py` — `SimulationEngine`.** `initialize()` captures frame 0 from the model's initial state;
  `step()` advances one timestep and captures a frame; `run()` drives `initialize()` + `step()` to
  completion and returns every `TimelineFrame`. A frame is marked `is_key_event=True` for the first frame,
  the last frame, or when the model's own `is_key_event()` says so (e.g. the tsunami model flags the
  timestep where the wave first reaches the coast).
- **`geo.py` — `haversine_km` / `move_point` / `circle_polygon`.** Plain great-circle math (no
  Shapely/GeoPandas dependency — CLAUDE.md §16: use only what's required) so every model can compute
  distance, a destination point, and an approximate circular `affected_area` GeoJSON polygon without a
  heavyweight GIS engine. PostGIS remains the source of truth for persistent geospatial application data
  (architecture.md §14a) — this is render-adjacent math, not a spatial database.
- **`errors.py` — `SimulationConfigError` / `SimulationExecutionError`.** Never swallowed:
  `SimulationService` catches these only to set `SimulationRun.status=FAILED` + `error_message`, then
  re-raises as a service-level error the API maps to an HTTP response.

## Determinism

Same `disaster_type` + `scenario_config` + `timestep_config` + `seed` always produces the same
`TimelineFrame` sequence (Prompt 7 §9) — verified by `simulation/tests/test_determinism.py` and
`backend/tests/api/test_simulation_runs.py::test_rerun_same_scenario_version_is_deterministic`. No model
uses uncontrolled randomness; `SimulationEngine` accepts an explicit `seed` (default `0`) and hands each
model a seeded `random.Random(seed)` (unused by the current demo models, but available for a future model
that needs deterministic jitter — e.g. particle-cloud visualization variety). The seed actually used is
written back into `SimulationRun.timestep_config["seed"]` on completion, so a completed run's exact inputs
are always recoverable.

**Caveat:** if `scenario_config` omits `start_time`, `build_clock` falls back to wall-clock "now" —
deliberately not reproducible, since nothing was actually pinned. Determinism is a property of the input,
not a guarantee that an unpinned run repeats itself.

## Shoreline orientation (`ShoreParams.land_sign`)

Coastal orientation is a property of the world model, not of data preparation. `ShoreParams` carries
`land_sign`: `+1` when land lies east of the `shore_x(y)` curve (the fictional world's default, and a
west-facing real coast such as the Arabian Sea), `-1` when land lies west (an east-facing real coast such as
the Bay of Bengal). Every land test — `is_land`, `distance_to_coast_along_heading`, `nearest_shore_distance`,
`structures.py`'s `inland_depth_km`/`exposure_for` — routes through a single signed `land_depth_km`, so
neither the engine nor a disaster model branches on orientation itself. `frontend/src/propagation/world.ts`
mirrors this exactly (`landSign`), and the GLSL twin in `frontend/src/three/world/demoWorld.ts` carries it as
a `uLandSign` uniform, not a baked shader constant, so switching a scenario's city never recompiles a shader.

`shore_params_for_city()` derives `land_sign` from a town file's required `ocean_side` field (`"west"` → `+1`,
`"east"` → `-1`, per architecture.md ADR-009/§28c). A town file without `ocean_side` is a `SimulationConfigError`,
the same treatment already given a missing `shore_base_x_km` — the loader never guesses an orientation.

Chennai's committed geometry (`shared/constants/towns/chennai.json`) predates this convention and was fetched
under an earlier pipeline that mirrored the cross-shore axis in `scripts/build_town_data.py` to force an
east-facing city to satisfy the engine's old hard-coded "land is east" rule. That mirroring rendered the city
reversed and left `heading_deg` — a real compass bearing, never mirrored — pointing away from the mirrored
land. `scripts/migrate_town_orientation.py chennai` is a one-shot migration of that already-fetched file to
the `ocean_side` convention (reflects `shore_base_x_km`, each shore term's `amp`, and every building's `xKm`
about the 300 km world's midline; leaves `rotY` untouched, since it was never mirrored in the first place).
It is not a data source — `scripts/build_town_data.py` is, and it now emits the unmirrored orientation
directly, so re-running it with network access reproduces the migrated file rather than contradicting it.

## Disaster models (`simulation/models/<type>/model.py`)

Every model is a **SIMPLIFIED DEMONSTRATION MODEL** — `DisasterModel.describe()` returns
`{"type": "SIMPLIFIED DEMONSTRATION MODEL", "scientific_validation": "Not validated for operational
forecasting", "assumptions": [...]}` for every one of them, persisted into
`SimulationArtifact.extra_metadata["model_card"]` on every completed run. None of these are scientifically
validated; see each model's docstring/`assumptions` list for exactly what's simplified.

| Model | `model_identifier` | `disaster_type` | Assumption summary |
|---|---|---|---|
| `FloodModel` | `flood-demo-v1` | `flood` (+ `flash_flood`, `coastal_flood`) | Linear water-level rise reduced by drainage capacity; affected radius linear in rise above initial level. |
| `TsunamiModel` | `tsunami-demo-v1` | `tsunami` | Constant illustrative wave speed (700 km/h); height decays linearly with distance traveled; coastal impact = height × arrival progress. |
| `CycloneModel` | `cyclone-demo-v1` | `cyclone` (+ `storm_surge`) | Moves along an explicit `track` (linear interpolation) or a fixed demo bearing/speed; wind decays linearly to 60% over the run; hazard radius grows slowly. |
| `OilSpillModel` | `oil-spill-demo-v1` | `oil_spill` (+ `chemical_pollution`) | Drift = current + 3% of wind speed (a commonly cited simplified windage factor); area grows with time/volume; concentration decays exponentially (illustrative weathering). |
| `SearchRescueModel` | `search-rescue-demo-v1` | `search_rescue` | Same leeway+current drift as the oil spill model; search radius grows with elapsed time to represent uncertainty; confidence decreases correspondingly. |

`simulation/models/pollution/` stays empty — `chemical_pollution` is served by the reused `OilSpillModel`,
matching `scenario_config.py`'s existing reuse of `OilSpillConfig` for the same disaster type. Add a
dedicated pollution model there (and register it) only if it later needs genuinely different physics.

This table's `model_identifier` column is exactly what `GET /disaster-types` reports per disaster type
(`backend/app/core/disaster_catalog.py` resolves it live through `simulation.core.registry.get_model_class`,
never a second hardcoded copy) — a `storm_surge` scenario's run honestly shows `model_identifier:
"cyclone-demo-v1"`, never a fabricated per-type id. See docs/development/scenarios.md "Complete disaster
catalog" for the discovery endpoint and the parameter-consumption honesty matrix (exactly which exposed
config fields each model above actually reads vs. accepts-but-ignores).

## Simulation run lifecycle

```
PENDING  (POST /scenarios/{id}/runs — metadata only, unchanged from Prompt 6)
   ↓
RUNNING  (POST /simulation-runs/{run_id}/execute)
   ↓
COMPLETED                    or   FAILED (error_message set, original error re-raised)
```

Only a `PENDING` run can be executed — executing an already-`RUNNING`/`COMPLETED`/`FAILED`/`CANCELLED` run
returns `409 Conflict`; create a new `SimulationRun` (same or different `scenario_version_id`) to re-run.
This keeps every run's timeline permanently associated with the exact configuration that produced it —
required for reproducibility/comparison (architecture.md §7/§11).

### Synchronous execution

`POST /simulation-runs/{run_id}/execute` runs the engine to completion **synchronously**, in the request.
Prompt 7 §26 explicitly defers a job queue (Celery/Redis) to a future phase — for these demo-scale
simulations (tens of frames, sub-second execution — see `simulation/tests/test_performance.py`), a
synchronous prototype is the documented, deliberate choice, not an oversight. Revisit this once a model's
execution time or scale makes blocking the HTTP request impractical.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/scenarios/{id}/runs` | Create `SimulationRun` metadata (`status=pending`) — unchanged from Prompt 6 |
| GET | `/simulation-runs/{run_id}` | Run detail: status, timing, `model_identifier`, artifact summary, frame count |
| POST | `/simulation-runs/{run_id}/execute` | Execute a pending run synchronously; returns the same detail shape on completion |
| GET | `/simulation-runs/{run_id}/timeline` | All `TimelineFrame`s for a run (empty list before execution) |

**Errors:** 404 (`SimulationRunNotFoundError`), 409 (`SimulationRunConflictError` — not pending), 400
(`SimulationConfigurationError` — invalid scenario/timestep config), 500
(`SimulationExecutionFailedError` — a model bug during execution) are handled by FastAPI exception
handlers in `app/main.py`, returning `{"detail": "..."}`.

The API never returns a full timestep-by-timestep scientific payload by default beyond this JSON
timeline — Prompt 7 §27/§21 are explicit that this stays metadata-scale (tens of small frames), not a
scientific grid dump.

## Artifact storage

`SimulationService._persist_artifact` writes one JSON file per run to `simulation/outputs/{run_id}.json`
(gitignored — see `simulation/outputs/README.md`; override the directory with the `SIMULATION_OUTPUT_DIR`
env var) and a matching `SimulationArtifact` row (`artifact_type=json`, `storage_location=<path>`,
`extra_metadata` carrying the model card, frame count, and seed). This is the prototype storage strategy
Prompt 7 §21/§22 explicitly sanctions ("a local JSON artifact may be sufficient... do NOT yet build the
full NetCDF/Zarr scientific storage system"). `GET /simulation-runs/{run_id}/timeline` reads the frames
back from this file — nothing about the API or `SimulationRun`/`SimulationArtifact` schema needs to change
when a future phase replaces this with NetCDF/Zarr/object storage; only `_persist_artifact`'s internals
and `get_timeline`'s read path would.

## Testing

- `simulation/tests/` (57 tests) — pure unit tests of the engine package, no database, no FastAPI:
  `test_time.py`, `test_geo.py`, `test_registry.py`, `test_engine.py` (initialization, stepping,
  completion, invalid config, execution-order errors), `test_determinism.py` (same config+seed →
  identical output; different config → different output, across all five models), `test_model_*.py`
  (per-model: state changes meaningfully over time, deterministic), `test_performance.py` (each demo
  model completes well under a second at a fine 5-minute timestep).
- `backend/tests/api/test_simulation_runs.py` (9 tests, real PostgreSQL/PostGIS via the existing
  `client`/`db_session`/`requires_postgres` fixtures) — the full HTTP lifecycle: pending → execute →
  completed, timeline retrieval with multiple changing frames, re-execution conflict (409), unknown run
  (404), empty timeline before execution, cross-run determinism, config-sensitivity, and one execution
  each for tsunami/cyclone/oil_spill/search_rescue end to end.

Run them:

```
cd simulation && python -m pytest ../simulation/tests    # or: pytest simulation/tests from repo root
cd backend && pytest                                       # full backend suite, incl. simulation execution
```

## Manually verified (2026-09-12)

Against a live `uvicorn` process and the real PostgreSQL/PostGIS instance: created a tsunami scenario,
created a `SimulationRun` (status `pending`), executed it (`pending` → `completed`, `model_identifier`
set to `tsunami-demo-v1`, `duration_seconds` populated, artifact created), retrieved its timeline (10
frames), confirmed `arrival_progress`/`wave_height_m`/`coastal_impact_m` change monotonically frame to
frame, and confirmed the first and last frames are flagged `is_key_event`.

## Future integration

- **Risk engine (Prompt 10):** reads `SimulationState.hazard_state`/`environmental_state`/`affected_area`
  — the raw data this engine already exposes — and populates the still-empty `risk_state` /
  `infrastructure_impacts`. No schema change anticipated here.
- **3D visualization (Prompt 8):** consumes `GET /simulation-runs/{run_id}/timeline` frames directly; the
  renderer never needs to understand model internals, only the `SimulationState` shape.
- **WebSocket streaming (Prompt 9):** will stream frames as they're produced instead of (or alongside)
  the batch `GET .../timeline` retrieval this phase provides.
- **AI agents (Prompt 11)/RAG (Prompt 12):** interpret this engine's structured output; they never compute
  physics themselves (CLAUDE.md §5).

None of the above is implemented yet — this phase is the SimulationEngine and its execution API only.
