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
Documents (rag/sources/ — real authoritative sources only; rag/tests/fixtures/ for TEST_FIXTURE material)
  ↓
Parser (rag/parsing/ — md frontmatter, txt/pdf + sidecar .meta.json)
  ↓
Chunker (rag/chunking/ — 500-1000 "tokens", section/page-aware, never spans a section change)
  ↓
Embedding (rag/embeddings/ — DeterministicHashEmbedding by default, no network/credits)
  ↓
ChromaDB (rag/vectorstore/ — one `aquashield_evidence` collection, cosine distance)
  ↓
Hybrid Retriever (rag/retrieval/ — role-scoped query + disaster-type metadata filter + relevance threshold)
  ↓
evidence_retrieval graph node (agents/graph/workflow/graph.py) → Precaution / Response agents
```

Implemented (Prompt 16): §30b, docs/rag/pipeline.md. The knowledge base is organized by disaster category
(flood, cyclone, tsunami, oil_spill, pollution, search_rescue, environmental, general — matching
`rag/sources/`'s folder taxonomy) so retrieval is scoped by the active scenario's disaster type, plus
"general" cross-cutting guidance, never just free-text similarity across every source.

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

### ADR-004: Firebase Authentication with server-side PyJWT verification

Decision: Firebase Authentication (Google + email/password + password reset) on the frontend via the
Firebase JS SDK; the FastAPI backend verifies Firebase ID tokens itself with `PyJWT[crypto]` against
Google's published x509 certs (`backend/app/core/auth.py`) and needs only `FIREBASE_PROJECT_ID`.
Reason: user isolation has to be enforced server-side (every scenario/run row carries the verified
`owner_uid`), and verifying RS256 tokens against Google's certs needs no service account and no
`firebase-admin` (which drags the google-cloud dependency tree in for one function). No Firebase MCP
server was available in the build environment; the SDK path is the supported one regardless.
Alternatives: `firebase-admin` (heavier, needs credentials for anything beyond verification); a
self-hosted auth (out of scope); trusting a client-sent uid (rejected — trivially spoofable).
Consequences: `scenarios.owner_uid` is NOT NULL (migration `5b2f9c1d7e10`; existing scenario data was
wiped first via `scripts/wipe_scenario_data.py`). A scenario owned by another user reads as 404, never 403.
An explicit, env-gated local-development bypass exists on both sides (`AUTH_DEV_BYPASS_UID` /
`VITE_AUTH_DEV_BYPASS`) and is ignored in production builds.

### ADR-005: One synthetic shoreline world + a client-side propagation mirror

Decision: every disaster type runs in the same synthetic 300 km "demo shoreline world" (ocean west of an
analytic shoreline curve, land east — `shared/constants/demo_world.json`, `simulation/core/propagation.py`)
with a common propagation parameter block (origin, heading, speed, intensity, spread radius, dispersion)
inside `scenario_config`. The frontend carries a line-for-line TypeScript mirror
(`frontend/src/propagation/`) of the world and of the four demo models' formulas, pinned by fixtures the
Python side generates (`scripts/generate_propagation_fixtures.py` → `shared/fixtures/propagation_cases.json`
→ `mirror.test.ts`).
Reason: real-time interaction (drag the origin, move a slider, see the hazard trajectory change on the
same frame) cannot round-trip through HTTP per frame, and creating a `SimulationRun` per slider tick would
be absurd. The mirror gives instant feedback; the Python engine stays the authoritative record — "Record
run" executes the same formulas server-side and the console can replay that recorded timeline read-only.
Real-world lat/lon, Natural Earth coastlines, Esri imagery and infrastructure exposure were dropped from
the console: they conflicted with the product decision to have no real-world place names or coordinates.
Alternatives: server round-trips (too slow, DB spam); WebSocket streaming of a live server simulation
(deferred by CLAUDE.md §26's synchronous-execution decision); dropping the backend models (would break
the SIMULATE → VISUALIZE record and the determinism guarantee).
Consequences: `simulation/` and `frontend/src/propagation/` must change together — the fixture test is the
tripwire. The geospatial endpoints (`/hazard-footprints`, `/exposure`, `/impact`) still exist but report
`partial`/zero exposure for demo-world runs (no real geometry), which their tests now assert.

### ADR-006: Read-only LangGraph AI layer with a deterministic local provider

Decision: the AI intelligence layer (`agents/`) is a LangGraph state graph of three agents plus a
synthesis/safety join, reading simulation and geospatial data only through a six-method read-only
Protocol the backend implements over its existing owner-scoped services, and writing only its own
`ai_requests` audit table. Every claim must cite evidence produced by the Context Collector; the validator
strips anything else. An `LLMProvider` abstraction ships with a deterministic offline provider (default) and
an Anthropic SDK provider.
Reason: CLAUDE.md §5/§12/§13 — the AI interprets, it never invents water levels, arrival times or damage;
explainability requires an evidence chain; development and CI must not need paid API credits.
Alternatives: free-form LLM chat over raw JSON (rejected — ungrounded numbers), agents with write access
to recommendations tables (deferred — every output is human-gated first), a single-agent prompt (rejected —
the parallel analyst/advisor split keeps impact facts and operational advice separately auditable).
Consequences: synchronous execution per request (same prototype choice as simulation); UI only gains an
additive brief panel. RAG was deliberately deferred at this decision point and landed later as its own
package (§30b, ADR-008) behind the same `EvidenceRetriever` Protocol this ADR defines — `NOT_CONFIGURED` is
still the default (`RAG_PROVIDER=none`) until an operator ingests real sources. See docs/agents/ai-layer.md.

### ADR-008: Standalone `rag/` package with a deterministic local embedding provider, wired in as one graph node

Decision: `rag/` (parser → chunker → embedder → ChromaDB → hybrid retriever) is standalone, on the same
architectural footing as `simulation/` and `agents/` — no FastAPI/SQLAlchemy import anywhere in it. The
analysis graph gains one node, `evidence_retrieval`, between Tier 1 and Tier 2, producing a role-scoped
`EvidencePack` for the Precaution and Response agents each. `EmbeddingProvider` mirrors `LLMProvider`'s shape
(ADR-006): `DeterministicHashEmbedding` — a bag-of-hashed-words vector, no network, no credits — is the
default and what every test runs against; a hosted embeddings API is a documented gap, not an invented
integration (Anthropic has no embeddings endpoint). The Postgres source registry (`rag_sources`,
`rag_ingestion_log`) is bridged by one backend service (`RagIngestionService`), the same pattern
`ai_data_access.py`/`simulation_service.py` already establish.
Reason: CLAUDE.md §11/§26b — the knowledge base must be disaster-aware, never fabricate a citation, and the
existing domain-isolation and offline-by-default conventions (ADR-002, ADR-006) should not be broken to add
it.
Alternatives: embedding RAG logic inside `agents/` (rejected — rag/README.md's stated boundary, and it would
give the AI layer an implicit second data-access path outside `AnalysisDataAccess`); a hosted embeddings API
as the only provider (rejected — blocks offline development and CI on a paid, networked dependency); scoring
citations by trusting whatever an LLM returns (rejected — `SafetyValidator.validate_citations` re-checks
every id against the actual `EvidencePack`, the same evidence-gate discipline as simulation facts).
Consequences: retrieval quality is bounded by the local hash embedding's crude bag-of-words semantics until
a real embedding model is wired in; `RAG_PROVIDER=none` keeps every existing AI-layer behaviour and test
unchanged until an operator explicitly opts in and ingests sources. See §30b, docs/rag/pipeline.md.

### ADR-009: A narrow, curated exception to "no real place names" for genuinely real coastline/building geometry

Decision: exactly five curated Indian coastal cities (Chennai, Mumbai, Puri, Visakhapatnam, Kochi) may be
selected as a scenario's `world_profile: "real_city"` + `city_id` (`PropagationConfig`, both optional,
cross-validated: one implies the other). Selecting one swaps the fictional demo shoreline's sine-curve
constants and generic building field for that city's real Natural Earth coastline (curve-fit into the
*same* 3-term-sine `shore_x` parametrization every consumer already expects, never a polyline rewrite) and
real OpenStreetMap building footprints (generic `StructureType`s only — a real hospital's OSM tag becomes
the type `"hospital"`, never its real name). Physics is unchanged: the same simplified propagation/exposure
model as every other scenario, explicitly not extended to bathymetry-driven solvers in this phase. Every
`real_city` scene carries a persistent label: "Real coastline & building geometry. Simplified demonstration
physics — not an operational forecast" (`TelemetryPanel`). See §28c.
Reason: CLAUDE.md §25/§27 and ADR-005 forbid a real place name/coordinate on the fictional world because
simplified-demo-physics + a real named place reads as a real risk assessment — a genuine liability concern
specific to *fictional* geometry wearing a real name. Once the geometry (coastline shape, building
positions) is genuinely real and the UI discloses that physics stays simplified, naming the city stops
being that harm.
Alternatives: keep the blanket ban (rejected — unreachable without some exception); allow an arbitrary
user-entered city/coordinate (rejected — reopens the original liability concern for any place, not five
reviewed ones, and skips fit-quality review); real geometry under a generic/fictional name (rejected — this
is exactly what §28b's Dense Coastal Profile already is; doesn't meet the actual requirement).
Consequences: `scripts/build_town_data.py` and its output (`shared/constants/towns/*.json`) are the only
path real lat/lon or real building data enters the repo — never fetched at runtime, always a reviewed,
committed data change. Both `frontend/src/propagation/*` (live preview) and `simulation/core/propagation.py`
(the authoritative recorded-run engine) read the same per-scenario shore override, so a recorded run's
physics stays geometrically consistent with what renders — this took real code changes on both sides
(§25/§26's mirroring discipline extends to a per-scenario shoreline, not just the one fixed constant set).
Phase 1 ships Chennai only; the other four cities are commented into the script's `CITIES` table with real,
verifiable centers, pending their own fit-quality validation before being committed.

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

See ADR-001 through ADR-006 (Section 13) for the decisions recorded so far. Future major decisions (LLM provider, deployment infrastructure, additional disaster model integrations, large-scientific-data storage format) must be recorded here before being silently adopted.

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
- LangGraph, langchain-core — BOOTSTRAPPED (Prompt 14/15, §30/§30a): the 9-node analysis graph.

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

### 28d. Prompt 10.1 — Connect and Visualize Geospatial Impact Data

A corrective integration pass, not new architecture: Prompt 10 built real PostGIS-backed geospatial
infrastructure (`geographic_datasets`/`geographic_features`, an ingested Natural Earth coastline dataset,
hazard-footprint/exposure/impact analysis, and their REST endpoints) that a diagnostic audit found the
Command Center never actually displayed — not because the backend was broken, but because
`useCommandCenterSession` auto-selected `runList[0]` (the newest `SimulationRun` by `created_at`,
regardless of status), which could pick a freshly-created `PENDING` run over an older `COMPLETED` run that
already had real hazard/exposure/impact data sitting in the database.

Fixed with a documented, testable priority rule rather than a one-line reorder:
`backend/app/services/run_selection.py`'s pure `select_default_run_id` picks the latest `COMPLETED` run
that actually has `frame_count > 0` (verified via `SimulationArtifact.extra_metadata`, never assumed from
status alone), falling back to the latest `RUNNING`, then latest `PENDING`, and never auto-selecting
`FAILED`/`CANCELLED` (those remain reachable only through the new `RunSelector.tsx`'s explicit choice).
`ScenarioService.get_default_run` applies it; `GET /scenarios/{id}/runs/default` exposes it;
`SimulationRunOut`/`SimulationRun` (shared contract) gained a `frame_count` field so the run list and the
default-run lookup both carry real counts with no extra per-run round trip.

Once run selection was fixed, `useDataLayers`'s existing hazard-footprint/exposure fetches (already keyed
correctly on `frameIndex`) started working as designed; this phase added the one piece that was actually
missing — a per-frame `getImpact(runId, frameIndex)` fetch and a dedicated `ImpactPanel.tsx` — plus a new
`GeographicContextPanel.tsx` (real scenario coordinates, coastline provenance derived from the live
`GET /geographic-features/nearby` response, an honest "Synthetic demo assets" infrastructure label, and
explicit Elevation/Terrain limitations). `three/core/SceneRoot.tsx` now carries a comment explaining why
two hazard-visual systems deliberately coexist: the per-disaster-type `Visualizer` (registry-resolved,
stylized) and `HazardFootprintLayer` (real Polygon/Point geometry from `GET .../hazard-footprints`) — the
former is kept as the earlier prompts' "read clearly" visual language, the latter is what this phase's
Data Layers/Impact panels actually reason about. No DEM/elevation/rasterio was introduced — terrain stays
procedural, labeled as such everywhere it's shown. Full detail: docs/geospatial/impact-visualization.md.

### 28e. Prompt 11 — Console redesign, real satellite basemap, water rewrite

A visual/structural correction pass across the frontend. Three problems were addressed, each with a
different kind of fix.

**1. Layout was structurally broken, not just unstyled.** The Command Center's panels were absolutely
positioned overlays inside the 3D viewport. Below a very wide window the left stack overflowed its own
container and collided with the simulation panel, and the Data Layers buttons wrapped outside their card.
`CommandCenterPage.tsx` is now an explicit three-column grid — a fixed-width left rail, the viewport, a
fixed-width right rail — where each rail is an independently scrolling column with `min-h-0`. A long panel
now scrolls inside its own rail and cannot overlap anything. Below `xl` the grid collapses to one column
with a fixed-height viewport. Panels moved to a `flush` `CommandPanel` variant (no radius, no side borders)
so a rail reads as one instrument stack rather than a pile of floating cards.

Two panels were split out so neither column has to hold two unrelated questions at once:
`HazardMetricsPanel.tsx` (what the current frame reports — the adapter's own label, timestep, radius, and
the backend footprint's intensity/geometry) and the existing `ImpactPanel` (what that means for assets).
`ViewportChrome.tsx` adds non-interactive corner annotation over the canvas: per-disaster colour keys, the
exposure key, the real view extent, and data provenance. It is `pointer-events-none` as a whole so it can
never intercept an orbit drag.

**2. Design language.** Tokens were rebuilt around a flat emergency-operations console: IBM Plex Sans/Mono
(tabular numerics on every readout), a 3-step neutral elevation scale, 3-4px radii, and hairline rules.
`--shadow-glow-accent` was deleted rather than re-tuned — a coloured halo around a border is now a banned
effect, and `LiquidMetalButton` was rebuilt as an unblurred machined rim instead of a blurred conic glow.
A single inline SVG icon set (`components/ui/icons.tsx`, one grid, one stroke width) replaced ad-hoc glyphs
and the one emoji that had reached the UI. New primitives: `Toggle` (a real `role="switch"`, which is what
the Data Layers controls always were semantically), `MetricTile`, `SeverityBadge`, `LegendBar`.

**3. The 3D world.** Three independent changes, in order of visual weight:

- **Scene scale (`SCENE_UNITS_PER_KM` 0.12 → 1.1).** This was the root cause of "the disaster is a speck".
  The old scale made the visible world ~2,300 km across, so a 20 km hazard footprint projected to 2.4 units
  inside a 280-unit terrain plate. The plate is now 320 units ≈ 291 km — a regional view — and that same
  footprint projects to 22 units. `geoProjection.ts` owns the constant, the plate size, and the derived
  `SCENE_WORLD_SPAN_KM` so terrain and basemap cannot disagree about how much ground is on screen.
- **Automatic framing (`CameraController`).** The camera previously sat at a fixed world position regardless
  of where the hazard was. It now slews its orbit target onto the focal point and pulls to a distance that
  fits the hazard radius at the current FOV. `SceneRoot` derives both (hazard centre when the model reports
  one, else the scenario origin) — composition is decided in exactly one place, never by a visualizer. Any
  manual orbit input cancels the slew permanently; `prefers-reduced-motion` applies it as an instant cut.
- **Water (`shaders/water.ts`).** Rewritten from stacked sine displacement to six Gerstner components with
  analytic normals, plus a real water shading model (Schlick fresnel over a sky-gradient reflection,
  depth-tinted body colour, wrap lighting, forward scatter through crests, tight specular + noise-broken
  glitter, steepness-driven foam, distance fade to the horizon). The plane went from 64 to 320 segments,
  because Gerstner displacement is per-vertex and the old grid could not represent a crest. ACES tone
  mapping was enabled on the canvas — the specular terms deliberately exceed 1.0 and were previously
  clipping to flat white.

**New: a real satellite basemap (`three/terrain/satelliteBasemap.ts`).** Esri World Imagery XYZ tiles
(public, key-free, CORS-enabled) are stitched into one canvas covering exactly the terrain plate's ground
footprint, centred on the scenario's real coordinates, and used as the plate's texture. This is the one
place in `three/` that renders genuinely real-world data rather than synthetic geometry, and the boundary is
drawn carefully:

- Imagery is **not** elevation. The plate's *shape* stays procedural; no DEM is ingested, and
  `GeographicContextPanel` still reports elevation as unavailable, because that remains true.
- A land/water mask is derived from the imagery by a documented colour heuristic (open water is darker and
  bluer) purely so the animated water surface meets the coastline visible in the picture instead of
  contradicting it. It is a rendering convenience, is never analysed, and is never displayed as a
  measurement. Exposure/hazard-footprint/impact remain server-side PostGIS results.
- Failure is a first-class path: offline, blocked, CORS-refused or a partially-loaded grid all resolve to
  `status: "unavailable"` and the plate falls back to the previous procedural vertex-colour terrain. The
  real status is surfaced in the UI (Geographic Context "Satellite" row, viewport provenance line) — the app
  never claims imagery it doesn't have. Attribution is a licence obligation and is always rendered.

No Google Maps/SerpAPI dependency was introduced: that route needs a paid key and returns place *data*, not
basemap tiles, so it could not have produced this view. No new npm dependency was added for any of the above.

**Honesty corrections.** The `/explore` gateway had acquired fabricated telemetry — a fixed
"CHENNAI_SECTOR_01" identifier, a hardcoded lat/lon, a "60_FPS_ACTV" readout, a "3D SENSOR GRID READY"
status, and a claim of "hydrodynamic storm surge modeling". None of it was real. It was replaced with a
statement of what the console actually contains (CLAUDE.md §12/§26/§27). The header's ANALYZE/RESPOND/REPORT
modes are rendered as explicitly unavailable (`aria-disabled`, muted, "planned" tooltip) rather than as live
tabs that would do nothing.

### 28a. World scenery: vegetation and structural response

`three/vegetation/` plants ~4,000 instanced trees on the land plate, placed by a JS twin of the noise the
terrain material paints its forest patches with, and animated entirely in the vertex shader (sway, and a
laid-over desaturated canopy inside a hazard's current inland reach). Six draw calls; one module-level
uniform block, the same pattern as `hazardChannel`.

`three/structures/support.ts`'s `footprintGround` seats a structure on the highest ground under its footprint
with a foundation reaching past the lowest, so nothing floats or buries on the sloping plate.

`three/structures/collapse.ts` draws the exposure band as structural failure: lean through `at_risk`, pieces
failing and crumbling across `impacted`, the structure down inside `severe`, toppled downstream of the
hazard. It is an **illustration of the band, not a damage model** —
AQUASHIELD has none — it is a pure function of the current exposure (so it reverses when the timeline is
scrubbed back), it imports its thresholds from `propagation/structures.ts`, and the UI states the caveat
alongside the statuses (CLAUDE.md §25). Detail: docs/development/command-center.md.

### 28b. Dense Coastal Profile — a flat-canvas world variant

`scenario_config.world_profile` (`"demo" | "dense_coastal"`, `PropagationConfig`, optional, defaults to
`None`/"demo") is a purely cosmetic 3D-rendering choice — never a real place, never read by the Python
simulation engine (CLAUDE.md §25/§27). `"dense_coastal"` flattens the land-side branch of
`terrainHeightKm`/`DEMO_WORLD_GLSL` (`three/world/demoWorld.ts`) to a constant, leaving the sea-floor branch
and `landDepthKm`/`shoreX` (the land/sea boundary) untouched — hazard physics is provably identical between
profiles. `ForestLayer` is suppressed and replaced with `three/urban/DenseBuildingLayer.tsx`, a fictional,
procedurally generated instanced-building field (`buildingPlacement.ts`, same deterministic-grid technique
as `forestPlacement.ts`) whose exposure tint (Clear/Amber/Red) reuses the exact
`exposureFor()`/`statusFor()` functions and `STATUS_COLOR` palette named structures already use — no second
exposure model. Toggled from the "New test" modal or the TopBar (`TopBar.tsx`'s world-profile button),
persisted as an ordinary `scenario_config` edit like every other parameter. RAG grounding for this profile
needed no code changes — real NDMA/IMD sources were added to the existing `rag/sources/` categories
(tsunami/cyclone/flood), surfacing via the existing disaster-type-filtered retrieval for any matching
scenario, dense-canvas or not.

### 28c. Real City mode — curated real coastline/buildings (ADR-009, phase 1: Chennai)

`scenario_config.world_profile: "real_city"` + `city_id` (one of the five curated cities) swaps the
fictional shoreline/buildings for a real one. Data flow: `scripts/build_town_data.py` (a one-time,
rerunnable developer tool, network access at prep time only) fetches Natural Earth's 10m coastline for a
bbox around the city, resamples and fits it to `shore_base_x_km` + three `{amp, freq, phase}` sine terms
via `scipy.optimize.curve_fit` (Chennai: 0.52 km RMSE over 134 resampled points — a close-to-straight coast
is the best fit candidate; the fit is deliberately frequency-bounded to approximate general curvature, not
trace every inlet), and fetches OpenStreetMap building footprints via Overpass (`way["building"]` in the
same bbox; height from `height`/`building:levels` tags with a documented fallback table; footprint
orientation from the polygon's minimum-rotated-rectangle axis, not random). Output:
`shared/constants/towns/<city_id>.json` (`TownProfile` — `shared/types/index.ts`), containing only km-frame
numbers and generic `StructureType`s, never real lat/lon or a real building's name.

Both consumers read the same file directly, one source of truth (no hand-synced duplicate constant set like
the fictional world's Python/TS pair): `frontend/src/features/command-center/towns.ts` bundles it at build
time via `import.meta.glob` (auto-discovers whichever cities are actually committed, so a partial rollout
never breaks the build); `simulation/core/propagation.py`'s `shore_params_for_city()` `json.load()`s it
directly from `shared/constants/towns/` at run time, raising `SimulationConfigError` rather than silently
falling back to the fictional shoreline if the file is missing.

Every function keyed on shoreline position gained an optional `shore`/`ShoreParams` override, defaulting to
the fictional constants, so every existing call site is provably unaffected: `shore_x`/`is_land`/
`distance_to_coast_along_heading`/`nearest_shore_distance`/`PropagationParams` (Python and the TS mirror),
`terrainHeightKm`/`landDepthKm` and their GLSL twin in `DEMO_WORLD_GLSL` (the shoreline's sine terms became
GLSL *uniforms* — `uShoreBase`/`uShoreAmp`/`uShoreFreq`/`uShorePhase` — rather than baked shader-source
constants, so switching cities never needs a shader recompile), `exposureFor`/`assessStructures`/
`inlandDepthKm`, and the origin-pin/structure drag-clamps. `three/urban/DenseBuildingLayer.tsx` renders a
real city's buildings via `realTownPlacements.ts`'s `placementsFromTown()` (maps each committed
`TownPlacement` through the same instancing/exposure-tint path §28b's fictional `buildingPlacement.ts`
already established) instead of the procedural generator.

UI: a third "Real City" option in `NewTestModal.tsx`'s world radiogroup opens `CityPicker.tsx` (a
decorative, schematic India outline with pins — not GIS data — only cities with committed data are
selectable); `TelemetryPanel.tsx` renders the mandatory ADR-009 disclosure label and a real, computed
impacted/total building count using the same `exposureFor()`/`statusFor()` functions.

## 29. Authenticated Interactive Console (Prompt 12)

The console was rebuilt around three decisions: Firebase Authentication with per-user data isolation
(ADR-004), one synthetic shoreline world with a client-side propagation mirror (ADR-005), and in-situ
scenario creation (the standalone `/scenarios` builder route is gone; `/scenarios` redirects).

```
Landing ("/")  ->  Sign-in gateway ("/explore", Firebase)  ->  warp  ->  Command Center ("/command-center")
                                                                              |
      New test (name + generic preset)  ->  POST /scenarios (owner_uid = verified uid)
                                                                              |
      Inline HUD sliders / draggable origin pin  ->  PropagationParams (live)  ->  autosave as a new
                                                                                    ScenarioVersion
                                                                              |
      LIVE PREVIEW: frontend/src/propagation (mirror) -> HazardSnapshot per frame -> three/hazard/hazardChannel
                                                                              |
      Record run: POST /scenarios/{id}/runs + /execute  ->  simulation/ (authoritative)  ->  REPLAY (read-only)
```

Frontend structure: `features/auth/` (provider, guard, token getter), `api/client.ts` (the one HTTP
client, attaches the bearer token), `features/command-center/` (session hook, playback clock, HUD
components, presets), `propagation/` (the mirror), `three/world/demoWorld.ts` (km ↔ scene + GLSL twin of
the shoreline/terrain functions), `three/hazard/hazardChannel.ts` (visualizer → water-shader uniforms at
frame rate, no React state), `three/markers/OriginPin.tsx` (drag on the y=0 plane, clamped to water).

Watertight shoreline: the water fragment shader evaluates the same `terrainHeightKm` the terrain mesh was
built from and discards itself wherever land is above the surface; swell amplitude is damped to zero over
the last 25 km. A coastal flood / tsunami run-up extends the surface inland by the model's inundation
reach, riding on that same terrain function.

**Structures (Prompt 13).** `scenario_config.structures` (validated `StructureConfig`s in world km) are
rendered by `three/structures/` and assessed every frame by `simulation/core/structures.py` (Python, fills
`infrastructure_impacts`) and its mirror `frontend/src/propagation/structures.ts` (live preview) — the same
fixture tripwire as the propagation mirror. Exposure is an illustrative 0-1 band per hazard kind (tsunami
run-up sector, cyclone wind field, oil at the coast, flood inundation stretch), never a damage model.

Backend: `app/core/auth.py`, `app/api/routes/auth.py` (`GET /auth/me`), owner scoping through
`ScenarioRepository.get/list` → `ScenarioService(owner_uid)` → `SimulationService(owner_uid)` →
`ImpactService(owner_uid)`; `PropagationConfig` in `app/schemas/scenario_config.py`; the four demo models
rewritten on `simulation/core/propagation.py` (`*-demo-v2` identifiers). `search_rescue` keeps its v1
model (no shoreline visual, not offered as a preset).

## 30. AI Intelligence Layer (Prompt 14, extended in Prompt 15)

```
POST /ai/analyze-frame ──► AIAnalysisService ──► run_analysis(GraphDeps)
                         │                      │
                         │   START → context_collector
                         │              ├─(conditional: no analysable frame → safety_validator)
                         │              └─► { hazard_agent ‖ damage_agent ‖ risk_agent }
                         │                        └─► evidence_retrieval ──► rag/ (role-scoped EvidencePack, READ)
                         │                                  └─► { precaution_agent ‖ response_agent }
                         │                                            └─► safety_validator → command_synthesizer → END
                         │                      │
                         │   Agent → ToolRunner → BackendAnalysisDataAccess → Scenario/Simulation/Footprint/Exposure services → repositories → PostGIS/DB (READ)
                         ├──► AIEventBus (per-owner, in-process) ──► /ws/ai ──► Agent Execution HUD
                         └──► ai_requests row (status, provider, model, prompt/agent versions, tools called, execution_ms, CommandBrief)   (the only WRITE)
```

Detail and guardrails: docs/agents/ai-layer.md. Contracts: `agents/schemas/*.py` (Python source of truth),
`shared/types/index.ts` (`CommandBrief`, `AIRequestOut`, `AIEvent`, …).

### 30a. Frame-synchronised analysis (Prompt 15)

The deterministic layer updates every frame; the agent graph must not. Three mechanisms keep the two in step
without freezing the UI or spending a graph run per frame:

| Concern | Where it lives | Rule |
|---|---|---|
| Pacing | `frontend/src/features/command-center/ai/analysisScheduler.ts` | playback: ≤ 1 analysis per `AI_UPDATE_INTERVAL_MS` (5 s); scrub: debounced `AI_SCRUB_DEBOUNCE_MS` (600 ms); pause / run-complete / manual: immediate |
| Caching | same file | key `(scenario_version_id, simulation_run_id, frame_index)`; the whole cache is dropped when the scope (scenario + version + run) changes |
| Staleness | scheduler (client) + `AIAnalysisService` (server) | a response whose scope changed, or which a newer frame's request has superseded, is discarded; a request naming a version the run was not produced from is refused `409 AI_ANALYSIS_STALE` |

Execution stays synchronous (§27's prototype choice). Liveness comes from `AIEventBus` — an in-process,
per-owner, best-effort fan-out of milestones (`AI_ANALYSIS_STARTED`, `AGENT_STARTED`, `AGENT_COMPLETED`,
`AI_ANALYSIS_COMPLETED`, `AI_ANALYSIS_FAILED`, `AI_ANALYSIS_STALE`) to `/ws/ai`. Events are a progress view
only: the Command Brief always arrives over HTTP, so a dropped socket costs liveness and nothing else. One
uvicorn worker is assumed; a multi-worker deployment needs a real broker (open follow-up).

Fail-safe partial runs: a non-critical agent that raises is recorded `FAILED` with an `AGENT_FAILED`
`DataLimitation`; the graph continues and the brief loses only that agent's section. Conditional routing skips
the analysis tiers entirely when the Context Collector finds no analysable frame, so an empty frame costs no
LLM call.

UI mount points (`frontend/src/features/command-center/`, `CommandCenterPage.tsx`): left rail →
`components/AgentExecutionHud.tsx` (a chip per graph node, grouped by superstep so the parallel branches read
as parallel); right rail → `components/IntelligencePanel.tsx` (hazard, potentially-exposed table, priorities,
precautions, actions, limitations & audit). Both are ordinary HUD panels in the existing mission-control
layout — no chatbot surface. The pre-Prompt-15 `CommandBriefPanel` is superseded and removed.

`HudPanel` carries `shrink-0`: the rails are flex columns, so without it a rail with several panels squashes
each one and clips its body mid-line (which reads as panels overlapping). Panels keep their natural height and
the rail scrolls.

### 30b. RAG evidence layer (Prompt 16)

`rag/` is a standalone package (parser → chunker → embedder → ChromaDB → hybrid retriever), the same
isolation discipline as `simulation/` and `agents/`. The graph gains one node, `evidence_retrieval`, between
Tier 1 and Tier 2 (§30's diagram): it builds a role-scoped `RetrievalQuery` for `precaution` and `response`
(architecture.md §10's role phrasing) and calls the injected `EvidenceRetriever` — `NotConfiguredEvidenceRetriever`
(default, `RAG_PROVIDER=none`) or `HybridRetriever` (`RAG_PROVIDER=chroma`) over the real `aquashield_evidence`
collection.

**Citations are never trusted, only verified.** A Precaution/Response action may put a retrieved
`EvidenceItem.evidence_id` in its `citations`; `SafetyValidator.validate_citations`
(agents/agents/command/synthesis.py) keeps only ids that literally exist in the `EvidencePack` that node was
actually given — a hallucinated or injected id is dropped and recorded in `validation_notes`, exactly like an
unknown simulation evidence id. Retrieved `text_snippet` content is treated as quoted data throughout, never
as an instruction (`RAG_GUARDRAILS`, agents/prompts/versions.py) — the same untrusted-input discipline as the
sanitized `operator_question`.

**Registry split**, mirroring `SimulationArtifact` (§14a): ChromaDB holds chunks and embeddings;
`rag_sources`/`rag_ingestion_log` (Postgres, `backend/app/db/models/rag_source.py`) hold metadata, checksum
and an append-only ingestion audit. `RagIngestionService` (`backend/app/services/`) is the idempotency
boundary — a source whose checksum is unchanged is a `skipped` log row, not a re-embed.

**Endpoints:** `POST /rag/retrieve` (auth required — exercises the retriever directly), `GET /rag/sources`,
`GET /rag/sources/{source_id}`, `GET /rag/health` (unauthenticated, like `/disaster-types` — the source
registry is shared knowledge, not user data). **Events:** `RAG_RETRIEVAL_STARTED`, `RAG_RETRIEVAL_COMPLETED`,
`AGENT_EVIDENCE_ATTACHED` ride the existing `/ws/ai` bus (§30a) — no second socket.

**CLI:** `python -m rag ingest|validate|list-sources` (`rag/__main__.py`) — argparse subcommands, not
`python -m rag.ingest`, because `list-sources` is not a valid Python module identifier; documented deviation
from the literal request. It is the one file in `rag/` allowed to import `backend.app`, bridging the two
domains exactly as `backend/app/main.py` bridges the other direction for `simulation.*`.

Detail: docs/rag/pipeline.md. See ADR-008.

