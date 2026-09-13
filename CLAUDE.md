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
| RAG — ChromaDB + hybrid retrieval pipeline (`rag/`) | BOOTSTRAPPED, live in local dev (Prompt 16 — 9-node analysis graph incl. `evidence_retrieval`, role-scoped citations, local deterministic embeddings by default; 5 real TIER_1 sources ingested — tsunami/flood/cyclone/oil-spill/general — `RAG_PROVIDER=chroma` set in local `backend/.env`; code default stays `none` for a fresh install until an operator ingests sources for their own environment; see docs/rag/pipeline.md) |
| Testing — Vitest / pytest | BOOTSTRAPPED |
| Testing — Playwright | PLANNED |
| Deck.gl | PLANNED / OPTIONAL |
| Rasterio | PLANNED |
| Simulation Engine — `simulation/core` + 5 demo disaster models + execution API | BOOTSTRAPPED (Prompt 7 — deterministic, synchronous, JSON artifact only; see docs/development/simulation.md) |
| AAA 3D Command Center + cinematic landing | BOOTSTRAPPED (Prompt 8 — landing/explore/command-center routing, full Three.js scene graph, real Prompt 7 integration; see docs/development/command-center.md) |
| World scenery — instanced forest + ground-fitted structures + illustrative structural response | BOOTSTRAPPED (`three/vegetation/`, `three/structures/collapse.ts`; see docs/development/command-center.md) |
| AI — LangGraph 9-node analysis layer (`agents/`) | BOOTSTRAPPED (Prompt 14, extended Prompt 15/16 — read-only, evidence-gated, local deterministic provider by default, RAG-cited Precaution/Response; see docs/agents/ai-layer.md) |
| AI — frame-synchronised command-center integration (`/ws/ai`, Agent HUD, Intelligence panel) | BOOTSTRAPPED (Prompt 15 — throttled/debounced, stale-guarded; architecture.md §30a) |
| Auth — Firebase Authentication + PyJWT verification | BOOTSTRAPPED (Prompt 12 — per-user scenario isolation via `scenarios.owner_uid`; operator supplies the Firebase project config; see docs/development/setup.md) |
| Demo shoreline world + client-side propagation mirror | BOOTSTRAPPED (Prompt 12 — `simulation/core/propagation.py` ↔ `frontend/src/propagation/`, fixture-pinned; architecture.md ADR-005) |
| Real City mode (Chennai) — curated real coastline + real building geometry | BOOTSTRAPPED, Chennai only (ADR-009, §28c — real Natural Earth coastline fit + real OSM buildings, `world_profile="real_city"`; simplified physics unchanged; Mumbai/Puri/Visakhapatnam/Kochi pending their own fit-quality validation) |

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
- Scenario creation happens inside the command center (`features/command-center/components/NewTestModal.tsx`
  + `presets.ts`) — there is no standalone builder route. Presets are generic demo disasters only: never add a
  real-world place name or coordinate to a preset, the scenario form, or a scene label — **except** the five
  curated cities behind `world_profile: "real_city"` / `city_id` (architecture.md ADR-009, §28c): their
  geometry is genuinely real, built only by `scripts/build_town_data.py`, never a runtime/user-supplied
  place. This exception does not extend to presets, structures' free-text `name` field, or anywhere else.
- Every scenario/run row is scoped to the verified Firebase uid (`scenarios.owner_uid`, `app/core/auth.py`).
  Never accept an owner from a request body, never list across owners, and report another user's row as 404
  (not 403). New endpoints touching scenarios/runs must depend on `CurrentUser` and go through a service
  constructed with `owner_uid`.
- Adding a common propagation field: update `PropagationConfig` (`backend/app/schemas/scenario_config.py`),
  `simulation/core/propagation.py`, `frontend/src/propagation/kinematics.ts`, and regenerate the fixtures.
- Structures (`scenario_config.structures`) are assessed by `simulation/core/structures.py` and mirrored in
  `frontend/src/propagation/structures.ts`; a new structure type is added to `STRUCTURE_TYPES` (both
  schema and core), `shared/types` `StructureType`, `STRUCTURE_LABELS`, and `three/structures/models`.
  Exposure bands are illustrative — never present them as damage or casualty estimates.

## 26. Simulation Engine Rules

Full detail: docs/development/simulation.md. Architecture: architecture.md §27.

- `simulation/` is a standalone Python package — no FastAPI, SQLAlchemy, React, or Three.js dependency.
  `backend/app/services/simulation_service.py` is its only caller; never import `simulation.*` from a route
  handler directly, and never add a `simulation/core` dependency on `backend/app`.
- A disaster model is selected by `disaster_type` string through `simulation/core/registry.py`'s
  `MODEL_REGISTRY` only — never an if/elif chain in `SimulationEngine`. Adding a disaster type/model means
  registering it there, not branching inside the engine.
- Every `DisasterModel` is a **SIMPLIFIED DEMONSTRATION MODEL** and must say so via its `describe()` output
  (`type`, `purpose`, `scientific_validation`, `assumptions`) — never claim or imply real forecasting/
  operational accuracy (CLAUDE.md §12/§31 predecessor rule; Prompt 7 §31).
- Determinism is required: same `disaster_type` + `scenario_config` + `timestep_config` + `seed` must
  produce the same `TimelineFrame` sequence. No model may use uncontrolled randomness — if randomness is
  ever genuinely useful, it must go through the engine's seeded `random.Random`, with the seed recorded in
  `SimulationRun.timestep_config["seed"]`.
- `SimulationEngine`/`SimulationService` never store full timestep data in PostgreSQL — only a
  `SimulationArtifact` metadata row pointing at the JSON file `simulation/outputs/{run_id}.json` (§24, this
  file). Do not add a column to persist raw frame data.
- A `SimulationRun` can only be executed once (`PENDING` → `RUNNING` → `COMPLETED`/`FAILED`) — re-running
  means creating a new `SimulationRun`, never resetting an existing one's status back to `PENDING`.
- Execution is currently synchronous (`POST /simulation-runs/{run_id}/execute` blocks until done) — a
  deliberate, documented prototype choice (Prompt 7 §26), not an oversight. Don't introduce Celery/Redis/a
  job queue without an explicit instruction to do so.
- The demo shoreline world (`simulation/core/propagation.py`, `shared/constants/demo_world.json`) is mirrored
  line-for-line in `frontend/src/propagation/` for the live preview. Any change to a shoreline constant, the
  kinematics, or a demo model's formula must be made on both sides and followed by
  `.venv/bin/python scripts/generate_propagation_fixtures.py`; `frontend/src/propagation/mirror.test.ts` is
  the tripwire. The Python engine remains the authoritative record ("Record run"); the mirror is a preview.

## 26a. AI Layer Rules

Full detail: docs/agents/ai-layer.md. Architecture: architecture.md ADR-006, §30.

- `agents/` is standalone (no FastAPI/SQLAlchemy/backend imports). It reaches data only through the
  `AnalysisDataAccess` Protocol (`agents/tools/data_access.py`); the backend adapter
  (`backend/app/services/ai_data_access.py`) is its only implementation and is read-only. Never give the AI
  layer a write path to simulation, scenario or geospatial tables — `ai_requests` is the only table it writes.
- Every agent output is a closed Pydantic schema (`agents/schemas/outputs.py`); every claim cites evidence
  ids from the Context Collector; the `SafetyValidator` strips ungrounded numbers, unknown evidence and
  destruction/casualty wording. Do not add a free-text field that bypasses it.
- `requires_human_approval` stays `Literal[True]`; `resources` stays `RESOURCE_DATA_UNAVAILABLE` until a
  verified resource inventory exists. Missing data is `DATA_UNAVAILABLE`, never an estimate.
- Operator text is data: sanitize it (`agents/tools/sanitize.py`), quote it in the payload, never put it in
  a system prompt.
- The local deterministic provider must keep passing the same graph/validator as the Anthropic provider —
  tests run offline against it. Bump `PROMPT_VERSION` when any prompt changes.
- Adding an agent means: a node module under `agents/agents/<domain>/`, a closed output schema in
  `agents/schemas/outputs.py`, a state field, an entry in `AGENT_VERSIONS`/`AGENT_LABELS`/`AGENT_ORDER`, a
  deterministic generator in `agents/llm/local_rules.py`, an edge in `agents/graph/workflow/graph.py`, and the
  matching chip in `frontend/src/features/command-center/ai/agentRoster.ts`. Never an if/elif inside a node.
- The AI never runs per frame. All pacing lives in `frontend/src/features/command-center/ai/analysisScheduler.ts`
  (playback throttle `AI_UPDATE_INTERVAL_MS`, scrub debounce `AI_SCRUB_DEBOUNCE_MS`, immediate on
  pause/complete/manual). Don't call `aiApi.analyzeFrame` from a component directly, and don't put an analysis
  call inside `useFrame` or a per-frame effect.
- A brief is cached by `(scenario_version_id, simulation_run_id, frame_index)` and discarded when the scope
  changes. A late response for a scope the operator has left is dropped silently — never painted over the
  frame on screen. The server enforces the same rule with `409 AI_ANALYSIS_STALE`.
- `/ws/ai` events are a progress view only (best effort, in-process, per verified uid). Never make the
  Command Brief depend on them, and never put prompt text, keys or chain-of-thought in an event.

## 26b. RAG Pipeline Rules

Full detail: docs/rag/pipeline.md. Architecture: architecture.md §10, §30b.

- `rag/` is standalone, like `simulation/` and `agents/` (no FastAPI/SQLAlchemy import anywhere in the
  package). Agents reach it only through `agents/tools/retrieval/evidence_retriever.py` — the ONLY file in
  `agents/` that imports `rag.*`; everything that needs an `EvidenceItem`/`EvidencePack`/`ClaimMapping` type
  elsewhere in `agents/` imports it from that file, never from `rag.schemas.models` directly.
- The Postgres source registry (`rag_sources`, `rag_ingestion_log`) is bridged by
  `backend/app/services/rag_ingestion_service.py`, the same pattern `ai_data_access.py` uses for agents and
  `simulation_service.py` uses for the simulation engine — one backend service crosses the boundary, the
  domain package stays framework-free. `rag/__main__.py` (the CLI) is the one exception: it bootstraps both
  `rag/` and `backend/app` onto `sys.path` to reach the registry, mirroring `backend/app/main.py`'s own
  reverse bootstrap for `simulation.*`.
- Retrieved text is evidence, never an instruction. A citation is only ever an id that literally appears in
  the `EvidencePack` an agent was actually given (`SafetyValidator.validate_citations`,
  `agents/agents/command/synthesis.py`) — an agent (local or hosted) claiming any other string has it
  silently dropped and recorded in `validation_notes`, exactly like an unknown simulation evidence id.
- `RAG_PROVIDER=none` (default) keeps the pre-Prompt-16 posture: every `regulatory_evidence:<role>`
  `DataLimitation` reads `NOT_CONFIGURED`. `RAG_PROVIDER=chroma` switches on the real hybrid retriever — it
  still returns `INSUFFICIENT_EVIDENCE`/`UNAVAILABLE` rather than a fabricated citation whenever nothing
  relevant enough is actually ingested for that disaster type.
- Never place a document under `rag/sources/` unless it is a real, identified authoritative source
  (rag/sources/README.md). Test/fixture material belongs under `rag/tests/fixtures/`, is always parsed with
  `is_test_fixture=True`, and its `authority` field reads `TEST_FIXTURE`.
- Adding an embedding or vector-store provider means a new `build_embedding_provider`/`build_evidence_retriever`
  branch (`rag/embeddings/provider.py` / `agents/tools/retrieval/evidence_retriever.py`) — never an if/elif
  inside `HybridRetriever` or a graph node.
- Ingestion is idempotent by content checksum (`rag.schemas.models.checksum_of`) — re-ingesting an unchanged
  document is a `skipped` `RagIngestionLog` row, not a re-embed. A changed document replaces its chunks
  wholesale (`ChromaVectorStore.delete_source` then re-upsert); it never leaves a stale chunk from an earlier
  revision retrievable alongside the new ones.
- RAG runs on the same pacing as the rest of the analysis graph (CLAUDE.md §26a) — retrieval happens once
  per `evidence_retrieval` node execution, inside the existing throttled/debounced `/ai/analyze-frame` call.
  Never add a retrieval call on a timer, in `useFrame`, or anywhere outside that node.

## 27. AAA 3D Command Center & Landing Rules

Full detail: docs/development/command-center.md. Architecture: architecture.md §28.

- `frontend/src/propagation/hazards.ts` is the only place a hazard's numbers are produced for rendering —
  `computeHazard` (live mirror) and `snapshotFromRecordedFrame` (a recorded frame's `hazard_state`) both
  yield the same `HazardSnapshot`. A disaster visualizer (`three/disasters/<kind>/`) never reads backend
  field names directly and never computes physics; it turns a snapshot into meshes/uniforms via
  `three/hazard/hazardChannel.ts` inside `useFrame`.
- `SceneRoot` resolves each hazard kind's visualizer through `three/disasters/registry.ts`'s lookup only —
  never an if/else chain, mirroring `simulation/core/registry.py`'s server-side pattern; disaster-type →
  kind reuse decisions live in `hazardKindFor`.
- The shoreline is watertight by construction: the water fragment shader evaluates the same
  `terrainHeightKm` (`three/world/demoWorld.ts`, JS + GLSL twins) the terrain mesh is built from. Never
  change one twin without the other, and never add a second water or terrain mesh. The shoreline's shape
  (`uShoreBase`/`uShoreAmp`/`uShoreFreq`/`uShorePhase`) is a runtime uniform, not a baked shader constant —
  a curated real city (architecture.md ADR-009, §28c) overrides it per-scenario without a shader recompile;
  its data comes only from the committed `shared/constants/towns/<city_id>.json` (built by
  `scripts/build_town_data.py`, never fetched at runtime) and must always render the "real coastline &
  buildings, simplified physics" disclosure label.
- Every visual quantity that isn't a direct simulation field (e.g. a tsunami's visual impact radius) is a
  documented, fixed rendering convenience — never an invented physical formula. Say so in a comment where
  it's computed.
- The world (water, terrain, hazard visualizers) is explicitly a VISUAL DEMONSTRATION, not scientific/GIS
  data — every new terrain/water/visualizer file must carry that distinction in its own comment, not just
  rely on this rule existing elsewhere.
- One `<Canvas>` in the whole app (`three/core/AquaCanvas.tsx`). New 3D work extends `SceneRoot`'s
  composition or adds a new disaster visualizer to the registry — it does not construct a second `<Canvas>`.
- Every Anime.js handle (a `JSAnimation`, `Timeline`, or `ScrollObserver`) created in a component must be
  reverted on unmount via `animations/cleanup.ts` — no exceptions, even for a "one-shot" animation.
- No fabricated numbers anywhere in the UI: a missing/not-yet-loaded value renders `DataReadout`'s `—`
  placeholder or an explicit `EmptyState`/`ErrorState`, never an invented statistic, percentage, or count
  (this applies to loading-screen "progress" too — indeterminate only, unless a real measured value exists).
- The forest (`frontend/src/three/vegetation/`) grows where the terrain shader paints forest. `worldNoise.ts`
  is a JS twin of `terrainMaterial.ts`'s fbm — change one and change the other, and keep slope in the
  shader's units (`1 - normal.y`), not a raw gradient. `forestPlacement.test.ts` is the tripwire; placement
  stays pure and GPU-free so it keeps being testable.
- A structure's collapse (`frontend/src/three/structures/collapse.ts`) is an ILLUSTRATION OF THE EXPOSURE
  BAND, never a damage model. It must stay a pure function of the current exposure (so scrubbing the timeline
  back stands the structure up), must take its thresholds from `propagation/structures.ts` rather than its
  own numbers, and must never feed a value back into simulation, exposure or the AI layer. Failure spans the
  `impacted` and `severe` bands — demo hazards peak mid-`impacted`, so a mapping that only fires above
  `EXPOSURE_IMPACTED` renders nothing in practice (`collapse.test.ts` pins the scenario peaks). Any UI that shows
  it also states that it is illustrative — see `StructuresPanel`.
- Place a structure with `footprintGround` (`three/structures/support.ts`), never a single centre height
  sample: the plate is not flat and a centre sample leaves a building floating on its downhill corner.
- The command center and Three.js scene are lazy-loaded (`React.lazy`/`Suspense` in `App.tsx`) — don't
  import `three`/`@react-three/*` or the command-center feature from a module that's part of the initial
  bundle (the landing page). Verify with `npm run build`'s chunk output, not by assumption.
