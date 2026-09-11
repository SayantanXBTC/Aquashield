# AQUASHIELD — System Architecture

## 1. Vision

AQUASHIELD is an AI-powered Water Disaster Intelligence, Simulation & Response Platform. It lets a user create, configure, simulate, animate, analyze, and respond to water-related disasters, then modify the scenario and re-run the loop.

## 2. Problem Statement

Water-related disasters (floods, cyclones, tsunamis, storm surges, oil spills, marine pollution, search & rescue) are each normally handled by separate, single-purpose tools with no shared simulation, visualization, or reasoning layer. Responders lack a unified way to see how a disaster evolves over time, test interventions before committing to them, and get response guidance grounded in real simulation output and authoritative documents rather than guesswork.

## 3. Solution

A single modular platform where:

- Disasters are represented through a common `Scenario` abstraction, not disaster-specific application silos.
- A physics/numerical simulation layer produces deterministic time-series state — the AI never invents physical outcomes.
- A 3D, GPU-efficient renderer animates that time-series state, disaster-appropriately.
- A multi-agent AI system interprets simulation state and vulnerability data.
- A disaster-aware RAG pipeline grounds AI recommendations in authoritative documents.
- The user can modify scenario parameters and re-simulate, enabling "what if" comparison.

## 4. Supported Disaster Classes

Initially architect for:

1. Flood
2. Flash Flood
3. Coastal Flood
4. Storm Surge
5. Cyclone
6. Tsunami
7. Oil Spill
8. Marine/Chemical Pollution
9. Maritime Search & Rescue
10. Future extensible water-related hazards

**The platform is disaster-agnostic and must not be implemented as an oil-spill-only system.** Oil spill is one `Scenario` implementation among many, not the architectural center of the platform.

## 5. User Scenario Builder

```
User
  ↓
Select Disaster Type
  ↓
Configure Parameters
  ↓
Select Environmental Conditions
  ↓
Define Simulation Duration
  ↓
Run Simulation
```

Each disaster type exposes its own parameter schema (e.g. tsunami: magnitude, source depth; cyclone: wind speed, track; oil spill: volume, oil type) through the same builder shell. The builder UI is generic; the parameter forms are disaster-specific and driven by each scenario's declared schema.

## 6. Simulation Abstraction

Conceptual interface (not implemented yet):

```
DisasterScenario
    ├── metadata                 (id, type, name, created_at)
    ├── parameters                (disaster-specific config)
    ├── initialize()              (validate params, set up initial state)
    ├── simulate()                (advance physics/model over time)
    ├── get_state(t)               (spatial state at timestep t)
    ├── get_timeline()            (list of available timesteps/events)
    └── get_visualization_data(t)  (render-ready payload for timestep t)
```

Each disaster (`FloodScenario`, `CycloneScenario`, `TsunamiScenario`, `OilSpillScenario`, `PollutionScenario`, `SearchAndRescueScenario`, ...) implements this same interface with its own model internals. The frontend, AI orchestration, and API layer depend only on this interface — never on a specific disaster implementation.

This is conceptual architecture only. Do not implement it yet.

## 7. Time-Series Simulation

```
Scenario
  ↓
 t0 → t1 → t2 → ... → tn
```

The frontend consumes a sequence of simulation states and animates them, rather than rendering a single static outcome. Every scenario type produces state at discrete timesteps, even if the underlying model resolution differs per disaster.

## 8. 3D Visualization Architecture

```
React
  ↓
React Three Fiber
  ↓
Three.js / WebGL
  ↓
Scenario-specific visual layers
```

A common rendering shell (camera, terrain/water base, timeline controls) hosts disaster-specific visual layers (wave propagation, wind field, flood surface, particle plume, drift region) that are swapped in based on active scenario type.

## 9. AI Architecture

```
Simulation State
  ↓
State Router
  ↓
Vulnerability Agent
  ↓
Tactical Agent (disaster-specific)
  ↓
Regulatory/RAG Agent
  ↓
Command Synthesizer
```

The graph is a starting shape and can evolve. Agents read structured simulation state; they do not generate physical predictions themselves.

## 10. RAG Architecture

```
Documents
  ↓
Parser
  ↓
Chunker
  ↓
Embedding
  ↓
ChromaDB
  ↓
Retriever
  ↓
Regulatory/Knowledge Agent
```

The knowledge base is organized by disaster category (flood, cyclone, tsunami, oil spill, pollution, search & rescue, general disaster-management SOPs) so retrieval can be scoped by active scenario type, not just free-text similarity.

## 11. Closed-Loop Scenario System

```
CREATE → SIMULATE → VISUALIZE → ANALYZE → RESPOND → MODIFY → RE-SIMULATE
```

This loop is a core feature, not an afterthought. It lets a user test hypothetical interventions, e.g.:

- Scenario A: No intervention
- Scenario B: Evacuation triggered at T+2h
- Scenario C: Containment/response action applied at T+3h

The system should eventually allow side-by-side comparison of scenario outcomes.

## 12. High-Level Architecture

Visualization path:

```
Frontend
  ↓
FastAPI
  ↓
Scenario Manager
  ↓
Environmental Data
  ↓
Simulation Engine
  ↓
Simulation State Store/Stream
  ↓
3D Renderer
```

AI/response path (runs in parallel off the same simulation state):

```
Simulation State
  ↓
AI Orchestrator
  ↓
Risk Analysis
  ↓
RAG
  ↓
Response Strategy
  ↓
Command Synthesizer
  ↓
Frontend
```

## 13. Technology Stack

**FRONTEND**
React, TypeScript, React Three Fiber, Three.js, Tailwind CSS, Anime.js, Deck.gl (where appropriate)

**BACKEND**
Python, FastAPI, WebSockets, Pydantic

**DATABASE**
PostgreSQL, PostGIS, SQLAlchemy 2.0, Alembic, GeoAlchemy2, psycopg 3

**SIMULATION**
NumPy, SciPy, xarray, GeoPandas, Shapely, Rasterio (where necessary)

**AI**
LangGraph; LLM provider to be decided

**RAG**
ChromaDB, embeddings, document parsing/retrieval pipeline

**TESTING**
Frontend tests, Python tests, Playwright E2E testing

### ADR-001: Vite vs Next.js

**Decision:** Vite (React + TypeScript, SPA) for the initial build.

**Reason:** AQUASHIELD's frontend is a real-time, WebSocket-driven, GPU-heavy 3D visualization client (React Three Fiber/Three.js) with no SEO or content-marketing requirement and no need for server-rendered pages. Vite gives a faster dev/build loop for this kind of client-heavy app and avoids SSR/hydration complexity that provides no benefit for a canvas/WebGL-dominant UI.

**Alternatives:** Next.js — considered for its routing and API-route conventions, but its SSR/RSC model adds complexity that doesn't serve a single-page command-center UI, and the backend is already a separate FastAPI service, making Next.js API routes redundant.

**Consequences:** Routing (if needed) will use a lightweight client-side router. No server-rendering benefits are available; if a future requirement needs SSR/SEO (e.g. a public marketing site separate from the operational platform), that would be a separate app, not a rewrite of this one.

### ADR-002: requirements.txt vs pyproject.toml

**Decision:** A single root-level `requirements.txt` for all Python domains (backend, simulation, agents, rag).

**Reason:** These domains run as one Python monorepo, not separately packaged/published libraries, so a single flat dependency manifest avoids duplicating dependency systems (CLAUDE.md §18) and keeps environment setup to one command.

**Alternatives:** `pyproject.toml` per domain — rejected for now as unnecessary packaging overhead when nothing here is published as a standalone package; per-domain `requirements.txt` files — rejected because it duplicates shared dependencies (FastAPI, Pydantic, NumPy) across domains with no isolation benefit in a single-process/monorepo dev setup.

**Consequences:** If a domain later needs isolated packaging (e.g. `simulation` published as a standalone library), that domain gets its own `pyproject.toml` at that time, documented as a new ADR.

### ADR-003: PostgreSQL + PostGIS + SQLAlchemy 2.0 + Alembic for application state

**Decision:** PostgreSQL with the PostGIS extension is the primary application database, accessed through SQLAlchemy 2.0 (declarative `Mapped`/`mapped_column` style, not 1.x patterns) with GeoAlchemy2 for geometry/geography columns and psycopg 3 as the driver, migrated with Alembic. ChromaDB remains a separate vector store — Postgres does not replace it. Large scientific/simulation data (grids, particle trajectories, rasters, NetCDF/Zarr datasets) is never stored in Postgres columns — only metadata and a storage reference (`SimulationArtifact`).

**Reason:** AQUASHIELD's application state (scenarios, versions, simulation run metadata, risk/vulnerability results, recommendations, incident action plans, infrastructure assets, audit events) is inherently relational and benefits from real transactions, foreign keys, and constraints. PostGIS gives first-class geometry/geography types and spatial indexing (GIST) for infrastructure assets and scenario locations without a second geospatial database. SQLAlchemy 2.0 + Alembic is the standard, well-documented combination for this in Python and integrates cleanly with FastAPI/Pydantic.

**Alternatives:** A document database (MongoDB) — rejected because the domain is fundamentally relational (Scenario → ScenarioVersion → SimulationRun → {RiskAssessment, VulnerabilityAssessment, ResponseRecommendation, IncidentActionPlan}) and would need application-level joins for little benefit. Storing everything (including simulation output) in Postgres — rejected per CLAUDE.md §32/architecture.md §14a: large scientific arrays don't belong in a relational database. A separate PostGIS-less Postgres plus a standalone geospatial service — rejected as unnecessary operational complexity when PostGIS solves it in-process.

**Consequences:** Every Python domain (backend, simulation, agents, rag) that touches the database depends on `sqlalchemy`, `alembic`, `geoalchemy2`, `psycopg` (added to the shared root `requirements.txt`, see ADR-002). A local PostgreSQL+PostGIS instance (via `infrastructure/docker-compose.yml`, or any equivalent) is now a development prerequisite for `backend/tests/db/*`, which skip cleanly (not silently substituted with SQLite) when it isn't reachable. See `docs/development/database.md` for full detail, including two documented GeoAlchemy2/Alembic interaction gotchas (duplicate spatial index creation, orphaned Postgres ENUM types on downgrade) and how they're handled.

## 14. Data Sources

All external environmental/geospatial data providers are **PLANNED / TO BE DECIDED**. No data provider is selected or assumed at this stage.

## 14a. Data Storage Architecture

```
APPLICATION STATE                    → PostgreSQL / PostGIS (ADR-003)
VECTOR / RAG KNOWLEDGE               → ChromaDB (separate, unaffected by ADR-003)
LARGE SCIENTIFIC / SIMULATION DATA   → NetCDF / Zarr / object or file storage (not chosen yet;
                                        Postgres stores only metadata + reference — SimulationArtifact)
TRANSIENT REAL-TIME STATE            → application memory, for now
OPTIONAL FUTURE CACHE/COORDINATION   → Redis, only if a real requirement justifies it — not introduced
```

Never collapse all of this into PostgreSQL. A full simulation grid, particle trajectory set, or raster does not belong in a Postgres column — `SimulationArtifact.storage_location` is a pointer to where it actually lives, not the data itself.

## 15. Performance

- GPU-efficient visualization (instancing, BufferGeometry, GPU particles, shaders where useful)
- Efficient particle handling — avoid one React component per particle
- Efficient timeline updates — simulation state and UI state kept separate
- WebSocket message efficiency (batched/delta updates over the telemetry channel)
- Simulation/render separation — the renderer consumes precomputed state, it does not compute physics
- Lazy loading of scenario-specific visualization layers
- Spatial optimization (e.g. spatial indexing/culling) for large-scale geospatial scenes

## 16. Security

- Environment variables for all secrets/config; never hard-code credentials
- Input validation on all scenario parameters (Pydantic models) before simulation
- Secure WebSockets (WSS in production, authenticated connections)
- API security (auth, rate limiting on scenario creation/simulation endpoints)
- File validation for any uploaded documents (RAG ingestion) — type/size/content checks
- Prompt injection protection — treat retrieved documents and user scenario text as untrusted input to the LLM
- RAG poisoning protection — validate/curate ingested sources, don't blindly trust arbitrary uploaded documents as authoritative
- Secret management via environment variables / secret manager, never committed to the repo

## 17. Architecture Decision Records

Format for future entries:

```
Decision:
Reason:
Alternatives:
Consequences:
```

See ADR-001, ADR-002, and ADR-003 (Section 13) for the decisions recorded so far. Future major decisions (LLM provider, deployment infrastructure, additional disaster model integrations, large-scientific-data storage format) must be recorded here before being silently adopted.

## 18. Repository Architecture

The repository is a monorepo split into domain directories, chosen so contributors on different Git branches
can usually work without touching another domain's files (see `docs/development/git-workflow.md` for branch
conventions).

### Top-level directories

| Directory | Owns |
|---|---|
| `frontend/` | React/TypeScript/Vite client: UI, 3D visualization, client state |
| `backend/` | FastAPI service: REST + WebSocket API, thin routes calling services |
| `simulation/` | Disaster-agnostic physics/numerical simulation engine and all disaster models |
| `agents/` | LangGraph multi-agent AI: graph wiring, agents, tools, prompts |
| `rag/` | Disaster-aware retrieval-augmented generation pipeline and source documents |
| `data/` | Environmental/geospatial data; bulk data gitignored, fixtures/samples/schemas tracked |
| `shared/` | Cross-domain schemas, types, contracts, constants — the integration surface |
| `tests/` | Cross-domain integration/e2e/contract tests (domain-local tests live inside each domain) |
| `docs/` | Supporting documentation beyond this file |
| `scripts/` | Developer utility scripts (setup, test runners, data prep) — no business logic |
| `infrastructure/` | Deployment configuration (Docker, reverse proxy, env templates) — added when needed |

### Domain boundaries

- **Frontend/3D separation:** Three.js/React Three Fiber code lives only in `frontend/src/three/`, never
  scattered inside `frontend/src/components/` or `features/`. `three/core`, `scenes`, `water`, `terrain`, etc.
  form the common rendering shell; `three/disasters/<type>/` holds disaster-specific visual layers that plug
  into that shell. UI/timeline animation (Anime.js) lives in `frontend/src/animations/`, kept separate from
  Three.js render-loop code.
- **Simulation separation:** `simulation/core/` defines the scenario/state/engine abstraction once;
  `simulation/models/<disaster>/` implements it per disaster type. Shared physics/environmental/particle
  utilities live in their own subfolders so disaster models reuse them instead of duplicating logic.
- **Agent separation:** `agents/graph/` wires the LangGraph workflow; `agents/agents/<name>/` holds one agent
  implementation each; `agents/tools/` holds what agents call (including a `retrieval/` tool that calls into
  `rag/` through its public interface, never RAG internals directly); `agents/prompts/` and `agents/schemas/`
  stay separate from orchestration code.
- **RAG separation:** `rag/` owns the full ingestion → parsing → chunking → embedding → vectorstore →
  retrieval pipeline plus `rag/sources/<category>/` for authoritative documents organized by disaster category.
  Agents never implement retrieval logic themselves.
- **Backend separation:** `backend/app/api/routes/` (REST) and `backend/app/api/websocket/` (streaming) stay
  thin; `backend/app/services/` calls into `simulation/` and `agents/` — simulation math and agent workflows
  are never implemented inline in a route handler.
- **Database separation:** `backend/app/db/` owns the SQLAlchemy layer (`base.py`, `session.py`, `init_db.py`,
  `models/`) and `backend/alembic/` owns migrations — see docs/development/database.md. Routes and services
  depend on `app.db.session.get_db`, never construct their own engine/session.

### Shared contracts

`shared/contracts/*.schema.json` (JSON Schema, draft 2020-12) is the canonical, cross-language source of truth
for every cross-domain data shape (Scenario, ScenarioVersion, SimulationState, TimelineFrame, RiskAssessment,
VulnerabilityResult, AgentRequest/Response, RAGQuery/Result, ResponseRecommendation, IncidentActionPlan,
WebSocketEvent). `shared/schemas/python/contracts.py` (Pydantic v2) and `shared/types/index.ts` are
hand-maintained mirrors for their respective languages — not code-generated, to avoid introducing a
code-generation toolchain before it's actually needed (see §22 and docs/development/database.md). `shared/constants/enums.json` is the source of truth for the string-literal enum values every mirror must match.
Frontend types and backend/agent code should import/mirror these rather than each domain inventing its own
version of the same shape.

### Testing structure

Domain-local unit tests live in `frontend/tests/`, `backend/tests/`, `simulation/tests/`, `agents/tests/`, and
`rag/tests/`. Cross-domain integration tests, Playwright e2e tests, shared fixtures, and contract tests live
under root `tests/`.

### Git collaboration principles

Directory boundaries are designed to minimize cross-branch conflicts: a contributor working a feature branch
scoped to one domain (e.g. `feature/flood-model` → `simulation/models/flood/`) shouldn't need to touch another
domain's files to land it. Cross-domain integration happens by consuming `shared/` contracts, not by editing
another domain's internals. Full conflict-prevention rules and the branch-naming convention are documented in
`docs/development/git-workflow.md`.

## 19. Git Architecture

```
main        (stable, release/demo-ready)
 ↓
develop     (integration branch)
 ↓
feature/*   (one bounded unit of work, scoped to a domain)
```

Feature branches are named after the work they do, not the domain they live in (`feature/flood-simulation`,
not `simulation`) — see `docs/development/git-workflow.md` for the full convention. Work lands on `develop`
first; `main` only receives stable, integrated, tested state.

## 20. Repository Ownership

| Domain | Directory |
|---|---|
| Frontend | `frontend/` |
| 3D visualization | `frontend/src/three/` |
| Animation | `frontend/src/animations/` |
| Backend | `backend/` |
| Simulation | `simulation/` |
| Agents | `agents/` |
| RAG | `rag/` |
| Data | `data/` |
| Shared contracts | `shared/` |
| Tests (cross-domain) | `tests/` |
| Documentation | `docs/` |

## 21. Integration Boundaries

```
Frontend ↔ Backend         REST + WebSocket contracts (shared/contracts, shared/types)
Backend  ↔ Simulation      Backend services call simulation/core's DisasterScenario interface
Simulation ↔ Agents        Agents read structured SimulationState — they never compute it
Agents   ↔ RAG             Agents call rag/ only through agents/tools/retrieval/
Backend  ↔ Frontend        WebSocket telemetry (simulation/agent state) + REST (scenario CRUD)
```

Every arrow above crosses a domain boundary through a `shared/` contract or a defined tool interface — never
through one domain reaching into another's internal files.

## 22. Shared Contract Strategy

`shared/` exists so independent branches don't invent incompatible data shapes for the same concept — e.g. the
frontend's idea of a "Scenario" must stay identical to the backend's and the agents'. Contracts defined
(schemas only, no business logic):

`Scenario`, `ScenarioVersion`, `SimulationState`, `TimelineFrame`, `RiskAssessment`, `VulnerabilityResult`,
`AgentRequest`, `AgentResponse`, `RAGQuery`, `RAGResult`, `ResponseRecommendation`, `IncidentActionPlan`,
`WebSocketEvent`.

**Cross-language approach:** the project has a TypeScript frontend and a Python backend/agents/rag, so a
contract needs to exist in both without silently drifting apart. JSON Schema (`shared/contracts/*.schema.json`)
is the canonical shape; `shared/schemas/python/contracts.py` (Pydantic v2) and `shared/types/index.ts` are
hand-maintained mirrors, kept in sync manually rather than through a code-generation pipeline — a generator
(`datamodel-code-generator`, `quicktype`, etc.) would be reasonable to introduce later if these contracts grow
large or numerous enough that manual sync becomes error-prone, but at this size it would be unnecessary
complexity (CLAUDE.md §31/§18). A mismatch between a mirror and its JSON Schema is a bug, not a design choice.

These stay small and domain-neutral — they describe data shape, not behavior. A shared contract change is
treated as a deliberate, documented, cross-domain integration change (see `docs/development/git-workflow.md`
§ Shared Contract Changes), never a silent side effect of one branch's feature work.

## 23. Frontend Framework Decision

**Decision:** React + Vite.

**Reason:** AQUASHIELD is primarily an interactive client-side visualization and real-time simulation
interface (3D/WebGL, WebSocket-driven). Vite gives a simpler development architecture for React/WebGL/WebSocket
workloads without introducing unnecessary server-side framework complexity at this stage. Next.js is not used
unless a future requirement (e.g. SSR/SEO for a separate public-facing page) makes it clearly necessary — see
ADR-001 (§13) for the full comparison and consequences.

## 24. Technology Bootstrap

What the bootstrap phase actually installed and verified (2026-09-11), separated by status. Dependency
manifests (`frontend/package.json`, root `requirements.txt`) are the source of truth for exact versions.

**IMPLEMENTED** (working, verified end-to-end):

| Piece | Verified |
|---|---|
| React + TypeScript + Vite app | builds, type-checks (`strict: true`), dev server serves |
| Tailwind CSS v4 (`@tailwindcss/vite`) | styles render via `src/styles/index.css` |
| ESLint (flat config) + Prettier | `npm run lint` passes clean |
| Vitest + React Testing Library | smoke test passes (`src/app/App.test.tsx`) |
| FastAPI backend, `GET /health` | returns `{"status":"ok","service":"aquashield-backend"}` |
| WebSocket `/ws` | accepts connection, sends heartbeat, echoes messages |
| CORS (dev-only origins) | verified frontend origin allowed via `Origin` header round-trip |
| Frontend ↔ backend connectivity | frontend's health hook fetches the live backend `/health` |
| pytest | backend health test passes |

**INSTALLED / NOT IMPLEMENTED** (dependency verified importable, no AQUASHIELD logic built on it yet):

- Three.js, React Three Fiber, @react-three/drei — a `BootstrapCanvas` renders one static mesh purely to prove
  the React → R3F → Three.js pipeline works; it is not an AQUASHIELD scene.
- Anime.js — one `useFadeIn` micro-interaction hook proves the import/integration works; no disaster animation.
- NumPy, SciPy, xarray, Shapely, GeoPandas — import-verified in the venv; no simulation model uses them yet.
- LangGraph, langchain-core — import-verified; no agent graph exists yet.
- ChromaDB — import-verified; no ingestion/retrieval pipeline exists yet.

**PLANNED** (not installed):

- Deck.gl — optional; only introduced if a large-scale geospatial layer later demonstrates a clear need beyond
  what React Three Fiber/Three.js provides.
- Rasterio — install when a simulation model actually needs raster I/O.
- Playwright — e2e testing foundation, added when there's a UI flow worth testing end-to-end.

**Known dependency compatibility constraints** (pin to these ranges until upstream catches up):

- `@react-three/fiber@9.x` requires `react`/`react-dom` `>=19 <19.3` — pinned to `19.2.8`, not the newer `19.3.0`.
- `typescript-eslint@8.70.0` requires `typescript <6.1.0` — pinned to `5.9.3`, not the newer `7.0.2` (TypeScript's
  new Go-based compiler line), until typescript-eslint adds support.

## 25. Database & Shared Contract Foundation

What the database/contract foundation phase (2026-09-11) actually built and verified — see ADR-003 (§13),
§14a (data storage split), and docs/development/database.md for full detail.

**IMPLEMENTED** (working, verified end-to-end against a real PostgreSQL 18 + PostGIS 3.6 instance):

| Piece | Verified |
|---|---|
| 10 SQLAlchemy 2.0 models (`backend/app/db/models/`) | `configure_mappers()` succeeds; all relationships load |
| Alembic migration (`backend/alembic/versions/*_foundational_schema.py`) | `upgrade head` → `downgrade base` → `upgrade head` round-trip verified clean; `alembic check` reports no drift |
| PostGIS | `CREATE EXTENSION postgis` succeeds; Point/LineString/Polygon geometry stored and queried (`ST_DWithin`, `ST_Distance`, `ST_AsText`) |
| `GET /health/db` | FastAPI → SQLAlchemy → PostgreSQL round-trip returns `{"status":"ok","database":"reachable"}` |
| `backend/app/db/seed.py` | seeds 3 scenarios (flood/tsunami/oil_spill) + versions + runs + 3 infrastructure assets (point/line/polygon) + risk assessments + a recommendation |
| `backend/tests/db/*` (12 tests) + 2 `/health` tests | all pass against the real database |
| `shared/contracts/*.schema.json` (13 JSON Schemas) | valid draft 2020-12 schemas |
| `shared/schemas/python/contracts.py` (Pydantic v2) | imports and instantiates cleanly |
| `shared/types/index.ts` | type-checks clean under `tsc --strict` |

**CONFIGURED, NOT EXECUTED IN THIS ENVIRONMENT:**

- `infrastructure/docker-compose.yml` — written and reviewed, but Docker itself was unavailable in the sandbox
  this was built in (no `docker` binary). Verification instead used a local Homebrew PostgreSQL 18 + PostGIS
  3.6 instance — same engine/extension, different launcher. Run `docker compose -f infrastructure/docker-compose.yml up -d` and confirm `alembic upgrade head && pytest` still pass before relying on it.

**PLANNED / NOT IMPLEMENTED:**

- No CRUD API endpoints beyond `/health/db` — only enough integration to prove FastAPI → SQLAlchemy → Postgres
  works, per this phase's scope.
- No automatic JSON Schema → Python/TypeScript code generation (see §22).
- No simulation engine, AI agents, or RAG ingestion writing to these tables yet — they're the target, not the
  content, of this phase.

## 26. Scenario System

The first end-to-end functional vertical slice — full detail in docs/development/scenarios.md.

```
React Scenario Builder (frontend/src/features/scenario-builder/)
        ↓
Scenario API (backend/app/api/routes/scenarios.py — thin, no business logic)
        ↓
ScenarioService (backend/app/services/scenario_service.py — domain logic)
        ↓
ScenarioRepository / SimulationRunRepository (backend/app/repositories/ — persistence only)
        ↓
PostgreSQL/PostGIS (Scenario, ScenarioVersion, SimulationRun)
        ↓
Future Simulation Engine (not implemented)
```

**The scenario system is architecturally independent of simulation physics.** `SimulationRun` records that a
run was requested and against which configuration — it never computes anything. Creating one only writes
`status = pending` metadata; the response explicitly says the simulation engine hasn't executed.

**Layering rule enforced here** (and expected of future features): routes never contain business logic,
services never build SQLAlchemy queries directly (that's the repository's job), and repositories never make
domain decisions (e.g. "should this scenario be archived" is a service decision, not a repository one).

**Schema change made this phase:** `ScenarioStatus.ACTIVE` → `ScenarioStatus.READY` (Prompt 6 specifies the
scenario lifecycle as draft/ready/archived; Prompt 5's original naming was draft/active/archived). Migration
`32b3edf8f402` renames the Postgres enum value in place (`ALTER TYPE ... RENAME VALUE`) — existing rows keep
their data, only the label changes. Updated everywhere: `backend/app/db/models/enums.py`,
`backend/app/db/seed.py`, and all three shared-contract mirrors (`shared/contracts/scenario.schema.json`,
`shared/schemas/python/contracts.py`, `shared/types/index.ts`, `shared/constants/enums.json`).

**New shared contract:** `SimulationRun` (JSON Schema + Python + TypeScript) — the first contract added since
the Prompt 5 foundation, following the same pattern. API-only request/response envelopes
(`ScenarioCreateRequest`, `ScenarioDetail`, `Page<T>`, etc.) stay backend-owned
(`backend/app/schemas/scenario.py`) and are mirrored only in `shared/types/index.ts` for the frontend — adding
a second Python definition of the same shape was avoided (§22).

**Frontend cross-domain import:** `frontend/src/features/scenario-builder/` imports `shared/types/index.ts`
directly via a `@shared/*` alias (`frontend/vite.config.ts` + `tsconfig.json`), with Vite's dev-server
`fs.allow` extended to permit reading outside `frontend/`'s own root — the first time frontend code actually
consumes `shared/` rather than just mirroring it by hand.

## 27. Simulation Engine

The deterministic, disaster-agnostic time-based simulation engine — full detail in
docs/development/simulation.md.

```
ScenarioVersion.scenario_config
        ↓
SimulationRun (backend/app/api/routes/simulation_runs.py — thin)
        ↓
SimulationService (backend/app/services/simulation_service.py — orchestration only)
        ↓
SimulationEngine (simulation/core/engine.py — standalone package, no FastAPI/SQLAlchemy dependency)
        ↓
DisasterModel (simulation/models/<type>/model.py — flood, tsunami, cyclone, oil_spill, search_rescue)
        ↓
TimelineFrame × N (simulation/core/state.py)
        ↓
SimulationArtifact (JSON file in simulation/outputs/ + PostgreSQL metadata row)
```

`simulation/` is a sibling top-level domain to `backend/` (§18/§21), not a backend-owned package, and this
monorepo has no per-domain packaging step (ADR-002) — so `backend/app/main.py` and `backend/tests/
conftest.py` each insert the repo root onto `sys.path` before any import that could reach `simulation.*`.
This is the one place that bootstrap lives; see docs/development/simulation.md for why.

**Model registry, not an if/elif chain:** `simulation/core/registry.py`'s `MODEL_REGISTRY` maps a
`disaster_type` string to a `DisasterModel` subclass. `flash_flood`/`coastal_flood` reuse `FloodModel`,
`storm_surge` reuses `CycloneModel`, `chemical_pollution` reuses `OilSpillModel` — the same reuse pattern
`backend/app/schemas/scenario_config.py`'s `DISASTER_CONFIG_SCHEMAS` already uses for config validation.

**Every model is a SIMPLIFIED DEMONSTRATION MODEL** (`flood-demo-v1`, `tsunami-demo-v1`,
`cyclone-demo-v1`, `oil-spill-demo-v1`, `search-rescue-demo-v1`) — illustrative physics only, never claimed
as scientifically validated (CLAUDE.md §12 predecessor rule / §26 this file). `DisasterModel.describe()`
returns a model card (`type`, `purpose`, `scientific_validation`, `assumptions`) persisted into every
completed run's `SimulationArtifact.extra_metadata`.

**Determinism:** same `disaster_type` + `scenario_config` + `timestep_config` + `seed` always produces the
same `TimelineFrame` sequence — required for replay/comparison (§7/§11) and auditability. No model uses
uncontrolled randomness; the engine hands every model a seeded `random.Random`, and the seed used is
recorded in `SimulationRun.timestep_config["seed"]` on completion.

**Lifecycle:** `PENDING` (Prompt 6, unchanged) → `RUNNING` → `COMPLETED`/`FAILED`, driven by `POST
/simulation-runs/{run_id}/execute`. A run executes at most once — re-running means creating a new
`SimulationRun` against the same (or a different) `ScenarioVersion`, never resetting an existing run's
status. Execution is currently synchronous — a documented Prompt 7 §26 prototype choice, not an oversight;
introducing a job queue (Celery/Redis) is a future, explicitly-instructed change, not a default.

**Storage:** per §14a, PostgreSQL never holds full timestep data — `SimulationService` writes one JSON file
per run to `simulation/outputs/{run_id}.json` (gitignored) and a `SimulationArtifact` row pointing at it.
This is the prototype storage strategy Prompt 7 explicitly sanctions; a future phase can replace the file
format (NetCDF/Zarr/object storage) without changing the `SimulationRun`/`SimulationArtifact` schema or the
timeline API shape.

**API:** `GET /simulation-runs/{run_id}` (detail), `POST /simulation-runs/{run_id}/execute` (run, returns
the same detail shape), `GET /simulation-runs/{run_id}/timeline` (all frames — empty before execution).
Distinct from `POST /scenarios/{id}/runs` (Prompt 6, creates `PENDING` metadata only) — creation and
execution stay separate endpoints, per Prompt 7 §26.

**Not yet built** (later phases, per Prompt 7's explicit hard stop): 3D visualization consuming these
frames (Prompt 8), WebSocket streaming of frames as they're produced (Prompt 9), a risk engine reading
`SimulationState.hazard_state`/`environmental_state` (Prompt 10), AI agents/RAG interpreting this output
(Prompts 11-12).

## 28. AAA 3D Command Center & Landing

The first visually complete AQUASHIELD experience — full detail in docs/development/command-center.md.

```
Landing ("/")  ->  Explore gateway ("/explore")  ->  Command Center ("/command-center", lazy-loaded)
                                                            |
                                                            v
                                      Scenario -> SimulationRun -> Simulation API (Prompt 7)
                                                            |
                                                            v
                                      TimelineFrame -> simulationVisualAdapter -> SceneRoot
                                                            |
                                                            v
                                      disasters/registry.ts -> one visualizer per disaster family
```

`react-router-dom` was added here — the router ADR-001 (§13) deferred until routing was actually needed.
`frontend/src/three/` is now a real scene graph (`AquaCanvas`/`SceneRoot`/`CameraController`/
`LightingSystem`/`EnvironmentSystem`, a custom water shader, procedural terrain, instanced particles) built
on the bootstrap-phase Three.js/R3F/Drei foundation (§24), and `frontend/src/animations/` is now a real
Anime.js v4 utility layer (presets/transitions/scroll/stagger/cleanup) built on the bootstrap-phase
integration proof.

**The seam that matters:** `three/adapters/simulationVisualAdapter.ts` translates a real Prompt 7
`SimulationState` into a `SimulationVisualState` — disaster visualizers never read `hazard_state` directly,
and the mapping (e.g. `wave_height_m` → visual intensity) is documented as a rendering convenience, never
an invented physical formula (CLAUDE.md §5/§27). `disasters/registry.ts` mirrors
`simulation/core/registry.py`'s model registry pattern client-side, including the same disaster-type reuse
decisions (`flash_flood`/`coastal_flood` → flood, `storm_surge` → cyclone, `chemical_pollution` → oil
spill).

**Shared contract addition:** `SimulationRunDetail`, `SimulationArtifactOut`, `TimelineResponse` were added
to `shared/types/index.ts` (§22) — mirroring `backend/app/schemas/simulation.py` — since the command center
is their first frontend consumer. Nothing existing was changed, only added to.

**Explicitly not implemented in this phase** (see docs/development/command-center.md for the full
IMPLEMENTED/VERIFIED/SIMPLIFIED/PLANNED/NOT IMPLEMENTED breakdown): timeline playback/scrubbing/WebSocket
streaming (Prompt 9), risk/vulnerability analysis (Prompt 10), AI agents/RAG/response planning
(Prompts 11-13), and — notably — automated WebGL scene-render testing and live browser visual verification,
both blocked by environment limitations documented there rather than skipped silently.

### 28a. Prompt 8.1 — Visual correction

A visual-only correction pass (`feature/visual-correction`), not a re-architecture: the landing page's
stacked-section scroll (`ScrollSequence`/`LandingBeatSection`) was replaced with `CinematicScroll` — one
sticky viewport whose six scenes crossfade continuously off a single scroll-progress value
(`sceneProgress.ts`, pure and unit-tested) instead of six independently-animated cards. In the command
center, `AquaCanvas`'s camera pose, `Landmass`'s scale/relief/color ramp/position, the water shader's
fresnel/specular terms, and `EnvironmentSystem`'s atmosphere (added drei's procedural `Sky`) were all
corrected against a specific reported symptom (documented per-symptom in
docs/development/command-center.md's "Prompt 8.1 — Visual correction" table) — the scene graph's shape
(`SceneRoot`'s composition, the disaster registry/adapter seam) is unchanged. No shared contract, routing,
or backend change.

### 28b. Prompt 9 — Timeline Playback Engine

`feature/timeline-playback` extends `useCommandCenterSession`'s existing single-frame selector
(`frames`/`frameIndex`/`setFrameIndex`/`currentFrame`) into full client-side playback — `isPlaying`,
`playbackSpeed`, `play()`, `pause()`, `togglePlay()`, `setPlaybackSpeed()` — driven by a `setInterval` that
advances `frameIndex` over the `TimelineFrame[]` already fetched from Prompt 7's timeline endpoint. No
backend, WebSocket, or shared-contract change: this is 100% client-side pacing over data the app already
has. The interval's pacing (600ms/1x, scaled by the speed multiplier) is a documented UI convenience, not a
physical or simulated timing value — `TimelineFrame` carries no duration/fps field to derive one from.
Playback stops (never loops) at the last frame, and is force-paused whenever the active scenario/run changes
or the timeline reloads/empties, so a stale interval can never advance a `frameIndex` belonging to a
different run. A new `PlaybackControls` component (Play/Pause, a 0.5x–4x speed selector, the existing scrub
slider) integrates into `SimulationStatusPanel`'s existing frame area — no second slider, no new 3D/animation
system; the scene keeps reacting through the existing `toVisualState`/registry seam one frame at a time.
Full detail, including the interval/auto-pause state machine and its test coverage
(`useCommandCenterSession.test.ts` with Vitest fake timers), in docs/development/command-center.md's
"Prompt 9 — Timeline Playback Engine" section.

### 28c. Prompt 9.1 — Complete Disaster Catalog

A completion pass, not new architecture: all 9 `DisasterType` values were already validated
(`DISASTER_CONFIG_SCHEMAS`), already resolved to a real simulation model (`MODEL_REGISTRY`), already
selectable end to end in the Scenario Builder (`disasterFieldSpecs.ts`/`ScenarioForm.tsx`), and already
resolved to a visualizer (`three/disasters/registry.ts`) — Prompt 6/7/8's own parallel-registry pattern
(CLAUDE.md §25) already covered the full catalog. What was actually missing was *discoverability* and
*polish*: the Command Center's scenario selector only lists `status="ready"` scenarios, and the seed data
had only 2-3 of the 9 types in that state — fixed with an idempotent `_ensure_scenario` helper in
`backend/app/db/seed.py` (name-keyed lookup, safe to re-run, backfills exactly the missing types rather than
a destructive full reseed) plus a "New scenario" link (`ScenarioContextPanel.tsx` → `/scenarios`) so users
aren't limited to whatever happens to be seeded. A new read-only `GET /disaster-types` endpoint
(`backend/app/core/disaster_catalog.py` → `app/schemas/disaster_catalog.py` → `shared/types/index.ts`'s
`DisasterCatalogEntry`) is additive discovery/documentation metadata only — it introspects the *existing*
`DISASTER_CONFIG_SCHEMAS`/`MODEL_REGISTRY` rather than becoming a second source of truth, and does not
replace `disasterFieldSpecs.ts` as the Scenario Builder form's live data source (CLAUDE.md §25's
hand-kept-in-sync parallel-registry decision stands). The Scenario Builder's form components
(`ScenarioForm.tsx`, `FormField.tsx`, `DisasterParameterFields.tsx`) were restyled onto the Prompt 8 design
tokens/`components/ui` primitives, replacing raw Tailwind slate/sky classes that predated that system. Full
detail — including the fact-checked parameter-consumption honesty table (which exposed fields each of the 5
underlying models actually reads vs. accepts-but-ignores) — in docs/development/scenarios.md.
