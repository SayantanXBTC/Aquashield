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

## 14. Data Sources

All external environmental/geospatial data providers are **PLANNED / TO BE DECIDED**. No data provider is selected or assumed at this stage.

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

See ADR-001 and ADR-002 (Section 13) for the first recorded decisions. Future major decisions (database choice, LLM provider, deployment infrastructure, additional disaster model integrations) must be recorded here before being silently adopted.

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

### Shared contracts

`shared/schemas`, `shared/types`, `shared/contracts`, and `shared/constants` are the only place cross-domain
data shapes are defined (Scenario, Simulation state, Timeline frame, Risk assessment, Vulnerability result,
Agent request/response, Incident Action Plan, WebSocket event, API response). Frontend types and backend/agent
schemas should mirror these rather than each domain inventing its own version of the same shape.

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
frontend's idea of a "Scenario" must stay identical to the backend's and the agents'. Initial conceptual
contracts (schemas only, no business logic):

`Scenario`, `SimulationState`, `TimelineFrame`, `RiskAssessment`, `VulnerabilityResult`, `AgentRequest`,
`AgentResponse`, `RAGQuery`, `RAGResult`, `ResponseRecommendation`, `IncidentActionPlan`, `WebSocketEvent`.

These stay small and domain-neutral — they describe data shape, not behavior. A shared contract change is
treated as a deliberate, documented, cross-domain integration change (see `docs/development/git-workflow.md`
§ Shared Contract Changes), never a silent side effect of one branch's feature work.
