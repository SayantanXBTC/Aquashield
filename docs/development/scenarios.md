# Scenario System — AQUASHIELD

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

## Future simulation integration

When the simulation engine (Prompt 7+) exists, it will consume a `SimulationRun` row + its
`ScenarioVersion.scenario_config`, execute, and write results as `SimulationArtifact` (metadata + storage
reference — see database.md) plus update `SimulationRun.status`/`started_at`/`completed_at`. Nothing in this
phase needs to change for that to happen — the scenario/version/run schema was already designed for it in
Prompt 5.
