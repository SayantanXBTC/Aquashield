# AQUASHIELD — Development Changelog

### 2026-09-12 — Connect and Visualize Geospatial Impact Data (Prompt 10.1)

**Added/Changed:**
- Fixed the Command Center's default-run selection: `useCommandCenterSession` picked `runList[0]?.id` (the
  newest run by `created_at`, regardless of status), which could auto-select a `PENDING` run created after a
  perfectly good `COMPLETED` run with real hazard/exposure/impact data already in the database (confirmed
  live against the "Geo Test Flood" scenario's 3 runs — see docs/geospatial/impact-visualization.md).
  Replaced with a documented priority rule: `backend/app/services/run_selection.py`'s pure
  `select_default_run_id` (latest `COMPLETED` run with `frame_count > 0` → latest `RUNNING` → latest
  `PENDING`, never `FAILED`/`CANCELLED`), exposed via new `GET /scenarios/{id}/runs/default` and called from
  `useCommandCenterSession` via `scenarioApi.getDefaultRun`.
- `SimulationRunOut`/shared `SimulationRun` gained `frame_count` (mirrors `SimulationRunDetail.frame_count`)
  so the run list carries real per-run frame counts with no extra round trip.
- New `RunSelector.tsx` (+ `runFormatting.ts`, unit tested) lets a user see and explicitly switch between a
  scenario's runs ("COMPLETED · 25 frames", "PENDING · No playback data available") — wired into
  `SimulationStatusPanel`, which also gained an honest "No playback data available" state for a selected
  non-completed run.
- `useDataLayers` gained a per-frame `getImpact(runId, frameIndex)` fetch (previously never called);
  confirmed the existing hazard-footprint/exposure fetches were already frame-correct once run selection was
  fixed (`useDataLayers.test.ts`'s new frame-sync test proves a real before/after change on `frameIndex`).
- New `ImpactPanel.tsx` (severity band, exposed counts by type/criticality, model id/demo disclaimer) and
  `GeographicContextPanel.tsx` (real coordinates, coastline provenance derived from the live API response,
  an honest "Synthetic demo assets" infrastructure label, explicit Elevation/Terrain limitations).
  `DataLayersPanel` gained a per-asset Exposure listing and a read-only Terrain status line.
- `three/core/SceneRoot.tsx` documents (code comment) why the per-disaster-type `Visualizer` and the
  geographic `HazardFootprintLayer` deliberately coexist — the latter is now authoritative for Data
  Layers/Impact, the former is kept as the established "read clearly" visual language.
- 148 backend tests passing (up from 84 at Prompt 10: new `test_run_selection.py` pure-function tests +
  `test_scenarios.py` default-run/frame_count tests). 130 frontend tests passing (up from 98).
  `simulation/tests`: 64 passing, unchanged by this phase.

**Why:**
- A diagnostic audit found Prompt 10's real geospatial backend (hazard-footprint/exposure/impact analysis,
  the ingested Natural Earth coastline dataset) worked correctly end to end, but the Command Center never
  displayed any of it — not a backend bug, a run-selection bug. This phase is the narrow fix plus the
  display surfaces that were still missing once selection pointed at the right data.

**Files/Modules:**
- `backend/app/services/run_selection.py` (new), `app/services/scenario_service.py`,
  `app/api/routes/scenarios.py`, `app/schemas/scenario.py`.
- `backend/tests/services/test_run_selection.py` (new), `backend/tests/api/test_scenarios.py`.
- `shared/types/index.ts`.
- `frontend/src/features/scenario-builder/api/scenarioApi.ts`.
- `frontend/src/features/command-center/hooks/{useCommandCenterSession,useDataLayers}.ts`.
- `frontend/src/features/command-center/components/{RunSelector,ImpactPanel,GeographicContextPanel,
  DataLayersPanel,SimulationStatusPanel}.tsx` (`RunSelector`/`ImpactPanel`/`GeographicContextPanel` new).
- `frontend/src/features/command-center/utils/runFormatting.ts` (new).
- `frontend/src/features/command-center/CommandCenterPage.tsx`.
- `frontend/src/three/core/SceneRoot.tsx`.
- `docs/geospatial/impact-visualization.md` (new), `architecture.md` (§28d).

**Future Context:**
- No browser automation available in this environment — the run-selection fix was verified against the
  real dev PostgreSQL/PostGIS database via a real `TestClient(app)` request (not a mock or unit test double).
  A live browser walkthrough (run selector, Data Layers/Impact/Geographic Context panels updating during
  scrubbing/playback) remains the right next check before demo use.
- Terrain remains procedural because DEM ingestion is not part of Prompt 10.1.
- No AI/agents/RAG in this pass — still deferred to Prompts 11-13.

### 2026-09-12 — Complete Disaster Catalog, Scenario Templates & Disaster-Specific Parameters (Prompt 9.1)

**Added/Changed:**
- Command Center discoverability: `ScenarioContextPanel.tsx` gets a "New scenario" link to `/scenarios`
  (the existing Scenario Builder, which already supported all 9 disaster types end to end) — the Command
  Center stays read/execute-focused rather than growing a second creation form.
- `backend/app/db/seed.py` refactored to be idempotent per-scenario (`_ensure_scenario` looks each up by
  name before inserting, safe to re-run against a partially-seeded DB) and backfills one `READY` demo
  scenario for each of the 6 previously-unrepresented disaster types (flash_flood, coastal_flood,
  storm_surge, cyclone, chemical_pollution, search_rescue) plus a second, `READY` tsunami scenario (the
  original seeded tsunami scenario stays `DRAFT`, untouched) — all 9 types now have at least one `READY`
  row visible in the Command Center's selector.
- New read-only `GET /disaster-types` endpoint (`backend/app/core/disaster_catalog.py` →
  `app/schemas/disaster_catalog.py` → `app/api/routes/disaster_types.py`) — additive discovery/documentation
  metadata (display name, description, category, real resolved `model_identifier`, parameter keys) per
  disaster type, introspecting the existing `DISASTER_CONFIG_SCHEMAS`/`MODEL_REGISTRY` rather than
  duplicating them. Mirrored to the frontend as `DisasterCatalogEntry` in `shared/types/index.ts`.
- Scenario templates: `DISASTER_TYPE_DEFAULTS` + a "Use demo template" button in `ScenarioForm.tsx` — a
  frontend-only convenience labeled "Demo template values — not a real historical event," never persisted
  as extra database rows.
- Disaster-type selector now shows a one-line description per type (`DISASTER_TYPE_DESCRIPTIONS`), still a
  compact native `<select>`, not a card grid.
- `ScenarioForm.tsx`/`FormField.tsx`/`DisasterParameterFields.tsx` restyled onto the Prompt 8 design tokens
  and `components/ui` primitives, replacing raw Tailwind slate/sky classes.
- Bug fix: `ScenarioForm`'s `<form>` had no `noValidate`, so an out-of-range disaster-specific field (native
  HTML `max`/`min`) silently blocked submission via the browser's own constraint-validation UI before the
  app's styled `validateScenarioForm` error ever had a chance to run.
- New parameter-consumption honesty matrix in docs/development/scenarios.md — a fact-checked table (read
  directly from each `simulation/models/*/model.py`) of which exposed config fields are actually consumed
  by the current demo models vs. accepted-but-metadata-only (e.g. cyclone's `central_pressure_hpa`,
  tsunami's `magnitude` and `propagation_direction_deg`, oil_spill's `oil_type`, search_rescue's
  `vessel_type`).
- 26 new/changed frontend tests (`ScenarioForm.test.tsx`, `ScenarioContextPanel.test.tsx`, 1 new
  `CommandCenterPage.test.tsx` case) — 98 total, all passing. Backend: 45 new/changed tests (disaster-types
  endpoint, seed idempotency, parameterized disaster-type coverage) — 84 total, all passing.
  `simulation/tests`: 57 passing, unchanged.

**Why:**
- A real run in the browser showed the Command Center's scenario selector limited to 2 seeded scenarios,
  reading as if the platform only supported 2 disaster types — even though the backend/frontend already
  supported all 9 since Prompt 6-8. The actual gap was discoverability (seed data + no path to creating a
  new scenario from the Command Center) and polish (generic form styling, no honest accounting of which
  parameters are decorative), not catalog completeness.

**Files/Modules:**
- `backend/app/db/seed.py`, `backend/app/core/disaster_catalog.py` (new),
  `backend/app/schemas/disaster_catalog.py` (new), `backend/app/api/routes/disaster_types.py` (new),
  `backend/app/main.py`.
- `frontend/src/features/scenario-builder/{disasterFieldSpecs,api/scenarioApi}.ts`,
  `frontend/src/features/scenario-builder/components/{ScenarioForm,FormField,ScenarioBuilderPage,
  ScenarioDetailPage,disaster-fields/DisasterParameterFields}.tsx`,
  `frontend/src/features/scenario-builder/hooks/useScenarioForm.ts`,
  `frontend/src/features/scenario-builder/types.ts`.
- `frontend/src/features/command-center/components/ScenarioContextPanel.tsx`.
- `shared/types/index.ts`.
- `docs/development/scenarios.md`, `docs/development/simulation.md`, `docs/development/command-center.md`,
  `architecture.md` (§28c; also restored §28b, which had been accidentally deleted mid-edit).

**Future Context:**
- No browser automation was available in this environment — verified programmatically (tests/lint/build,
  a real `psql` query confirming all 9 types are seeded `READY`, a `TestClient` smoke test of
  `GET /disaster-types`). An actual browser walkthrough of all 9 disaster types (create → run → execute →
  timeline → playback → visualizer) remains the right next check before demo use.
- No real geography/DEM/OSM/buildings/roads/population/infrastructure, no AI/RAG, no impact analysis —
  explicitly out of scope, deferred to Prompt 10+.
- Branch: `feature/complete-disaster-catalog`, off `develop`.

### 2026-09-12 — Timeline Playback Engine (Prompt 9)

**Added/Changed:**
- `useCommandCenterSession.ts` extends its existing single-frame selector (`frames`/`frameIndex`/
  `setFrameIndex`/`currentFrame` — unchanged in shape) with client-side playback: `isPlaying`,
  `playbackSpeed`, `play()`, `pause()`, `togglePlay()`, `setPlaybackSpeed(speed)`. A `useEffect` owns a
  single `setInterval` while `isPlaying && frames.length > 0`, advancing `frameIndex` at
  `PLAYBACK_BASE_INTERVAL_MS (600ms) / playbackSpeed` — a documented UI pacing constant, not a physical or
  simulated timing value (`TimelineFrame` has no duration/fps field). The interval is torn down and rebuilt
  on every `isPlaying`/`playbackSpeed`/`frames` change and on unmount (no orphaned timer, verified with
  Vitest fake timers). A second effect auto-pauses playback the instant `frameIndex` reaches the last frame
  — it clamps there, it never loops back to `0`. Playback is also force-paused whenever the selected
  scenario changes, the selected run changes, or the timeline reloads/empties, so a stale interval can never
  advance a `frameIndex` belonging to a different run's frames. Manually scrubbing (`setFrameIndex`) now
  pauses playback first, then jumps, so a user's explicit scrub always wins over the interval.
- New `PlaybackControls.tsx` (`frontend/src/features/command-center/components/`): a Play/Pause
  `CommandButton` (`aria-pressed` + accessible label, native Space/Enter keyboard support via the browser's
  own `<button>` behavior), a 0.5x/1x/2x/4x speed selector (same `CommandButton` visual language, no new
  button style), and the existing scrub slider — wired into `SimulationStatusPanel`'s existing frame area in
  place of its old bare `<input type="range">`. Only renders when `frames.length > 0`; the "Awaiting
  playback data" empty state (Prompt 8.1) for a completed-but-frameless run is untouched.
- `CommandCenterViewport.tsx`'s `useMemo` keyed on `currentFrame` was confirmed (not changed) to already
  recompute `visualState` correctly on every playback tick — no second 3D/animation system was introduced;
  the scene keeps reacting through the existing `toVisualState`/registry seam one frame at a time.
- 17 new frontend tests: `useCommandCenterSession.test.ts` (9 cases, Vitest fake timers — play advances on
  the documented interval, pause stops it, speed changes the interval's timing, auto-stop at the last frame
  without looping, auto-pause on run/scenario change, manual scrub pauses playback, interval cleanup on
  unmount via `vi.getTimerCount()`), `PlaybackControls.test.tsx` (6 cases), and 2 new
  `CommandCenterPage.test.tsx` cases (Play/Pause `aria-pressed` toggling end to end; dragging the scrub
  slider while playing pauses it) — 72 total, all passing. `npm run lint`/`npm run build` clean.
- `docs/development/command-center.md` (new "Prompt 9 — Timeline Playback Engine" section + "Timeline
  playback" subsection + updated Testing/PLANNED/NOT IMPLEMENTED/manual-verification sections),
  `architecture.md` §28b.

**Why:**
- The command center could execute a simulation run and inspect one timestep at a time via a plain slider,
  but couldn't actually play a disaster's evolution over time — the core "SIMULATE → VISUALIZE" loop
  (CLAUDE.md §2/§6) needs playback, not just a static per-frame picker, and `useCommandCenterSession.ts`'s
  own top comment already flagged this as the next extension point.

**Files/Modules:**
- `frontend/src/features/command-center/hooks/useCommandCenterSession.ts`,
  `frontend/src/features/command-center/components/{PlaybackControls.tsx (new),SimulationStatusPanel.tsx}`,
  `frontend/src/features/command-center/CommandCenterPage.tsx`.
- `frontend/src/features/command-center/tests/{useCommandCenterSession.test.ts (new),
  PlaybackControls.test.tsx (new),CommandCenterPage.test.tsx}`.
- `docs/development/command-center.md`, `architecture.md`.

**Future Context:**
- No backend, WebSocket, or shared-contract change at all — 100% client-side interval-driven playback over
  already-fetched `TimelineFrame[]`, exactly as scoped.
- No browser automation was available in this environment — verified programmatically only (`npm run
  test`/`lint`/`build`, `pytest backend/tests`, `pytest simulation`); actually pressing Play in a real
  browser and watching the 3D scene step through frames remains unverified and should be the first check
  before treating this as demo-ready. The interval/auto-pause state machine's correctness is instead proven
  deterministically via Vitest fake timers.
- Not built: a dedicated full-width bottom timeline scrubber bar (playback lives in the existing compact
  Simulation panel control instead — a deliberate scope choice, documented in
  docs/development/command-center.md), looping playback, and scenario-comparison/A-B playback
  (architecture.md §7/§11 — unrelated future scope).
- Branch: `feature/timeline-playback`, off `develop`.

### 2026-09-12 — Visual Correction: Cinematic Landing Scroll & Command Center Refinement

**Added/Changed:**
- Landing: replaced the stacked-section scroll (`ScrollSequence`/`LandingBeatSection`, removed) with
  `CinematicScroll` — one sticky viewport whose image/text/progress children are driven by a single
  normalized scroll-progress value (`ScrollDriver.ts`'s `useScrollDriver`), applied via direct DOM style
  writes (no per-frame React state). New pure logic module `sceneProgress.ts` (crossfade/Ken-Burns-zoom/
  drift/active-index math, fully unit-tested) plus `ImageStage`/`OverlayGradient`/`NarrativeTypography`/
  `ProgressIndicator` leaf components. Reduced motion renders a separate, non-scroll-driven static stack —
  no scroll listeners attached at all in that mode. Same six existing assets, same `landingAssets.ts`
  mapping — no new/replacement/generated images.
- `/explore` gateway now has a dimmed background image (the existing "cyclone" landing asset,
  `image5.jpg`) instead of a flat void.
- Command center 3D scene, corrected against a specific reported "empty scene / grey polygon" screenshot:
  `AquaCanvas`'s camera pose (wider, lower establishing shot), `CameraController`'s distance/polar-angle
  clamps, `Landmass`'s radius/relief/color ramp/position (smaller, taller relief, vegetation/rock-dominant
  palette, moved off-center as a coastal accent), the water shader (`three/shaders/water.ts` — added a
  chop layer, true view-vector fresnel, a directional sun-glint specular term), and `EnvironmentSystem`
  (added drei's procedural `Sky`, no HDRI/texture download, for an actual horizon).
- `SimulationStatusPanel`'s bare "Timeline data unavailable" replaced with a deliberate "Awaiting playback
  data" state under a "Simulation timeline" label.
- 4 new/changed frontend tests (`sceneProgress.test.ts`, `CinematicScroll.test.tsx`, one new
  `CommandCenterPage.test.tsx` case) — 55 total, all passing.
- `docs/development/command-center.md` (new "Prompt 8.1 — Visual correction" section + updates throughout),
  `architecture.md` §28a.

**Why:**
- A real run in a browser (screenshot review) showed the shipped Prompt 8 visuals diverging from intent:
  stacked landing cards instead of one cinematic sequence, and a command center that read as an empty dark
  scene with an unfinished-looking grey polygon rather than a command center. This is a corrective pass,
  not a new feature — no architecture change, no fake data, no Prompt 9 functionality.

**Files/Modules:**
- `frontend/src/features/landing/{sceneProgress,ScrollDriver,ImageStage,OverlayGradient,
  NarrativeTypography,ProgressIndicator,CinematicScroll}.{ts,tsx}` (new),
  `frontend/src/features/landing/{ScrollSequence,LandingBeatSection}.tsx` (removed),
  `frontend/src/features/landing/{LandingPage,ExploreTransition}.tsx`.
- `frontend/src/three/core/{AquaCanvas,CameraController,EnvironmentSystem}.tsx`,
  `frontend/src/three/terrain/Landmass.tsx`, `frontend/src/three/shaders/water.ts`,
  `frontend/src/three/water/waterMaterial.ts`.
- `frontend/src/features/command-center/components/SimulationStatusPanel.tsx`.
- `docs/development/command-center.md`, `architecture.md`.

**Future Context:**
- No browser automation was available in this environment for this pass either — verified programmatically
  (`npm run test`/`lint`/`build`, `pytest backend/tests`, `pytest simulation`), not visually. Actually
  scrolling the corrected sequence and observing the corrected camera/terrain/water/sky in a real browser
  remains the first thing to check before treating this as demo-ready.
- Branch: `feature/visual-correction`, off `develop`.
- Routing, the simulation adapter/registry, `useCommandCenterSession`'s data flow, and the backend are
  unchanged — this was a visual-only pass, exactly as scoped.

### 2026-09-12 — AAA 3D Command Center & Landing

**Added/Changed:**
- Routing (`react-router-dom@7.18.3`, first router in the project — ADR-001's deferred decision): `/`
  (landing), `/explore` (gateway), `/command-center` (lazy-loaded), `/scenarios` (Prompt 6 builder,
  preserved, also lazy-loaded).
- Cinematic landing (`frontend/src/features/landing/`): a six-beat scroll sequence built from the six
  provided assets (repo-root `assets/image1-6.png`, resized/re-encoded into
  `frontend/src/assets/landing/*.jpg` — not replaced or substituted), explicit asset->beat mapping
  (`landingAssets.ts`), Anime.js v4 scroll-scrubbed parallax + threshold text reveal, all reverted on
  unmount. `ExploreGatewayPage` hosts a from-scratch `LiquidMetalButton` CTA (rotating conic-gradient
  border) with a real page-transition into the command center.
- Anime.js v4 utility layer (`frontend/src/animations/{presets,transitions,scroll,stagger,cleanup}.ts`) —
  reusable primitives, promise-based whole-screen transitions, one cleanup path every animation goes
  through.
- Full Three.js/R3F/Drei scene graph (`frontend/src/three/`): `AquaCanvas`/`SceneRoot` (the one `<Canvas>`
  in the app), `CameraController`/`LightingSystem`/`EnvironmentSystem`, a custom vertex/fragment water
  shader, a procedurally displaced landmass, GPU-instanced particles, and a marker/label system.
- `three/adapters/simulationVisualAdapter.ts` — the seam between Prompt 7's `SimulationState` and
  rendering — plus `three/disasters/registry.ts` and five visualizers (flood, tsunami, cyclone, oil spill,
  search & rescue; `chemical_pollution`/`flash_flood`/`coastal_flood`/`storm_surge` reuse the same pattern
  `simulation/core/registry.py` established server-side).
- Command center feature (`frontend/src/features/command-center/`): real integration with Prompt 7 —
  scenario selection, run creation/execution (`POST /simulation-runs/{id}/execute`), timeline retrieval,
  frame selection — with loading/error/empty states throughout, no fabricated data.
- Reusable UI component library + design tokens (`frontend/src/components/ui/`,
  `frontend/src/styles/tokens.css` — Tailwind v4 `@theme`).
- Shared contract addition: `SimulationRunDetail`, `SimulationArtifactOut`, `TimelineResponse` in
  `shared/types/index.ts`, mirroring `backend/app/schemas/simulation.py` (its first frontend consumer).
- Lazy loading: `CommandCenterPage` and `ScenarioBuilderFeature` are both `React.lazy`/`Suspense`; verified
  via `npm run build` chunk output (initial bundle ~97 KB gzip; the Three.js-heavy command center chunk,
  ~255 KB gzip, loads only on `/command-center`).
- 30 new frontend tests (registry, adapter, pipeline, landing assets, command center data flow with a
  mocked API, app routing) — 37 total, all passing. `npm run lint`/`npm run build` clean.
- Removed the now-superseded bootstrap-phase `three/core/BootstrapCanvas.tsx` (unreferenced once
  `SceneRoot` existed).
- `docs/development/command-center.md`; updates to architecture.md (§28), CLAUDE.md (§27).

**Why:**
- Establishes the first visually complete AQUASHIELD experience and the reusable 3D/animation/UI
  architecture Prompts 9-14 build on, per this phase's explicit brief — a real seam
  (`simulationVisualAdapter`) between Prompt 7's simulation contracts and the 3D scene, not a hardcoded
  demo.
- The six provided images, not placeholders, needed an explicit mapping/config (not scattered hardcoded
  paths) so the disaster categories they represent stay traceable to their source files.
- Routing was added now because this phase is the first time the app has more than one distinct,
  URL-addressable screen — exactly the condition ADR-001 set for introducing one.

**Files/Modules:**
- `frontend/src/features/landing/**`, `frontend/src/features/command-center/**`,
  `frontend/src/three/**`, `frontend/src/animations/{cleanup,presets,scroll,stagger,transitions}.ts`,
  `frontend/src/components/ui/**`, `frontend/src/components/ErrorBoundary.tsx`,
  `frontend/src/hooks/usePrefersReducedMotion.ts`, `frontend/src/styles/tokens.css`,
  `frontend/src/app/App.tsx(+test)`, `frontend/package.json` (react-router-dom).
- `frontend/src/assets/landing/*.jpg` (from repo-root `assets/*.png`, resized/re-encoded).
- `shared/types/index.ts`.
- `docs/development/command-center.md`, `architecture.md`, `CLAUDE.md`.

**Future Context:**
- No timeline playback/scrubbing, WebSocket streaming, risk engine, AI agents, RAG, or response planning —
  exactly as scoped (Prompt 8's explicit hard stop). `useCommandCenterSession`'s single-frame selector is
  the foundation Prompt 9 extends into full playback.
- No automated WebGL scene-render test: `@react-three/test-renderer` was evaluated and dropped — its mock
  GL context doesn't implement `texImage3D`, which `three@0.186.0`'s `WebGLRenderer` now requires
  unconditionally. Scene-graph correctness is covered at the adapter/registry seam instead
  (`three/pipeline.test.ts` and friends); see docs/development/command-center.md "Known limitation."
- No browser automation was available in this environment — the production build, lint, and full test
  suite are verified; actual rendered visual/interactive behavior (scroll feel, 3D rendering, click-through
  flow) was not, and should be checked in a real browser before this is treated as demo-ready.
- Branch: `feature/aaa-3d-command-center`, off `develop`. Not merged into `main` in this task.

### 2026-09-12 — Simulation Engine Foundation

**Added/Changed:**
- Standalone `simulation/` package (no FastAPI/SQLAlchemy/React dependency): `simulation/core/` —
  `SimulationClock`/`build_clock` (integer-minute arithmetic), `SimulationState`/`TimelineFrame`
  dataclasses, `DisasterModel` ABC, `MODEL_REGISTRY`/`get_model_class`, `SimulationEngine`
  (initialize/step/run/is_complete), plain great-circle geo helpers (`haversine_km`/`move_point`/
  `circle_polygon`), and `SimulationConfigError`/`SimulationExecutionError`.
- Five SIMPLIFIED DEMONSTRATION disaster models (`simulation/models/<type>/model.py`): `flood-demo-v1`,
  `tsunami-demo-v1`, `cyclone-demo-v1`, `oil-spill-demo-v1`, `search-rescue-demo-v1` — each declares its
  assumptions/scientific-validation disclaimer via `describe()`. `flash_flood`/`coastal_flood` reuse
  `FloodModel`, `storm_surge` reuses `CycloneModel`, `chemical_pollution` reuses `OilSpillModel`.
- `backend/app/services/simulation_service.py` — orchestrates execution: `PENDING → RUNNING →
  COMPLETED`/`FAILED`, writes a JSON timeline artifact (`simulation/outputs/{run_id}.json`) plus a
  `SimulationArtifact` metadata row, records the seed used back onto `SimulationRun.timestep_config`.
- `backend/app/repositories/simulation_artifact_repository.py`, `backend/app/schemas/simulation.py`.
- New API: `GET /simulation-runs/{run_id}`, `POST /simulation-runs/{run_id}/execute`, `GET
  /simulation-runs/{run_id}/timeline` (`backend/app/api/routes/simulation_runs.py`) — distinct from Prompt
  6's `POST /scenarios/{id}/runs` (still metadata-only creation). New exception handlers in `app/main.py`
  (404/409/400/500).
- `sys.path` repo-root bootstrap in `backend/app/main.py` and `backend/tests/conftest.py` so
  `app.services.simulation_service` can import the sibling `simulation/` domain (ADR-002: no per-domain
  packaging).
- 57 simulation-package tests (`simulation/tests/`) — engine, clock, geo, registry, determinism,
  per-model behavior, performance — plus 9 new backend integration tests
  (`backend/tests/api/test_simulation_runs.py`) against real PostgreSQL/PostGIS; 39 backend tests total,
  all passing. `alembic check` clean (no schema change — `SimulationRun`/`SimulationArtifact` tables
  already existed from Prompt 5).
- `docs/development/simulation.md`; updates to architecture.md (§27), CLAUDE.md (§23, §26),
  `backend/.env.example`.

**Why:**
- Establishes the deterministic, time-based simulation architecture every future subsystem (3D
  visualization, WebSocket streaming, risk engine, AI agents, RAG) consumes — per CLAUDE.md §5, the engine
  computes hazard/environmental state; it never invents a risk conclusion or response recommendation.
- Determinism (explicit seed, no uncontrolled randomness) is required for scenario replay/comparison,
  debugging, and auditability (architecture.md §7/§11) — verified directly by tests, not assumed.
- Synchronous execution and a local JSON artifact are deliberate, documented Prompt 7 prototype choices
  (§21/§22/§26), not oversights — both are called out as the first thing a future phase would replace.

**Files/Modules:**
- `simulation/__init__.py`, `simulation/core/{__init__,time,state,model,engine,registry,geo,errors}.py`,
  `simulation/models/{flood,tsunami,cyclone,oil_spill,search_rescue}/{__init__,model}.py`,
  `simulation/tests/*.py` (removed now-redundant `.gitkeep` files from populated directories).
- `backend/app/services/simulation_service.py`, `backend/app/repositories/simulation_artifact_repository.py`,
  `backend/app/schemas/simulation.py`, `backend/app/api/routes/simulation_runs.py`, `backend/app/main.py`,
  `backend/app/config/settings.py` (`simulation_output_dir`), `backend/tests/conftest.py`,
  `backend/tests/api/test_simulation_runs.py`, `backend/.env.example`.
- `docs/development/simulation.md`, `architecture.md`, `CLAUDE.md`.

**Future Context:**
- No 3D visualization, WebSocket streaming, risk engine, AI agents, or RAG — this phase stops at a
  `SimulationRun` producing structured `TimelineFrame`s a future renderer/risk engine can consume, exactly
  as scoped (Prompt 7's explicit hard stop).
- `SimulationState.risk_state`/`infrastructure_impacts` stay empty — populated by the future risk engine
  (Prompt 10) from this engine's raw `hazard_state`/`environmental_state`/`affected_area` output.
- Execution is synchronous and storage is a local JSON file — both explicitly flagged in
  docs/development/simulation.md as the first things a future phase (async job queue; NetCDF/Zarr/object
  storage) would replace, without needing to change the `SimulationRun`/`SimulationArtifact` schema or the
  timeline API shape.
- Branch: `feature/simulation-engine`, off `develop`. Not merged into `main` in this task, per instruction.

### 2026-09-11 — Scenario Management Foundation

**Added/Changed:**
- Scenario API: `POST/GET /scenarios`, `GET/PATCH/DELETE /scenarios/{id}`, `POST /scenarios/{id}/duplicate`,
  `GET/POST /scenarios/{id}/versions`, `GET/POST /scenarios/{id}/runs` (`backend/app/api/routes/scenarios.py`).
- Layered backend: `app/schemas/scenario.py` (API contracts) + `app/schemas/scenario_config.py`
  (disaster-specific validation) → `app/services/scenario_service.py` (domain logic) →
  `app/repositories/{scenario,simulation_run}_repository.py` (persistence) → PostgreSQL/PostGIS.
- Scenario lifecycle (`draft`/`ready`/`archived` — renamed from `draft`/`active`/`archived`, migration
  `32b3edf8f402`), immutable scenario versioning, duplication, archiving-not-hard-deleting, and pending
  SimulationRun metadata creation (no physics, no fake results).
- Pagination, filtering (disaster_type, status, search), and whitelisted sorting on `GET /scenarios`.
- New shared contract: `SimulationRun` (JSON Schema + Python + TypeScript mirrors).
- Scenario Builder frontend (`frontend/src/features/scenario-builder/`): dynamic disaster-specific form,
  client-side validation, typed API client, Scenario List/Detail pages, version history, simulation-run
  creation UI — wired into `App.tsx` as the app's main content.
- Frontend now imports `shared/types/index.ts` directly via a `@shared/*` Vite/TS alias.
- 30 backend tests (scenario API + existing DB suite) and 12 frontend tests, all passing against a real
  PostgreSQL/PostGIS instance.
- `docs/development/scenarios.md`; updates to README.md, CLAUDE.md, architecture.md, docs/development/setup.md.

**Why:**
- This is the first genuinely functional vertical slice — proves the full stack (React → FastAPI → service →
  repository → PostgreSQL/PostGIS) works end-to-end before any simulation physics exists to build on top of it.
- Strict route/service/repository layering now, before more features arrive, so the pattern is established
  rather than retrofitted.
- Scenario configuration is versioned (never overwritten) specifically to support future replay/comparison
  ("what happens if we change X") — architecture.md §11/§7.

**Files/Modules:**
- `backend/app/api/routes/scenarios.py`, `backend/app/schemas/{scenario,scenario_config}.py`,
  `backend/app/services/scenario_service.py`, `backend/app/repositories/{scenario,simulation_run}_repository.py`,
  `backend/app/db/geo.py`, `backend/app/main.py` (exception handlers + router).
- `backend/alembic/versions/32b3edf8f402_*.py` (ScenarioStatus rename), `backend/app/db/models/enums.py`,
  `backend/app/db/seed.py`.
- `backend/tests/api/test_scenarios.py`, `backend/tests/conftest.py` (added `client` fixture).
- `shared/contracts/simulation_run.schema.json`, `shared/schemas/python/contracts.py`, `shared/types/index.ts`,
  `shared/constants/enums.json`.
- `frontend/src/features/scenario-builder/**`, `frontend/src/app/App.tsx`, `frontend/vite.config.ts`,
  `frontend/tsconfig.json`.
- `docs/development/scenarios.md`, architecture.md, CLAUDE.md, README.md, docs/development/setup.md.

**Future Context:**
- No simulation physics, AI agents, or RAG — `SimulationRun` creation is metadata-only, exactly as scoped.
- No router installed on the frontend yet — the Scenario Builder feature uses local view-state switching;
  add a router when the app has enough distinct views to need URL-addressable routes.
- The next phase (simulation engine) consumes `SimulationRun` + `ScenarioVersion.scenario_config` and writes
  `SimulationArtifact` rows — no schema changes anticipated for that integration.

### 2026-09-11 — Database & Shared Contract Foundation

**Added/Changed:**
- PostgreSQL/PostGIS foundation (`infrastructure/docker-compose.yml`, `backend/app/db/`).
- SQLAlchemy 2.0 models for all 10 core entities: Scenario, ScenarioVersion, SimulationRun, RiskAssessment,
  VulnerabilityAssessment, ResponseRecommendation, IncidentActionPlan, InfrastructureAsset,
  SimulationArtifact, AuditEvent.
- Alembic wired to SQLAlchemy metadata (`backend/alembic/`), with GeoAlchemy2's `alembic_helpers` for correct
  PostGIS type rendering. One migration (`foundational_schema`) creates the full schema.
- `backend/app/db/seed.py` — synthetic dev/demo seed data (3 scenarios across flood/tsunami/oil_spill, versions,
  runs, 3 infrastructure assets with Point/LineString/Polygon geometry, risk assessments, a recommendation).
- `GET /health/db` — minimal FastAPI → SQLAlchemy → PostgreSQL connectivity check.
- 13 shared contracts: canonical JSON Schema (`shared/contracts/*.schema.json`) + hand-maintained Pydantic v2
  (`shared/schemas/python/contracts.py`) and TypeScript (`shared/types/index.ts`) mirrors, plus
  `shared/constants/enums.json` as the canonical enum-value list.
- `docs/development/database.md`; updates to README.md, CLAUDE.md, architecture.md (ADR-003, §14a, §25),
  docs/development/setup.md.
- 12 new backend tests (`backend/tests/db/`) covering config, connection, migrations, model CRUD/relationships,
  PostGIS spatial storage/query, and seed data — all require a real PostgreSQL/PostGIS instance and skip
  cleanly (not silently on SQLite) when one isn't reachable.

**Why:**
- Application state (scenarios, runs, risk/vulnerability results, recommendations, IAPs, infrastructure
  assets) needs real transactions, foreign keys, and constraints — a relational database, not ad hoc JSON files.
- PostGIS gives first-class geometry/geography types and GIST spatial indexing for infrastructure assets and
  scenario locations in the same database, avoiding a second geospatial service.
- Shared contracts prevent frontend, backend, and future agents/RAG code from independently inventing
  incompatible shapes for the same concept (Scenario, SimulationState, etc.) — see architecture.md §22.

**Files/Modules:**
- `backend/app/db/` (base.py, session.py, init_db.py, models/, seed.py), `backend/alembic/`,
  `backend/app/api/routes/health.py` (added `/health/db`), `backend/tests/db/`, `backend/tests/conftest.py`.
- `infrastructure/docker-compose.yml`, root `requirements.txt` (sqlalchemy, alembic, geoalchemy2, psycopg).
- `shared/contracts/*.schema.json`, `shared/schemas/python/contracts.py`, `shared/types/index.ts`,
  `shared/constants/enums.json`.
- `docs/development/database.md`, `docs/development/setup.md`, `README.md`, `CLAUDE.md`, `architecture.md`.

**Future Context:**
- Docker was unavailable in the environment this was built in; `infrastructure/docker-compose.yml` is written
  and documented but was not itself run. All verification (migrations up/down/up, spatial queries, seed data,
  `/health/db`, the full pytest suite) ran against a local Homebrew PostgreSQL 18 + PostGIS 3.6 instance
  instead — same engine/extension. Confirm `docker compose -f infrastructure/docker-compose.yml up -d` works
  in your environment before relying on it.
- No CRUD API beyond `/health/db` — intentionally out of scope for this phase.
- No simulation engine, AI agents, or RAG ingestion writes to these tables yet; they're the target of future
  prompts, not this one.
- Two documented GeoAlchemy2/Alembic gotchas future migrations must repeat correctly: duplicate spatial-index
  creation, and Postgres ENUM types not being dropped by `drop_table` — see docs/development/database.md.

### 2026-09-11 — TECHNOLOGY BOOTSTRAP

**Added/Changed:**
- Bootstrapped React + TypeScript + Vite frontend (`frontend/`), strict TypeScript, Tailwind CSS v4.
- Added Three.js / React Three Fiber / Drei foundation — a minimal `BootstrapCanvas` verifies the render
  pipeline; not an AQUASHIELD scene.
- Added Anime.js foundation — a minimal `useFadeIn` micro-interaction hook verifies the integration.
- Added ESLint (flat config) + Prettier; `npm run lint` and `npm run build` pass clean.
- Added Vitest + React Testing Library; one smoke test passes.
- Bootstrapped FastAPI backend (`backend/`) with `GET /health` and a `/ws` connectivity-check WebSocket.
- Configured dev-only CORS on the backend for the Vite dev origin.
- Added Python scientific/geospatial dependencies (NumPy, SciPy, xarray, Shapely, GeoPandas) — import-verified.
- Added LangGraph + langchain-core, ChromaDB — import-verified, not implemented.
- Added pytest backend test for `/health`.
- Added `frontend/.env.example` and `backend/.env.example`; documented env vars in docs/development/setup.md.
- Added docs/development/setup.md; updated root README.md with a Development Setup section.
- Updated architecture.md (§23 Frontend Framework Decision, §24 Technology Bootstrap) and CLAUDE.md (§23
  Bootstrap Status).

**Why:**
- A runnable skeleton (frontend serving, backend serving, frontend reaching backend over REST and WebSocket)
  is required before any real feature work can build on top of it.
- `react`/`react-dom` pinned to `19.2.8` (not `19.3.0`) because `@react-three/fiber@9.x` requires `react <19.3`.
- `typescript` pinned to `5.9.3` (not the new `7.0.2` Go-based compiler line) because `typescript-eslint@8.70.0`
  requires `typescript <6.1.0`.

**Files/Modules:**
- frontend/ (package.json, vite.config.ts, tsconfig.json, index.html, eslint.config.js, .prettierrc.json,
  src/main.tsx, src/app/App.tsx(+test), src/api/health.ts, src/hooks/useHealthCheck.ts,
  src/three/core/BootstrapCanvas.tsx, src/animations/micro-interactions/useFadeIn.ts, src/styles/index.css,
  src/test/setup.ts, src/vite-env.d.ts, .env.example)
- backend/ (app/main.py, app/config/settings.py, app/api/routes/health.py,
  app/api/websocket/connectivity.py, tests/test_health.py, .env.example)
- requirements.txt (pinned), architecture.md, CLAUDE.md, README.md, docs/development/setup.md.

**Future Context:**
- No disaster simulation, AI agents, RAG pipeline, or production 3D environment implemented yet.
- `.venv/` is a single shared Python environment for backend/simulation/agents/rag (ADR-002) — created at repo
  root, not inside `backend/`.
- Branch: `feature/project-bootstrap`, off `develop`.

### 2026-09-11 — GIT FOUNDATION

**Added/Changed:**
- Initialized Git repository.
- Connected project to GitHub (`https://github.com/SayantanXBTC/Aquashield.git`).
- Established `main` branch (root commit `c058d45`, pushed).
- Established `develop` integration branch (pushed).
- Established feature branch strategy and commit convention.
- Extended `.gitignore` to exclude `.claude/` and `skills-lock.json` (Claude Code project config, not part of the application).
- Documented Git architecture, repository ownership, integration boundaries, and shared contract strategy in architecture.md.
- Documented Git rules in CLAUDE.md.
- Expanded docs/development/git-workflow.md with commit convention, feature workflow, shared-contract-change process, and emergency rules.

**Why:**
- `.claude/` and `skills-lock.json` are local Claude Code tooling config, not application source — keeping them out of the repo avoids polluting the GitHub history with editor/agent tooling state.
- A documented branch/commit strategy up front avoids ad hoc conventions once multiple contributors/branches are active.

**Files/Modules:**
- .gitignore, CLAUDE.md, architecture.md, docs/development/git-workflow.md, CHANGELOG.md.

**Future Context:**
- Feature work should branch from `develop`, never from `main` directly.
- `develop` is the integration branch; `main` contains stable/release-ready code only.
- Shared contracts (`shared/`) are the integration boundary between domains — see architecture.md §22.
- No `feature/*` branches created yet — created only when the corresponding work starts.

### 2026-09-11 — REPOSITORY STRUCTURE ESTABLISHED

**Added:**
- Domain directories: frontend/, backend/, simulation/, agents/, rag/, data/, shared/, tests/, docs/, scripts/, infrastructure/, each with a README.md documenting purpose and ownership.
- Root config scaffolds: .gitignore, .env.example, frontend/package.json (no deps installed), root requirements.txt (no packages pinned).
- docs/development/git-workflow.md — branch strategy and conflict-prevention rules.
- README.md — concise project introduction.
- architecture.md §18 Repository Architecture; CLAUDE.md §21 Repository Structure Rules; ADR-002 (requirements.txt over pyproject.toml).

**Why:**
- Established domain boundaries so Git branches can be scoped to one domain with minimal cross-branch conflicts.
- Established shared/ as the single integration surface between frontend, backend, simulation, agents, and rag.
- Kept the 3D subsystem (frontend/src/three/) and animation subsystem (frontend/src/animations/) explicitly separated from generic UI and from each other.

**Files/Modules:**
- All top-level domain directories and their READMEs; root config files; architecture.md; CLAUDE.md; docs/development/git-workflow.md.

**Future Context:**
- No application features, UI, simulation, agents, APIs, or WebSockets implemented yet — structure and documentation only.
- Python dependency strategy: one shared root requirements.txt across backend/simulation/agents/rag (ADR-002).
- Frontend package.json has no dependencies installed yet — none of the stack has been added.
- Next phase: not yet defined — awaiting instruction.

### 2026-09-11 — PROJECT INITIALIZATION

**Added:**
- CLAUDE.md
- architecture.md
- CHANGELOG.md

**Why:**
- Established development rules.
- Established disaster-agnostic architecture.
- Established simulation/animation architecture.
- Established AI/RAG architecture.
- Established persistent session context.

**Files/Modules:**
- CLAUDE.md
- architecture.md
- CHANGELOG.md

**Future Context:**
- No application code, folder structure, or dependencies have been created yet.
- Frontend framework decision recorded (Vite over Next.js) — see architecture.md ADR-001.
- Next phase: folder structure design (not started).
