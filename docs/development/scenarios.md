# Scenario System — AQUASHIELD

## Prompt 12 — User-owned tests, in-situ creation, propagation parameters (2026-09-12)

> Current behaviour; the sections below describe the original builder and are kept as history.

- Every scenario belongs to the signed-in Firebase user: `scenarios.owner_uid` (NOT NULL, indexed) is set
  from the verified token's `sub` by `ScenarioService(owner_uid=...)`; `ScenarioRepository.get/list` filter
  on it; another user's scenario is a 404. Simulation runs inherit ownership through
  `run.scenario_version.scenario.owner_uid` (`SimulationService(owner_uid=...)`).
- Creation is inline in the command center (`NewTestModal`: a name + one of the generic presets in
  `features/command-center/presets.ts` — Demo Oil Spill / Demo Tsunami / Demo Cyclone / Demo Coastal Flood).
  No location fields exist in the UI; `location_name/latitude/longitude` remain optional API fields nothing
  sends. The seed no longer creates scenarios.
- `scenario_config` gains the common `PropagationConfig` block (validated for every type):
  `origin_x_km`, `origin_y_km` (0–300), `heading_deg` (0–360, compass), `speed_kmh` (>0, ≤2000), `intensity`
  (0–1), `spread_radius_km` (0–150), `dispersion_rate` (0–1). Any of these counts as "populated" for the
  READY status. Disaster-specific fields (magnitude, oil_type, …) still validate and are carried through but
  the v2 demo models only read the propagation block.
- `scenario_config.structures` (Prompt 13): up to 50 `{id, type, name, x_km, y_km, enabled}` entries
  (`type` ∈ building/hospital/port/power_plant/lighthouse/fuel_terminal). Placed and toggled inline; a
  disabled structure is kept but neither drawn nor assessed. Saved with every parameter version.
- Inline edits autosave as new immutable `ScenarioVersion`s (label "Inline parameter edit") — the versioning
  rule is unchanged; expect many versions per test.

The first functional vertical slice: create, persist, version, modify, duplicate, inspect, and prepare a
disaster scenario for a future simulation engine. **No physics, AI, or RAG runs here** — a SimulationRun
created by this system is metadata only (see §"Simulation runs" below).

## Architecture

```
React Scenario Builder (frontend/src/features/scenario-builder/)
        ↓
FastAPI routes (backend/app/api/routes/scenarios.py) — thin, no business logic
        ↓
ScenarioService (backend/app/services/scenario_service.py) — domain logic
        ↓
ScenarioRepository / SimulationRunRepository (backend/app/repositories/) — persistence only
        ↓
PostgreSQL/PostGIS (Scenario, ScenarioVersion, SimulationRun — see docs/development/database.md)
        ↓
Future Simulation Engine (not implemented — Prompt 7+)
```

The scenario system is architecturally independent of simulation physics: `SimulationRun` only records that a
run was *requested*, against which scenario version, with what status. Nothing in this layer computes a wave,
a flood extent, or a wind field.

## Scenario lifecycle

`Scenario.status` (distinct from `SimulationRun.status` — a scenario's lifecycle vs. one run's execution state):

```
draft → ready → archived
```

- **draft**: default state for a newly created scenario, or one whose `scenario_config` didn't validate to
  anything substantive.
- **ready**: set automatically on create when `scenario_config` has at least one disaster-specific field
  populated (see `ScenarioService.create_scenario` / `is_config_populated`), or explicitly via `PATCH
  /scenarios/{id}` with `{"status": "ready"}`.
- **archived**: set by `DELETE /scenarios/{id}` (see "Deletion strategy" below) or explicitly via `PATCH`.

## Versioning strategy

`ScenarioVersion` rows are immutable once created. A new version is created — the old one is never
modified — whenever `scenario_config` changes:

- `POST /scenarios` always creates version 1.
- `PATCH /scenarios/{id}` with a `scenario_config` field creates a new version (metadata-only fields — name,
  description, location, status — update the `Scenario` row in place, no new version).
- `POST /scenarios/{id}/versions` creates a new version explicitly.
- `POST /scenarios/{id}/duplicate` creates a **new Scenario** with its own version 1, copying the current
  configuration — it does not add a version to the original.

Version numbers are sequential per-scenario (1, 2, 3, ...), not globally unique — enforced by a
`(scenario_id, version_number)` unique constraint. "Current version" is simply the highest `version_number`
for a scenario — there is no separate `current_version_id` column; adding one was unnecessary for this phase.

## Scenario configuration validation

Common fields (name, disaster_type, location, status, timestamps) are real relational columns. Disaster-specific
parameters live in `ScenarioVersion.scenario_config` (JSONB) and are validated by
`backend/app/schemas/scenario_config.py`:

- A common `start_time`/`duration_hours` window is validated for every disaster type.
- Each disaster type has (or reuses) a small Pydantic model for its known fields — e.g. `FloodConfig`
  (`rainfall_mm_24h`, `river_level_m`, `water_rise_rate_m_per_hr`, `drainage_capacity_pct`), `TsunamiConfig`,
  `CycloneConfig`, `OilSpillConfig`, `SearchRescueConfig`. `flash_flood`/`coastal_flood` reuse `FloodConfig`;
  `storm_surge` reuses `CycloneConfig`; `chemical_pollution` reuses `OilSpillConfig`.
- Unknown/future fields are allowed through (`extra="allow"`) rather than rejected, so the schema doesn't need
  a migration every time a new parameter is added — only range/type validation needs updating.
- This checks **data validity** (types, ranges — e.g. latitude -90..90, a percentage 0..100) — never
  **scientific validity** (a magnitude of 9.5 is accepted; a negative spill volume is not). See CLAUDE.md §7.

## Location

`Scenario.location_name` (free text) + `Scenario.location` (PostGIS `Geography(Point, 4326)`, nullable). The
API accepts/returns plain `latitude`/`longitude` floats (validated -90..90 / -180..180, and required together —
`backend/app/db/geo.py` converts to/from the PostGIS point). No geocoding service — users provide coordinates
and/or a name.

## Deletion strategy

`DELETE /scenarios/{id}` **archives** (`status = archived`) rather than hard-deleting. Reason: `Scenario` →
`ScenarioVersion` → `SimulationRun` has `ondelete="CASCADE"` foreign keys (see database.md) — a hard delete
would silently destroy simulation run history along with the scenario. Archiving removes it from active use
while preserving everything. There is no hard-delete endpoint in this phase.

## Simulation runs

`POST /scenarios/{id}/runs` creates a `SimulationRun` row with `status = pending`, referencing either an
explicit `scenario_version_id` or (if omitted) the scenario's current version. **This does not execute
anything.** The response always includes `"message": "Simulation run created; simulation engine not yet
executed."` — the frontend surfaces this verbatim rather than implying completion. No timestep results, no
risk scores, no fabricated outcomes are ever generated by this endpoint.

## API endpoints

All under `/scenarios`:

| Method | Path | Purpose |
|---|---|---|
| POST | `/scenarios` | Create scenario + initial version |
| GET | `/scenarios` | List (paginated, filterable, sortable) |
| GET | `/scenarios/{id}` | Detail (current version + version count) |
| PATCH | `/scenarios/{id}` | Update metadata and/or create a new version |
| DELETE | `/scenarios/{id}` | Archive |
| POST | `/scenarios/{id}/duplicate` | Create a new scenario copying current config |
| GET | `/scenarios/{id}/versions` | List versions (ascending) |
| POST | `/scenarios/{id}/versions` | Create a version explicitly |
| GET | `/scenarios/{id}/runs` | List simulation run metadata |
| POST | `/scenarios/{id}/runs` | Create pending simulation run metadata |

`GET /scenarios` supports `disaster_type`, `status`, `search` (name, `ILIKE`) filters; `sort_by`
(`created_at`/`updated_at`/`name`, whitelisted — never a raw column string) and `sort_dir`; `limit`/`offset`
pagination, returning `{items, total, limit, offset}`.

**Errors**: 404 (`ScenarioNotFoundError`) and 400 (`ScenarioValidationError`) are handled by FastAPI exception
handlers in `app/main.py`, returning `{"detail": "..."}` — never a raw SQL/traceback. 422 comes from Pydantic
request validation (missing/invalid fields, bad enum values, out-of-range coordinates) automatically.

## Frontend / backend responsibility

- **Backend** owns validation, persistence, versioning, and is authoritative. `backend/app/schemas/scenario.py`
  defines every request/response shape — the API never returns a raw SQLAlchemy model.
- **Frontend** (`frontend/src/features/scenario-builder/`) owns the form UX and gives immediate feedback via
  client-side validation (`validation.ts`) that mirrors the backend's data-validity rules — but always treats
  the server's response as authoritative (a 422/400 from the API is surfaced even if client validation passed).
- The dynamic parameter form is data-driven: `disasterFieldSpecs.ts` maps each `DisasterType` to its field
  list (label, type, range) — adding a disaster-specific field means editing that registry, not writing a new
  component. Switching disaster type discards fields the new type doesn't have
  (`formState.resetConfigForDisasterType`) rather than silently carrying over incompatible values.
- No router is installed — `ScenarioBuilderFeature.tsx` does in-feature view switching (list/create/detail)
  via local state. `architecture.md` ADR-001 already left routing as "add if needed"; this feature didn't need
  URL-addressable routes to be functional, so that decision wasn't forced here.
- Cross-domain contracts: `Scenario`, `ScenarioVersion`, and (newly) `SimulationRun` are canonical in
  `shared/contracts/*.schema.json` + mirrored in `shared/schemas/python/contracts.py` and
  `shared/types/index.ts`. API request/response *envelope* shapes (`ScenarioCreateRequest`,
  `ScenarioDetail`, `Page<T>`, etc.) are backend-owned (`backend/app/schemas/scenario.py`) and mirrored only in
  `shared/types/index.ts` for the frontend — not duplicated into `shared/schemas/python`, since that would be a
  second competing Python definition of the same shape.
- The frontend imports shared types via a `@shared/*` path alias (`frontend/vite.config.ts` /
  `tsconfig.json`) resolving to `../shared` — Vite's dev server `fs.allow` is extended to permit reading
  outside `frontend/`'s own root for exactly this cross-domain import.

## Complete disaster catalog (Prompt 9.1)

**Disaster type vs. scenario instance** — kept deliberately distinct throughout this system:

```
DISASTER TYPE (one of 9, fixed)          SCENARIO INSTANCE (unbounded, user-created)
  flood                          ─────►    "Demo Monsoon Flood — Ganges Delta"
                                  ─────►    "River Flood — Rotterdam"
  cyclone                        ─────►    "Cyclone Landfall — Bay of Bengal"
```

A disaster type is a fixed point in four parallel, hand-kept-in-sync registries (CLAUDE.md §25 already
establishes and justifies this pattern — none of these are generated from one another):

```
DisasterType enum (backend/app/db/models/enums.py, shared/types)
        │
        ├─► DISASTER_CONFIG_SCHEMAS (backend/app/schemas/scenario_config.py)      — validates scenario_config
        ├─► DISASTER_FIELD_SPECS / DISASTER_TYPE_DEFAULTS (frontend disasterFieldSpecs.ts) — renders the form
        ├─► MODEL_REGISTRY (simulation/core/registry.py)                          — resolves a DisasterModel
        └─► disasters/registry.ts (frontend three/disasters/)                     — resolves a visualizer
```

All 9 values (`flood`, `flash_flood`, `coastal_flood`, `storm_surge`, `cyclone`, `tsunami`, `oil_spill`,
`chemical_pollution`, `search_rescue`) were already wired through all four registries as of Prompt 6-8 — a
user could already create a scenario of any of the 9 types via the Scenario Builder (`/scenarios`) before
this pass. What Prompt 9.1 actually fixed was **discoverability**, not catalog completeness:

- The Command Center's scenario selector only lists `status="ready"` scenarios (`useCommandCenterSession`),
  and the dev seed data only had 2-3 of the 9 types in that state — so the running app visibly looked like
  it only supported 2 disaster types even though the backend/frontend already supported 9. Fixed by adding
  one `READY` demo scenario per previously-unrepresented type to `backend/app/db/seed.py` (idempotent —
  `_ensure_scenario` looks each up by name before inserting, safe to re-run) and adding a "New scenario" link
  from the Command Center's scenario panel to `/scenarios`.
- Scenario templates (§17 of the prompt): `DISASTER_TYPE_DEFAULTS` in `disasterFieldSpecs.ts` + a "Use demo
  template" button in `ScenarioForm.tsx` — a frontend-only convenience that pre-fills the form, explicitly
  labeled "Demo template values — not a real historical event." Not persisted as extra database rows.
- `ScenarioForm.tsx`/`FormField.tsx`/`DisasterParameterFields.tsx` were restyled onto the Prompt 8 design
  tokens (`bg-surface`/`text-ink`/`border-hairline`/etc.) and `components/ui` primitives (`CommandButton`,
  `SectionLabel`), replacing raw Tailwind slate/sky classes that predated that system.
- A real bug was found and fixed while wiring this up: `ScenarioForm`'s `<form>` had no `noValidate`, so a
  disaster-specific field with an HTML `max`/`min` attribute (e.g. cyclone's `central_pressure_hpa`,
  `max=1050`) triggered the *browser's* native constraint-validation UI and silently blocked submission
  before React's own `validateScenarioForm` ever ran — the styled, accessible error message never had a
  chance to appear. Fixed by adding `noValidate` to the form so the app's own validation is the only gate.

### Discovery endpoint: `GET /disaster-types`

Additive, read-only, **not** a replacement for the parallel-registry pattern above. It exists so a client
(or a developer) can ask "what disaster types exist and what actually powers them" without reading four
separate files:

```
GET /disaster-types
        ↓
app/api/routes/disaster_types.py (route — no logic)
        ↓
app/core/disaster_catalog.py — build_disaster_catalog()
        ↓
reads: DISASTER_CONFIG_SCHEMAS (for parameter_keys) + simulation.core.registry.get_model_class (for the
       real model_identifier) — never a second hardcoded copy of either
        ↓
[{ disaster_type, display_name, short_description, category, model_identifier, parameter_keys }, ...]
```

`model_identifier` is resolved live through the simulation model registry, so a `storm_surge` entry honestly
reports `"cyclone-demo-v1"` — never a fabricated `"storm-surge-demo-v1"` — matching exactly what a
`storm_surge` `SimulationRun` actually records. The Scenario Builder's form does **not** currently consume
this endpoint as its live data source — `disasterFieldSpecs.ts` stays that, by hand, for the same reason
`DISASTER_CONFIG_SCHEMAS` isn't auto-derived into it (CLAUDE.md §25). Shared contract:
`shared/types/index.ts`'s `DisasterCatalogEntry`, mirroring `backend/app/schemas/disaster_catalog.py`.

### Parameter-consumption honesty matrix

Every exposed form field, checked against what each disaster type's underlying `simulation/models/*/model.py`
`initialize()`/`step()`/`get_state()` actually reads (not what `scenario_config.py` merely *validates* —
validation and physical consumption are different questions). "Used by current model?" means the value
measurably changes the model's computed output; "Metadata only" means it's read and/or echoed back in
`environmental_state`/`hazard_state` for display, but does not affect any computed quantity.

| Disaster type(s) | Parameter | Unit | Used by current model? | Notes |
|---|---|---|---|---|
| flood, flash_flood, coastal_flood | `rainfall_mm_24h` | mm/24h | ✅ Yes | Derives the rise rate when `water_rise_rate_m_per_hr` isn't set |
| flood, flash_flood, coastal_flood | `river_level_m` | m | ✅ Yes | Initial water level |
| flood, flash_flood, coastal_flood | `water_rise_rate_m_per_hr` | m/hr | ✅ Yes | Overrides the rainfall-derived rate when set |
| flood, flash_flood, coastal_flood | `drainage_capacity_pct` | % | ✅ Yes | Reduces the rise rate |
| storm_surge, cyclone | `wind_speed_kt` | kt | ✅ Yes | Initial wind speed (decays over the run) |
| storm_surge, cyclone | `radius_km` | km | ✅ Yes | Initial hazard radius (grows over the run) |
| storm_surge, cyclone | `central_pressure_hpa` | hPa | ○ Metadata only | Read and echoed in `environmental_state`; does not affect wind speed, track, or radius in the current demo model |
| tsunami | `source_latitude` / `source_longitude` | ° | ✅ Yes | Wave origin; drives distance-to-coast and arrival time |
| tsunami | `initial_wave_height_m` | m | ✅ Yes | Starting wave height (decays with arrival progress) |
| tsunami | `magnitude` | — | ○ Metadata only | Read and echoed in `hazard_state`; does not affect wave height, speed, or arrival time in the current demo model |
| tsunami | `propagation_direction_deg` | ° | ○ Not read at all | Accepted by `TsunamiConfig`/exposed in the form, but the current model never reads this key |
| oil_spill, chemical_pollution | `spill_volume_tonnes` | tonnes | ✅ Yes | Drives slick area growth |
| oil_spill, chemical_pollution | `wind_speed_kt` / `wind_direction_deg` | kt / ° | ✅ Yes | Windage component of drift (3% of wind speed) |
| oil_spill, chemical_pollution | `current_speed_kt` / `current_direction_deg` | kt / ° | ✅ Yes | Dominant drift component when current exceeds windage |
| oil_spill, chemical_pollution | `oil_type` | — | ○ Metadata only | Read and echoed in `environmental_state`; does not affect drift speed, area, or concentration decay |
| search_rescue | `search_radius_km` | km | ✅ Yes | Initial search radius (grows with elapsed time) |
| search_rescue | `vessel_type` | — | ○ Metadata only | Read and echoed in `environmental_state`; does not affect drift or search radius |

None of the "metadata only"/"not read" rows are hidden from the user or silently dropped — they're accepted,
stored, and (where echoed) visible in the run's `hazard_state`/`environmental_state`. This table exists so
that fact is explicit rather than discovered by reading five model files, and so a future real model
(Prompt 10+) has a documented list of which fields it would need to start actually consuming.

## Future simulation integration

When the simulation engine (Prompt 7+) exists, it will consume a `SimulationRun` row + its
`ScenarioVersion.scenario_config`, execute, and write results as `SimulationArtifact` (metadata + storage
reference — see database.md) plus update `SimulationRun.status`/`started_at`/`completed_at`. Nothing in this
phase needs to change for that to happen — the scenario/version/run schema was already designed for it in
Prompt 5.
