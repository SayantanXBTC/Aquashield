# Database — AQUASHIELD

## What belongs in PostgreSQL — and what doesn't

```
APPLICATION STATE (scenarios, runs, risk/vulnerability results, recommendations,
IAPs, infrastructure assets, audit events)
        → PostgreSQL / PostGIS

VECTOR / RAG KNOWLEDGE
        → ChromaDB (separate, unaffected by this — see rag/)

LARGE SCIENTIFIC / SIMULATION DATA (grids, particle trajectories, rasters,
NetCDF/Zarr datasets, every timestep of a run)
        → NetCDF / Zarr / object or file storage (not chosen yet)
          PostgreSQL stores only metadata + a reference (SimulationArtifact)

TRANSIENT REAL-TIME STATE (in-flight WebSocket session state)
        → application memory, for now

OPTIONAL FUTURE CACHE/COORDINATION
        → Redis, only if a real requirement justifies it — not introduced yet
```

Never store a full simulation grid, particle trajectory set, or raster in a Postgres column. `SimulationArtifact.storage_location` is a URI/path pointer to where that data actually lives.

## Stack

- **PostgreSQL 16+ / PostGIS 3.4+** — primary application database.
- **SQLAlchemy 2.0** (`Mapped`/`mapped_column` declarative style, not 1.x patterns) — ORM.
- **Alembic** — migrations.
- **GeoAlchemy2** — PostGIS geometry/geography columns.
- **psycopg 3** (`postgresql+psycopg://`) — driver.
- **ChromaDB** stays separate — see rag/README.md. This database work does not touch it.

## Local setup

### Option A — Docker (documented, not run in this environment)

```
docker compose -f infrastructure/docker-compose.yml up -d
```

Starts `postgis/postgis:17-3.4` on `localhost:5432` with a persistent named volume. Credentials come from `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` env vars (see root `.env.example`); unset, they default to `aquashield`/`aquashield`/`aquashield` — a **local-dev-only** placeholder, never a real credential.

> Docker was not available in the environment this foundation was built in, so this compose file is written and documented but not itself executed here. Verification below was instead run against a local Homebrew PostgreSQL 18 + PostGIS 3.6 instance — same engine, same extension, different launcher. Run `docker compose -f infrastructure/docker-compose.yml up -d` and confirm the same results before relying on it in your environment.

### Option B — any local PostgreSQL + PostGIS

Any reachable Postgres with the `postgis` extension available works — set `DATABASE_URL` (or the `POSTGRES_*` fields in `backend/.env`) to point at it. What matters is `CREATE EXTENSION postgis;` succeeding.

### Then, from `backend/` with the venv active:

```
alembic upgrade head          # apply migrations
python -m app.db.seed         # load demo data (see below)
pytest                        # run the suite, including DB tests
```

## Configuration

`backend/app/config/settings.py` builds `database_url` from `postgres_user` / `postgres_password` / `postgres_host` / `postgres_port` / `postgres_db`, or you can set `DATABASE_URL` directly to override all of that. Nothing is hardcoded — see `backend/.env.example`.

## Migrations

`backend/alembic/env.py` pulls the connection string from `app.config.settings` at runtime — **no credentials live in `alembic.ini`**. It also wires in `geoalchemy2.alembic_helpers` (`include_object`, `render_item`) so autogenerate correctly renders `Geometry`/`Geography` columns and skips PostGIS's own internal tables (`spatial_ref_sys`) instead of trying to drop them.

```
alembic revision --autogenerate -m "description"   # create a migration
alembic upgrade head                                 # apply
alembic downgrade base                                # revert everything (tested — see below)
alembic downgrade -1                                   # revert one step
alembic current                                        # show applied revision
alembic check                                          # confirm models match DB (no pending diff)
```

**Do not edit the schema outside a migration once Alembic is established.**

### The GeoAlchemy2 + Alembic spatial-index gotcha

GeoAlchemy2 columns default to `spatial_index=True`, which creates the GIST index itself via a SQLAlchemy DDL event at `CREATE TABLE` time. Alembic's autogenerate *also* wants to emit an explicit `CREATE INDEX` for the same column — running both creates the same index name twice and fails with `DuplicateTable`. The fix used in `backend/alembic/versions/*_foundational_schema.py`: keep `spatial_index=True` on the model (so autogenerate's comparator still knows an index should exist and won't flag a false diff), but manually remove the duplicate `op.create_index(...)` for the geometry/geography columns from the generated migration, since the DDL event already creates it. If you add a new spatial column, autogenerate will regenerate this same duplicate — delete it the same way.

### Postgres ENUM types aren't dropped by `drop_table`

Every `str, enum.Enum` field becomes a native Postgres `ENUM` type, which is an object independent of any table. `op.drop_table` does not drop it, so a `downgrade()` that only drops tables leaves orphaned types behind and a subsequent `upgrade()` fails with `type already exists`. The initial migration's `downgrade()` explicitly drops each enum type after the tables — copy that pattern for future migrations that add new enum columns.

## Models

`backend/app/db/models/` — one file per entity (`Scenario`, `ScenarioVersion`, `SimulationRun`, `RiskAssessment`, `VulnerabilityAssessment`, `ResponseRecommendation`, `IncidentActionPlan`, `InfrastructureAsset`, `SimulationArtifact`, `AuditEvent`), plus `enums.py`. `models/__init__.py` imports all of them so `Base.metadata` is complete for both Alembic and any `create_all()` call — always import `app.db.models` (not an individual model file) before relying on the full metadata.

Disaster-specific parameters live in `ScenarioVersion.scenario_config` (JSONB) — not as dozens of nullable columns — because different disaster types need genuinely different parameters (architecture.md §10). Common fields (name, disaster_type, status, timestamps) stay relational.

## Seed data

`backend/app/db/seed.py` — **synthetic development/demo data only**, never presented as real predictions. Seeds 3 scenarios (flood, tsunami, oil spill) with versions, simulation runs, infrastructure assets (a point/hospital, a line/road, a polygon/shelter), risk assessments, and one recommendation. Skips if `Scenario` rows already exist unless called with `force=True`.

```
python -m app.db.seed
```

## Tests

`backend/tests/conftest.py` provides `requires_postgres` (skips cleanly with a clear message if no database is reachable — these tests are **not** silently run against SQLite, since the whole point is proving PostGIS works) and `db_session` (a transaction-per-test fixture using SQLAlchemy 2.0's `join_transaction_mode="create_savepoint"`, so even code that calls `.commit()` internally, like `seed()`, is fully rolled back after each test).

`backend/tests/db/` covers: DB config (`test_connection.py`), that the DB is actually at the Alembic head revision and the migration history has a single head (`test_migrations.py`), Scenario/ScenarioVersion/SimulationRun creation and the RiskAssessment/ResponseRecommendation relationships (`test_models.py`), PostGIS geometry storage and an `ST_DWithin` spatial query (`test_spatial.py`), and the seed script (`test_seed.py`).

**Run the suite against a second, disposable database**, not whatever `DATABASE_URL` your dev server uses — several tests assert an empty table (e.g. `rag_sources` before anything is ingested, per-user scenario isolation), and once real dev/demo data exists (real RAG sources ingested via `python -m rag ingest`, scenarios you created by hand) those assertions legitimately stop holding against a shared database. `conftest.py`'s `TEST_DATABASE_URL` env var (falls back to `DATABASE_URL` if unset) exists exactly for this — it is read from the real shell environment, not from `backend/.env`:

```bash
createdb aquashield_test
psql aquashield_test -c 'CREATE EXTENSION postgis;'
DATABASE_URL=postgresql+psycopg://aquashield:@localhost:5433/aquashield_test .venv/bin/alembic upgrade head
DATABASE_URL=postgresql+psycopg://aquashield:@localhost:5433/aquashield_test .venv/bin/python -m app.db.seed
DATABASE_URL=postgresql+psycopg://aquashield:@localhost:5433/aquashield_test .venv/bin/python -m app.services.geospatial.ingest_natural_earth
export TEST_DATABASE_URL=postgresql+psycopg://aquashield:@localhost:5433/aquashield_test
```

A handful of tests assert a specific `RAG_PROVIDER`/`AI_PROVIDER` default posture regardless of database isolation — those pin the setting themselves for their own duration via a save/restore fixture (`tests/api/test_rag.py`'s `not_configured`, `tests/api/test_ai_analysis.py`'s `rag_not_configured`) rather than relying on the ambient `backend/.env` having no override, since a developer's own dev `.env` is expected to diverge from the code's defaults once RAG is actually switched on for local use (CLAUDE.md §26b).

## Security

- No secrets in git. `.env`, `backend/.env` are gitignored; only `.env.example`/`backend/.env.example` (placeholders) are committed.
- Credentials only ever come from environment configuration, never hardcoded in source.
- This is a development-only setup — no production topology, pooling strategy, or backup policy is implied or assumed.
