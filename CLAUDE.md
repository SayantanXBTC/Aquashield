# AQUASHIELD — Claude Development Guide

## 1. Project Identity

AQUASHIELD is a modular AI-powered platform for visualizing, simulating, interpreting, and responding to water-related disasters.

The platform combines:

- Environmental data
- Numerical/physics-based simulation
- Interactive 3D visualization
- Time-based animation
- Geospatial analysis
- Vulnerability assessment
- Multi-agent AI
- RAG
- Emergency response planning

The platform must not be architecturally tied to one disaster type.

## 2. Core Product Philosophy

AQUASHIELD follows:

SIMULATE → VISUALIZE → ANALYZE → REASON → RESPOND

The platform must allow a user to create or configure a disaster scenario, run it through the appropriate simulation model, visualize its progression in 3D, allow AI agents to analyze the resulting state, retrieve relevant authoritative knowledge through RAG, and produce an explainable response plan.

## 3. Disaster-Agnostic Architecture

THIS IS A CRITICAL REQUIREMENT.

Never hard-code the entire application around oil spills.

Disaster types must be represented through a common abstraction.

Conceptually:

```
Disaster Scenario
    ↓
Scenario Parameters
    ↓
Environmental Conditions
    ↓
Simulation Model
    ↓
Time-Series State
    ↓
Visualization / Animation
    ↓
Risk Analysis
    ↓
AI Response
```

Each disaster type should eventually be implemented as a modular scenario/model.

For example:

- FloodScenario
- CycloneScenario
- TsunamiScenario
- OilSpillScenario
- PollutionScenario
- SearchAndRescueScenario

New disaster types should be addable without rewriting the frontend, AI orchestration system, or entire backend.

## 4. User-Generated Disaster Scenarios

The final product must allow users to configure disasters.

A scenario may contain:

- Disaster type
- Geographic location
- Start time
- Duration
- Intensity/severity
- Environmental conditions
- Relevant physical parameters
- Affected region
- Initial conditions
- Simulation resolution
- Optional user-defined interventions

The UI should eventually provide a Scenario Builder.

Example:

```
CREATE TSUNAMI
Location: Indian Ocean
Magnitude/energy: configurable
Source depth: configurable
Start time: configurable
```

```
CREATE OIL SPILL
Location: Arabian Sea
Volume: 500 tonnes
Oil type: Crude
Wind: configurable
Current: configurable
```

```
CREATE CYCLONE
Location: Bay of Bengal
Intensity: configurable
Wind speed: configurable
Movement direction: configurable
```

These are examples only. Do not assume every disaster can use the same physical parameters.

## 5. Simulation Must Be Independent From AI

The simulation engine is responsible for physical/environmental behavior.

The LLM must NOT invent:

- Wave propagation
- Flood extent
- Oil trajectories
- Wind fields
- Water movement
- Physical coordinates
- Arrival times

unless explicitly identified as an AI-generated approximation.

Whenever possible, physical calculations must come from deterministic or scientifically defined simulation modules.

Correct architecture:

```
Environmental Data
        ↓
Simulation Model
        ↓
Predicted State
        ↓
AI Interpretation
```

NOT:

```
User Input
        ↓
LLM guesses what happens
        ↓
Fake simulation
```

The AI interprets simulation outputs.

## 6. Time-Based Simulation and Animation

AQUASHIELD must be designed around TIME.

Every disaster scenario should conceptually produce:

```
t0 → t1 → t2 → t3 → ... → tn
```

At each timestep, the system may produce:

- Particle positions
- Water levels
- Wave height
- Flood extent
- Wind vectors
- Current vectors
- Pollution concentration
- Risk zones
- Affected infrastructure
- Other scenario-specific state

The frontend should animate these states.

The user should eventually be able to:

- Play
- Pause
- Resume
- Fast-forward
- Rewind
- Scrub the timeline
- Change playback speed
- Jump to important events
- Compare different simulations

The 3D visualization must not merely display a static disaster map. It must communicate HOW THE DISASTER EVOLVES OVER TIME.

## 7. Scenario Replay and Comparison

The architecture should eventually support:

```
Scenario A
vs
Scenario B
```

For example:

```
Cyclone intensity 120 km/h
vs
Cyclone intensity 180 km/h
```

or:

```
No intervention
vs
Boom deployed
```

The system should be able to visualize the difference where practical.

This enables:

"What happens if we take this action?"

rather than merely:

"What is happening?"

## 8. 3D Visualization Rules

Use:

- React
- React Three Fiber
- Three.js
- @react-three/drei

The 3D environment should eventually support:

- Water surface
- Terrain
- Coastlines
- Bathymetry where appropriate
- Current vectors
- Wind vectors
- Wave propagation
- Flood surfaces
- Disaster particles
- Oil/pollution particles
- Risk heatmaps
- Infrastructure
- Ships
- Response assets
- User-defined intervention zones

Use GPU-efficient rendering techniques.

Prefer:

- Instancing
- BufferGeometry
- GPU particles
- Shaders where useful
- Efficient state updates

Avoid thousands of unnecessary React components for high-frequency simulation particles.

The simulation state and UI state should remain appropriately separated.

## 9. Disaster-Specific Visualization

Different disasters must NOT be forced into the same visualization.

Examples:

**TSUNAMI:**
- Wave propagation
- Wave height
- Arrival time
- Coastal inundation

**CYCLONE:**
- Wind field
- Pressure/intensity
- Track
- Storm-surge impact
- Predicted path

**FLOOD:**
- Rising water level
- Flood extent
- Flow direction
- Inundation depth

**OIL SPILL:**
- Particle/slick movement
- Concentration
- Weathering
- Predicted coastline impact

**SEARCH & RESCUE:**
- Drift trajectory
- Search probability area
- Vessel/person location
- Search assets

The architecture should provide a common interface while allowing scenario-specific visualization.

## 10. Multi-Agent AI

Use LangGraph unless a documented architectural decision changes this.

Agents may include:

**State Evaluator / Router** — Determines: Which disaster is active? What simulation state is available? What needs to be analyzed?

**Vulnerability Agent** — Analyzes: Population, Infrastructure, Hospitals, Roads, Ports, Fisheries, Ecosystems, Coastal settlements, Other relevant assets.

**Disaster-Specific Tactical Agent** — Provides response reasoning appropriate to the disaster.

For example:

- Flood: evacuation priorities, critical infrastructure protection, response zones
- Oil spill: containment, cleanup priorities, ecological protection
- Cyclone: evacuation, port closure, emergency positioning
- Tsunami: coastal evacuation, warning zones, emergency access

The architecture should permit specialized agents to be added later.

**Regulatory/RAG Agent** — Retrieves relevant authoritative information.

**Command Synthesizer** — Combines simulation state, risk analysis, tactical recommendations, and retrieved knowledge into an Incident Action Plan.

## 11. RAG Must Be Disaster-Aware

The RAG pipeline must not only contain oil-spill documents.

The knowledge base should eventually support categories such as:

- Flood management
- Cyclone response
- Tsunami response
- Maritime emergencies
- Oil-spill response
- Chemical pollution
- Environmental protection
- Search and rescue
- Disaster-management SOPs
- Government guidelines
- Relevant regulations

The retrieval process should consider:

```
DISASTER TYPE + LOCATION + CURRENT SIMULATION STATE + USER QUERY + RESPONSE CONTEXT
```

before retrieving relevant information.

The system must never fabricate regulations or claim that a source says something it does not say.

## 12. AI Must Interpret Simulation State

The AI pipeline should receive structured simulation information.

Example:

```json
{
  "disaster_type": "tsunami",
  "timestep": 420,
  "wave_height": "...",
  "affected_regions": "...",
  "predicted_arrival": "...",
  "vulnerable_assets": "..."
}
```

The exact schema will be designed later.

The AI should reason over this structured state and combine it with retrieved authoritative knowledge.

## 13. Explainability

Important recommendations must eventually be explainable through:

- Simulation result
- Identified risk
- Affected location
- Relevant environmental data
- AI analysis
- Retrieved authoritative document
- Recommended action

The system should be able to answer:

"Why did you recommend this?"

and:

"What information was this recommendation based on?"

## 14. Frontend

Use:

- React
- TypeScript
- Tailwind CSS
- React Three Fiber
- Three.js
- Anime.js where appropriate
- Deck.gl only where it provides clear value

The UI should resemble a high-end:

- Emergency Operations Center
- Scientific visualization platform
- Disaster command center

It must prioritize situation awareness over decorative UI.

## 15. Backend

Use:

- Python
- FastAPI
- WebSockets
- Pydantic

REST: Scenario creation, Configuration, Metadata, Documents, Standard operations.

WebSocket: Simulation telemetry, Timeline updates, Live state, Agent status, AI directives.

## 16. Scientific / Geospatial Layer

Potential technologies:

- NumPy
- SciPy
- xarray
- GeoPandas
- Shapely
- Rasterio

Use only what is actually required. Do not introduce dependencies without justification.

## 17. Technology Stack

The intended stack is:

**FRONTEND**
React, TypeScript, React Three Fiber, Three.js, Tailwind CSS, Anime.js, Deck.gl where appropriate

**BACKEND**
Python, FastAPI, WebSockets, Pydantic

**SIMULATION**
NumPy, SciPy, xarray, GeoPandas, Shapely, Rasterio where necessary

**AI**
LangGraph, LLM provider to be decided

**RAG**
ChromaDB, Embeddings, Document parsing/retrieval pipeline

**TESTING**
Frontend tests, Python tests, Playwright E2E testing

The final frontend framework between Vite and Next.js must be evaluated based on the project's needs and documented in architecture.md.

## 18. Dependency Management

Frontend dependencies → package.json

Python dependencies → requirements.txt OR pyproject.toml

Do not duplicate dependency systems unnecessarily. Every dependency must have a documented reason. Do not install the complete stack during this phase.

## 19. Session Persistence

Every meaningful change must update project documentation.

Before changing anything:

1. Read CLAUDE.md.
2. Read architecture.md.
3. Read recent CHANGELOG.md entries.
4. Inspect existing implementation.

After meaningful changes:

1. Test the change.
2. Update architecture.md if architecture changed.
3. Update CHANGELOG.md.
4. Record important context for future Claude sessions.

CHANGELOG format:

```
### YYYY-MM-DD — Change Title

**Added/Changed:**
- ...

**Why:**
- ...

**Files/Modules:**
- ...

**Future Context:**
- ...
```

Keep entries concise.

## 20. No Silent Architecture Changes

Do not silently:

- Replace frameworks
- Replace databases
- Replace simulation approaches
- Replace AI orchestration
- Change the 3D architecture
- Introduce major infrastructure

without documenting the decision.

## 21. Repository Structure Rules

The repository is split into domain directories (`frontend/`, `backend/`, `simulation/`, `agents/`, `rag/`,
`data/`, `shared/`, `tests/`, `docs/`, `scripts/`, `infrastructure/`) — see architecture.md §18 for what each
owns. When working in this repository, Claude must:

- Respect domain ownership — work inside the domain the task belongs to; don't drift into another domain's
  files to "help."
- Avoid moving or reorganizing files unnecessarily, and never reorganize a directory as a side effect of an
  unrelated task.
- Avoid modifying unrelated domains in the same change unless the task is explicitly cross-domain.
- Keep frontend, 3D (`frontend/src/three/`), animation (`frontend/src/animations/`), simulation, agents, RAG,
  and backend separated as designed — don't put Three.js code in `components/`, simulation math in a route
  handler, or RAG logic inside an agent.
- Use `shared/` (schemas, types, contracts, constants) for cross-domain data shapes instead of inventing a
  parallel format in one domain.
- Avoid giant central/barrel files (global `index.ts`, `__init__.py`) that every branch would need to touch —
  prefer direct imports or domain-local barrels (see `docs/development/git-workflow.md`).
- Minimize merge-conflict-prone changes: keep commits domain-focused, don't run a repo-wide formatter for a
  single-domain change, don't make unrelated formatting edits alongside feature work.
- Read CLAUDE.md, architecture.md, and the relevant domain's `README.md` before restructuring anything.
- Update architecture.md and CHANGELOG.md when a structural decision changes (per §19).

## 22. Git Rules

Repository: `main` (stable/release-ready) → `develop` (integration) → `feature/*` (bounded, domain-scoped work).
Full branch/commit conventions live in `docs/development/git-workflow.md`; architecture-level git structure is
in architecture.md §19–22.

**Before significant work:**

- Check `git status` and the current branch.
- Read recent commits (`git log --oneline -n 10`).
- Read relevant architecture documentation for the domain being touched.
- Determine the intended feature scope before editing.

**During work:**

- Modify only files relevant to the task's domain.
- Avoid unrelated formatting or refactoring riding along with a feature change.
- Avoid mass dependency upgrades.
- Avoid moving files without an architectural reason, documented in architecture.md/CHANGELOG.md.

**After work:**

- Run relevant tests.
- Check `git diff` before staging.
- Update documentation and CHANGELOG.md.
- Confirm no secrets, `.env`, or generated/bulk data are staged (`git status` after `git add`).
- Commit only when the work is logically complete, using the conventional-commit format.

**Never:**

- Force push.
- Reset or discard a user's or another contributor's work.
- Delete branches without explicit permission.
- Rewrite shared/pushed history without permission.
- Commit secrets, `.env`, credentials, or huge datasets.
- Make silent architectural changes (see §20).

## 23. Bootstrap Status

Full detail (verification results, pinned-version constraints): architecture.md §24 Technology Bootstrap.

| Piece | Status |
|---|---|
| Frontend — React + TypeScript + Vite | BOOTSTRAPPED |
| 3D — Three.js + React Three Fiber + Drei | dependency foundation only |
| Animation — Anime.js | dependency foundation only |
| Styling — Tailwind CSS | BOOTSTRAPPED |
| Backend — FastAPI + Pydantic + Uvicorn + WebSockets | BOOTSTRAPPED |
| Database — PostgreSQL + PostGIS + SQLAlchemy 2.0 + Alembic + GeoAlchemy2 | BOOTSTRAPPED (schema, migrations, seed data — no CRUD API yet) |
| Shared contracts — JSON Schema + Pydantic + TypeScript mirrors | BOOTSTRAPPED (13 contracts, no business logic) |
| Scientific — NumPy + SciPy + xarray | dependency foundation only |
| Geospatial — Shapely + GeoPandas | dependency foundation only |
| AI — LangGraph | dependency foundation only |
| RAG — ChromaDB | dependency foundation only |
| Testing — Vitest / pytest | BOOTSTRAPPED |
| Testing — Playwright | PLANNED |
| Deck.gl | PLANNED / OPTIONAL |
| Rasterio | PLANNED |

"Dependency foundation only" means the package is installed and import-verified, with no AQUASHIELD logic
built on it — do not treat its presence in `node_modules`/the venv as a green light to start implementing the
feature it will eventually power without an explicit instruction to do so.

## 24. Database Rules

Full detail: docs/development/database.md. Architecture/ADR: architecture.md ADR-003, §14a, §25.

- Never modify the database schema outside an Alembic migration. Model changes without a matching migration
  are incomplete work.
- Never store large scientific/simulation data (grids, particle trajectories, rasters, full timestep arrays)
  in a PostgreSQL column — only metadata and a storage reference (`SimulationArtifact`). See §14a.
- ChromaDB is not replaced by PostgreSQL — they serve different purposes (application state vs. vector/RAG
  knowledge) and both stay.
- Database credentials come only from environment configuration (`backend/.env`, never committed) — same rule
  as every other secret (§18).
- Adding a database dependency (SQLAlchemy, Alembic, GeoAlchemy2, a driver) goes in the shared root
  `requirements.txt`, not a new manifest (ADR-002 still applies).
- Backend `tests/db/*` require a real PostgreSQL/PostGIS instance and are marked to skip (not silently run
  against SQLite) when one isn't reachable — don't "fix" a skip by swapping in SQLite.
- Adding a new PostGIS geometry/geography column: read docs/development/database.md's note on the
  GeoAlchemy2/Alembic duplicate-spatial-index gotcha before generating the migration. Adding a new
  `str, enum.Enum` column: remember `downgrade()` must explicitly drop the Postgres ENUM type it creates.

## 25. Scenario System Rules

Full detail: docs/development/scenarios.md. Architecture: architecture.md §26.

- Layering is enforced, not a suggestion: routes (`app/api/routes/`) contain no business logic — they call a
  service; services (`app/services/`) contain no raw SQLAlchemy query-building — they call a repository;
  repositories (`app/repositories/`) contain no domain decisions (status transitions, "should this create a
  new version") — that belongs in the service. A change that blurs this is incomplete, not just untidy.
  Extend this same layering when adding the next domain (simulation runs' actual execution, risk assessments,
  etc.) rather than inventing a different pattern per feature.
- `scenario_config` changes are versioned (a new immutable `ScenarioVersion`); every other Scenario field
  (name, description, location, status) updates in place. Never modify an existing `ScenarioVersion` row.
- `DELETE /scenarios/{id}` archives, it does not hard-delete — cascading deletes would destroy
  `SimulationRun`/`ScenarioVersion` history. There is no hard-delete endpoint.
- A `SimulationRun` created via the API is metadata only (`status=pending`). Never fabricate a completed run,
  timestep results, or risk output — the simulation engine doesn't exist yet.
- Client-side form validation (`frontend/src/features/scenario-builder/validation.ts`) is a UX convenience
  only — the server is always authoritative; don't skip a server-side check because the client already has one.
- Adding a disaster-specific config field: update both `backend/app/schemas/scenario_config.py` (validation)
  and `frontend/src/features/scenario-builder/disasterFieldSpecs.ts` (form rendering) — they're intentionally
  parallel registries, not generated from each other.
