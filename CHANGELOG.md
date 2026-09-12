# AQUASHIELD — Development Changelog

### 2026-09-12 — Structures actually fail when hit; Intelligence panel condensed

**Added/Changed:**
- `three/structures/collapse.ts` — failure now spans the `impacted` and `severe` bands (`IMPACTED_SHARE`
  0.72) with a front-loaded ramp, short overlapping piece delays and a crumble (pieces lose height as they
  go). Pieces topple downstream of the hazard's heading, in the model's own frame, instead of in random
  directions. Stress/lean moved to the `at_risk` band.
- `IntelligencePanel` rewritten for density: a three-number summary row (exposed / top priority / actions),
  top-4 rows per section with an explicit "+n more" line, statements and prerequisites moved to tooltips,
  and evidence ids, run metadata, uncertainties, validator notes and the full disclaimer moved into a
  collapsed audit block.
- Tests: `collapse.test.ts` pins the demo tsunami (~0.47) and cyclone (~0.66) exposure peaks to visible
  failure, plus monotonicity; `IntelligencePanel.test.tsx` covers the summary row, the held-back count and
  the id fallback. Frontend suite 48 passing.

**Why:**
- Buildings never collapsed. Failure started above `EXPOSURE_IMPACTED` (0.7), but demo hazards peak
  mid-`impacted` — a tsunami around 0.47, a cyclone around 0.66 — so the ramp was unreachable in practice
  and structures stood untouched inside the footprint, which reads as "the hazard missed".
- The brief was a wall of prose in a 320 px rail. An operator scanning it needs the counts, the top
  subjects and the proposed actions; evidence ids and prerequisites are what they check afterwards.

**Files/Modules:**
- `frontend/src/three/structures/{collapse.ts,collapse.test.ts,StructureModel.tsx}`
- `frontend/src/features/command-center/components/{IntelligencePanel.tsx,IntelligencePanel.test.tsx}`
- `architecture.md` §28a, `docs/development/command-center.md`, `CLAUDE.md` §27

**Future Context:**
- The exposure bands, not this module, decide what is drawn. If the propagation rules ever produce higher
  exposures, retune `IMPACTED_SHARE` rather than adding a threshold here.
- The panel's `MAX_ROWS` is the density dial. Raising it trades scanability for completeness; the audit
  block already holds everything.

### 2026-09-12 — World scenery: instanced forest, ground-fitted structures, illustrative structural response

**Added/Changed:**
- `frontend/src/three/vegetation/` — ~4,000 instanced trees (conifer, broadleaf, palm fringe) over the land
  plate: `worldNoise.ts` (JS twin of the terrain shader's fbm), `forestPlacement.ts` (pure, deterministic,
  GPU-free), `treeGeometry.ts`, `forestMaterial.ts` (vertex-shader wind sway + inundated-canopy response,
  one module-level uniform block), `ForestLayer.tsx` (six draw calls, clearings around placed structures).
  Mounted in `SceneRoot`.
- `three/structures/support.ts` — `footprintGround` samples two rings of `terrainHeightKm` so a structure
  sits on the highest ground under its footprint with a foundation reaching past the lowest, instead of
  floating on its downhill corner from a single centre sample.
- `three/structures/collapse.ts` + `models/index.tsx` `FailingPiece` — models lean from `at_risk` and come
  apart piece by piece inside `severe`, settling into a debris field. Thresholds imported from
  `propagation/structures.ts`; pure function of the current exposure, so scrubbing the timeline back stands
  the structure up; oil spills never collapse anything.
- `StructuresPanel` states the caveat in the UI: the structural response illustrates the exposure band and is
  not a damage, collapse or casualty estimate.
- Tests: `forestPlacement.test.ts` (6) and `collapse.test.ts` (5). Frontend suite 45 passing.

**Why:**
- The land plate read as flat painted colour and the structures floated on the slope; the scene needed real
  relief cues and structures that meet the ground.
- Showing the exposure band ON the model is far more legible than four status colours — but AQUASHIELD has no
  damage model, so it had to be built as an explicitly-labelled illustration that reverses with the timeline
  (CLAUDE.md §25/§26a), not as a destruction animation.

**Files/Modules:**
- `frontend/src/three/vegetation/*`, `frontend/src/three/structures/{collapse.ts,support.ts,StructureModel.tsx,models/index.tsx}`,
  `frontend/src/three/core/SceneRoot.tsx`, `frontend/src/features/command-center/components/StructuresPanel.tsx`
- `architecture.md` §28a, `docs/development/command-center.md`, `CLAUDE.md` §23/§27

**Future Context:**
- The JS/GLSL noise twin is the fragile part: the GLSL hash fracts only the FINAL product. An earlier twin
  also fract'ed the intermediate, dropping the noise mean from ~0.5 to ~0.25 and leaving 93 trees on a 300 km
  world — which looks like a design choice, not a bug. `forestPlacement.test.ts` guards the distribution.
- Shaders still have no automated render test. They were verified to compile in headless Chrome with
  SwiftShader via a throwaway page; the technique is written up in docs/development/command-center.md.
- Tree scale is exaggerated like everything else in this world (a tree is ~1-2 km tall next to a 3 km town
  block). Do not "correct" it to real scale — it would be invisible.

### 2026-09-12 — HUD rail layout fix + agent pipeline grouped by superstep

**Added/Changed:**
- `HudPanel` gains `shrink-0`. The HUD rails are flex columns, so every panel was being squashed to fit and
  its body clipped mid-line — telemetry readouts cut in half, the agent list showing only its first rows —
  which read as panels overlapping. Panels now keep their natural height and the rail scrolls.
- `AgentExecutionHud` groups its chips by the graph's supersteps (`AGENT_STAGES` / `byStage`), marking the
  Analyse and Advise stages `‖ in tandem`, so the parallel branches are legible as parallel.
- `AgentExecutionHud` moved to the left rail (tests, parameters, pipeline); the right rail keeps telemetry,
  structures, recorded runs and intelligence. Balances the two rails so neither scrolls far.
- `IntelligencePanel` inner scroll capped at 38vh (was 46vh).

**Why:**
- The clipping was a pre-existing flex bug that only became obvious once the rail carried five panels.
- "Working in tandem" is a property of the graph; the HUD now shows it structurally instead of relying on
  timings that the local deterministic provider finishes in single-digit milliseconds.

**Files/Modules:**
- `frontend/src/features/command-center/components/{HudPanel,AgentExecutionHud,IntelligencePanel}.tsx`,
  `.../ai/agentRoster.ts`, `.../CommandCenterPage.tsx`

**Future Context:**
- `shrink-0` on `HudPanel` is load-bearing for every rail, not just the AI panels — don't remove it to "fix"
  a tall panel; cap that panel's own body instead.

### 2026-09-12 — Frame-synchronised multi-agent analysis in the command center (Prompt 15)

**Added/Changed:**
- `agents/`: graph expanded from 3 to 9 nodes — Context Collector → (Hazard ‖ Damage ‖ Risk) →
  (Precaution ‖ Response) → Resource → Safety Validator → Command Synthesizer. Conditional routing skips the
  analysis tiers when no analysable frame exists; a failing agent is recorded `FAILED` + `AGENT_FAILED`
  limitation and the graph continues. New closed schemas (`HazardAssessment`, `DamageAssessment`,
  `RiskAssessment`, `PrecautionSet`, `ResponsePlan`, `ResourceAssessment`), `AgentRun` records, and
  `CommandBrief.precautions` / `resource_status` / `agent_runs`. `GraphDeps.emit` streams milestones.
  `PROMPT_VERSION` bumped to `2026-09-12.2`.
- Backend: `POST /ai/analyze-frame` (scenario_version_id + request_type), `409 AI_ANALYSIS_STALE` guard,
  per-owner in-process `AIEventBus`, `/ws/ai` milestone socket (token query param, same verifier),
  migration `9a1f63c05d72` adding `ai_requests.scenario_version_id` and `ai_requests.request_type`.
- Frontend: `ai/analysisScheduler.ts` (playback throttle 5 s, scrub debounce 600 ms, immediate on
  pause/complete/manual, frame cache, stale/superseded discard), `ai/useAIOrchestrator.ts`,
  `ai/useAIEvents.ts`, `ai/agentRoster.ts`, `components/AgentExecutionHud.tsx`,
  `components/IntelligencePanel.tsx`, mounted in the command center's right rail.
  `components/CommandBriefPanel.tsx` removed (superseded).
- Shared contracts: `AIAgentRun`, `AIAgentExecutionStatus`, `AIRequestType`, `AIEvent`, extended
  `CommandBrief` / `AIRequestOut`.
- Tests: agents 22 (was 17), backend 162 passing against PostgreSQL/PostGIS (new stale, frame-isolation,
  agent-run and WebSocket tests; new `tests/test_ai_events.py`), frontend 45 (new scheduler and panel suites).

**Why:**
- Prompt 15 — the operator needs the agents working while the timeline plays, without a graph run per frame
  (UI stalls, LLM cost) and without ever seeing an answer about a frame or configuration they have left.
- Splitting the two analysts into six specialised agents makes each output independently validatable and lets
  one agent fail without losing the brief.

**Files/Modules:**
- `agents/agents/{hazard,vulnerability,tactical,resource,command}/*`, `agents/graph/workflow/graph.py`,
  `agents/schemas/{outputs,brief,state}.py`, `agents/llm/local_rules.py`, `agents/prompts/versions.py`
- `backend/app/services/{ai_events,ai_analysis_service}.py`, `backend/app/api/websocket/ai_events.py`,
  `backend/app/api/routes/ai.py`, `backend/app/schemas/ai.py`, `backend/app/db/models/ai_request.py`,
  `backend/alembic/versions/9a1f63c05d72_ai_request_frame_sync.py`
- `frontend/src/features/command-center/ai/*`, `.../components/{AgentExecutionHud,IntelligencePanel}.tsx`,
  `.../CommandCenterPage.tsx`, `shared/types/index.ts`
- `architecture.md` §30/§30a, `docs/agents/ai-layer.md`, `CLAUDE.md` §23/§26a

**Future Context:**
- `AIEventBus` is in-process: a multi-worker deployment needs a real broker before `/ws/ai` is reliable.
- The Resource Agent is a live seam, not a stub to delete: flip `resource_agent.has_resource_inventory` when a
  verified inventory data source exists, and it starts reporting instead of `RESOURCE_DATA_UNAVAILABLE`.
- `EvidenceRetriever` still returns `NOT_CONFIGURED` — RAG remains out of scope.
- Execution is still synchronous; the scheduler is what keeps that acceptable. If a hosted provider makes a
  run slow enough to block a worker, move execution to a job queue rather than loosening the throttle.

### 2026-09-12 — Read-only multi-agent AI intelligence layer (Prompt 14)

**Added/Changed:**
- `agents/` implemented: LangGraph 3-agent graph (Context Collector → Impact Analyst ‖ Tactical Advisor →
  Synthesis & Safety), Pydantic `AquaShieldAgentState` and `CommandBrief`, evidence registry, prompt-injection
  sanitizer, `SafetyValidator` (unknown-evidence / ungrounded-number / destruction-wording stripping), human-
  gated actions with `RESOURCE_DATA_UNAVAILABLE`, `EvidenceRetriever` stub returning `NOT_CONFIGURED`.
- `LLMProvider` abstraction: `LocalDeterministicProvider` (default, offline) and `AnthropicProvider`
  (official SDK, `messages.parse` structured outputs). `anthropic==1.5.0` added to requirements.
- Backend: `ai_requests` audit table (migration `7c4e2a91b3d5`), `AIRequestRepository`,
  `BackendAnalysisDataAccess` (read-only adapter over existing services), `AIAnalysisService`, routes
  `POST /ai/analyze`, `GET /ai/requests/{id}`, `/status`, `/result`. Settings `AI_PROVIDER`, `AI_MODEL`,
  `ANTHROPIC_API_KEY`.
- Frontend: TypeScript mirrors in `shared/types`, `aiApi.ts`, one additive collapsed "AI command brief" HUD
  panel. No other UI change.
- Tests: 17 agents tests, 6 backend AI API tests; `scripts/ai_e2e_demo.py`.

**Why:** Prompt 14 — AI interprets deterministic simulation output; it never predicts physics, never writes
simulation/geospatial tables, never acts autonomously.

**Files/Modules:** `agents/**`, `backend/app/{db/models/ai_request.py,repositories/ai_request_repository.py,
services/ai_data_access.py,services/ai_analysis_service.py,schemas/ai.py,api/routes/ai.py}`,
`backend/alembic/versions/7c4e2a91b3d5_ai_requests.py`, `shared/types/index.ts`,
`frontend/src/features/command-center/{api/aiApi.ts,components/CommandBriefPanel.tsx}`, `docs/agents/ai-layer.md`.

**Future Context:** adding an evidence kind = extend `EvidenceKind` + the collector; adding a tool = extend the
`AnalysisDataAccess` Protocol + adapter (read-only only). Real RAG plugs into `EvidenceRetriever`.

### 2026-09-12 — Structures layer, premium water/terrain pass, dropdown fix (Prompt 13)

**Added/Changed:**
- **Structures.** User-placed structures (`building`, `hospital`, `port`, `power_plant`, `lighthouse`,
  `fuel_terminal`) live in `scenario_config.structures` (validated by `StructureConfig`, max 50) and are
  saved with the test. Console: `StructuresPanel` (add by type, per-structure on/off switch, rename, remove,
  layer eye toggle, live status), draggable on the terrain via the shared `useGroundDrag` hook (coastal types
  snap to the shoreline, others clamp to land), procedural detailed models in `three/structures/models/`
  (tower block with lit windows, hospital with cross + helipad, port with quay/pier/cranes/containers/ship,
  power plant with cooling towers + stack, lighthouse, fuel tanks), status ring + label, damage tint and
  cyclone shake driven by exposure.
- **Exposure rules (mirrored).** `simulation/core/structures.py` assesses every enabled structure each frame
  (tsunami run-up sector, cyclone wind field, oil at the coast, flood inundation stretch) and the four demo
  models now fill `SimulationState.infrastructure_impacts`. `frontend/src/propagation/structures.ts` is the
  line-for-line mirror; fixtures regenerated with structures; `mirror.test.ts` checks exposure/status per
  frame. Recorded runs replay the backend's own impacts. Telemetry shows "Structures hit" / "Worst exposure".
- **Visual pass.** Water: procedural detail normals, depth-based colour (turquoise shelf → navy), rolling
  breaker sets + swash line at the beach, tsunami whitewater that turns into a breaking wall at the shore,
  layered oil (black core, brown body, weathered mousse band, faint iridescent fringe; tendrils stretched
  along the drift), murky silt-water flood sheet with debris streaks and a reach-line seam, storm-darkened
  sea under a cyclone. Flood/run-up now limited laterally to the same coast stretch the exposure rules use
  (`uHazardLateralKm`). Terrain: per-fragment procedural surface (`terrainMaterial.ts`: wet/dry sand,
  fields, forest patches, soil, rock on slopes/ridge) via `onBeforeCompile`. Camera frames the landfall
  zone tighter; cyclone spiral raised above terrain.
- **Fix.** Profile dropdown rendered under the telemetry panel — the top bar's `backdrop-blur` made a
  stacking context; the bar is now `relative z-30` above the panel columns.

**Why:** Requested: structures that can be placed by drag, toggled, and affected by the active hazard, plus a
more premium, realistic scene.

**Files/Modules:** `simulation/core/structures.py`, `simulation/core/{model,engine}.py`, the four models,
`backend/app/schemas/scenario_config.py`, `shared/types/index.ts`, `shared/fixtures/propagation_cases.json`,
`frontend/src/propagation/structures.ts`, `frontend/src/three/structures/*`, `three/markers/useGroundDrag.ts`,
`three/terrain/terrainMaterial.ts`, `three/shaders/water.ts`, `features/command-center/components/StructuresPanel.tsx`,
`hooks/useScenarioSession.ts`, `simulation/tests/test_structures.py`.

**Future Context:** exposure rules are illustrative bands, not a vulnerability model — say so wherever they
surface. Changing a rule: edit both `structures.py` and `structures.ts`, regenerate fixtures.

### 2026-09-12 — Firebase auth, one shoreline world, in-situ interactive console (Prompt 12)

**Added/Changed:**
- **Database wipe.** `scripts/wipe_scenario_data.py --yes` truncated every scenario/version/run/artifact/
  assessment row and deleted `simulation/outputs/*.json`. Reference geodata and infrastructure assets kept.
- **Auth (ADR-004).** Firebase Authentication on the frontend (`features/auth/`: Google popup, email/password
  sign-in + sign-up, password reset, sign-out → landing). Backend verifies Firebase ID tokens with
  `PyJWT[crypto]` against Google's certs (`app/core/auth.py`, `FIREBASE_PROJECT_ID` only), `GET /auth/me`.
  New NOT NULL `scenarios.owner_uid` (migration `5b2f9c1d7e10`); every scenario/run route is owner-scoped —
  another user's rows are 404. Env-gated local dev bypass (`AUTH_DEV_BYPASS_UID` / `VITE_AUTH_DEV_BYPASS=1`).
  Tests: `tests/api/test_user_isolation.py`; conftest injects a verified test identity per client.
- **Demo shoreline world (ADR-005).** `simulation/core/propagation.py` + `shared/constants/demo_world.json`
  define one 300 km world with an analytic shoreline and common propagation params
  (`origin_x_km/origin_y_km/heading_deg/speed_kmh/intensity/spread_radius_km/dispersion_rate`, validated by
  `PropagationConfig`). Tsunami/cyclone/oil-spill/coastal-flood models rewritten on it (`*-demo-v2`),
  `affected_area` is now `None` (no real geometry). Frontend mirror in `frontend/src/propagation/` verified by
  `shared/fixtures/propagation_cases.json` (`scripts/generate_propagation_fixtures.py`).
- **Console rebuilt.** Full-bleed 3D world with collapsible glass HUD overlays (`HudPanel`): My tests tray +
  New test modal (name + generic presets: Demo Oil Spill / Tsunami / Cyclone / Coastal Flood), inline parameter
  sliders (heading, speed, arrival-at-coast, intensity, spread, dispersion, duration) with autosave as new
  scenario versions, draggable origin pin (`three/markers/OriginPin.tsx`), live telemetry (distance to
  mainland, ETA, phase, headline metric), transport bar with a continuous sim clock
  (`playback/playbackClock.ts`), recorded runs (record = create + execute; replay locks params), profile menu.
  `?scenario=<id>` deep link. Standalone `/scenarios` builder route and feature deleted (`/scenarios` redirects).
- **3D.** `three/world/demoWorld.ts` (km ↔ scene, GLSL twin of shoreline/terrain), `ShorelineTerrain`
  (replaces `Landmass` + satellite basemap), water shader with watertight shoreline clip, damped swell at the
  beach, tsunami crest ring, oil slick discolouration + iridescent rim, cyclone chop/foam spiral, flood
  inundation lift; `hazardChannel` feeds uniforms at frame rate. Four visualizers rewritten; geospatial
  layers, lat/lon projection, search-rescue visualizer removed. Camera looks from sea to shore, with a
  post-login dolly-in entrance.
- **Landing/gateway.** One-screen landing with a raw-WebGL2 fluid backdrop and four-word copy; `/explore` is
  only the glassmorphic sign-in card (adapted `components/ui/sign-in-card.tsx`, framer-motion + lucide) over
  the same backdrop; successful sign-in plays a canvas warp then the camera entrance. Cinematic scroll stage
  and its image assets deleted.
- **Dependencies.** frontend: `firebase`, `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`;
  python: `PyJWT[crypto]`. Seed no longer creates scenarios (user-owned).

**Why:**
- Requested overhaul: private per-user tests, no real-world places/coordinates, real-time parameter tuning
  and a draggable origin on one consistent shoreline scene, distinct visual physics per disaster, and a
  decluttered HUD. See architecture.md ADR-004/ADR-005/§29.

**Files/Modules:**
- backend: `app/core/auth.py`, `app/api/routes/auth.py`, `app/schemas/auth.py`, `app/schemas/scenario_config.py`,
  `app/services/{scenario,simulation,impact}_service.py`, `app/repositories/scenario_repository.py`,
  `app/db/models/scenario.py`, `alembic/versions/5b2f9c1d7e10_*.py`, `app/db/seed.py`, `app/config/settings.py`.
- simulation: `core/propagation.py`, `models/{tsunami,cyclone,oil_spill,flood}/model.py`, tests.
- shared: `constants/demo_world.json`, `fixtures/propagation_cases.json`, `types/index.ts`.
- frontend: `features/auth/*`, `features/landing/*`, `features/command-center/*`, `propagation/*`,
  `three/{world,hazard,terrain,water,shaders,markers,disasters,core}/*`, `components/ui/sign-in-card.tsx`,
  `api/client.ts`, `lib/utils.ts`, `app/App.tsx`.
- scripts: `wipe_scenario_data.py`, `generate_propagation_fixtures.py`.

**Future Context:**
- Firebase project config must be supplied by the operator (`frontend/.env.local`, `backend/.env`) — see
  docs/development/setup.md "Authentication". Without it the gateway shows an explicit configuration error.
- Changing any formula in `simulation/core/propagation.py` or a demo model requires regenerating the fixtures
  and updating `frontend/src/propagation/hazards.ts`; `mirror.test.ts` fails otherwise.
- Verified: backend 132 API/schema/service tests + 17 db tests, 67 simulation tests, frontend 12 tests,
  `tsc`/`eslint` clean, `npm run build` (three still only in the lazy chunk), headless-Chrome screenshots of
  landing + all four hazards.

### 2026-09-12 — Console redesign, real satellite basemap, water rewrite (Prompt 11)

**Added/Changed:**
- **Layout (structural).** `CommandCenterPage` replaced absolutely-positioned viewport overlays with an
  explicit three-column grid (left rail / viewport / right rail). Each rail is an independently scrolling
  `min-h-0` column, so a long panel scrolls inside its rail instead of overflowing into the viewport or the
  other rail — the panel collision and the Data Layers buttons wrapping outside their card are both gone.
  Collapses to one column below `xl`. New `flush` `CommandPanel` variant for rail-mounted panels.
- **New panels/components.** `HazardMetricsPanel` (per-frame reported values, split out of
  `SimulationStatusPanel`), `ViewportChrome` (colour keys, view extent, provenance — `pointer-events-none`
  so it never blocks an orbit drag), `components/ui/icons.tsx` (one inline SVG set), `Toggle`
  (`role="switch"`), `MetricTile`, `SeverityBadge`, `LegendBar`.
- **Design tokens.** IBM Plex Sans/Mono with tabular numerics, flat console surfaces, 3-4px radii, hairline
  rules, a 3-step neutral elevation scale. `--shadow-glow-accent` deleted — coloured border glow is now a
  banned effect; `LiquidMetalButton` rebuilt as an unblurred machined rim.
- **Scene scale.** `SCENE_UNITS_PER_KM` 0.12 → 1.1. The visible world was ~2,300 km across, so a 20 km
  hazard projected to 2.4 units in a 280-unit terrain — the disaster rendered as a speck. The plate is now
  320 units ≈ 291 km and that footprint projects to 22 units. `geoProjection.ts` also owns
  `SCENE_TERRAIN_SIZE`/`SCENE_WORLD_SPAN_KM` so terrain and basemap can't disagree.
- **Camera framing.** `CameraController` now slews its orbit target onto the hazard and pulls to a distance
  that fits its radius; `SceneRoot` derives focus + radius (hazard centre, else scenario origin). Manual
  orbit cancels the slew permanently; reduced motion applies it as a cut.
- **Water rewritten.** Six Gerstner components with analytic normals, Schlick fresnel over a sky-gradient
  reflection, wrap lighting, crest forward-scatter, specular + noise-broken glitter, steepness foam,
  horizon fade. Plane 64 → 320 segments (Gerstner is per-vertex). ACES tone mapping enabled on the canvas.
- **Real satellite basemap.** New `three/terrain/satelliteBasemap.ts` stitches Esri World Imagery XYZ tiles
  (public, key-free, CORS-enabled) into one canvas covering exactly the plate's ground footprint at the
  scenario's real coordinates, and drapes it on the terrain. A land/water mask derived from the imagery (a
  documented colour heuristic) decides which vertices sit above sea level, so the animated water meets the
  visible coastline. Falls back to the procedural vertex-colour terrain whenever imagery is unavailable;
  real status and attribution are surfaced in Geographic Context and the viewport provenance line.
- **Honesty fixes.** Removed fabricated telemetry that had appeared on `/explore` ("CHENNAI_SECTOR_01", a
  hardcoded lat/lon, "60_FPS_ACTV", "3D SENSOR GRID READY", "hydrodynamic storm surge modeling"). Header
  ANALYZE/RESPOND/REPORT modes render as explicitly unavailable rather than as dead tabs. `ImpactPanel`
  reports the severity band once (header badge) instead of twice.
- 130 frontend tests passing, `tsc --noEmit` clean, `eslint` clean (3 pre-existing fast-refresh warnings),
  `npm run build` succeeds with three/`@react-three` still isolated in the lazy `CommandCenterPage` chunk.

**Why:**
- The panel overlap and the speck-sized disaster were the two defects that made the console unusable, and
  both were structural (absolute overlays; a scene scale two orders of magnitude off) rather than cosmetic.
- The water and terrain read as "a tinted plane with a green blob" because the geometry could not represent
  a wave crest and the surface had no real reflection model. Satellite imagery gives the plate genuine
  geographic identity without pretending to be elevation data.
- Glow, a ubiquitous default typeface and ad-hoc glyphs are what made the UI read as generic; a flat
  console language with one icon family and tabular numerics is what an EOC actually looks like.

**Files/Modules:**
- `frontend/index.html`, `frontend/src/styles/{tokens,index}.css`
- `frontend/src/components/ui/*` (icons, Toggle, MetricTile, SeverityBadge, LegendBar + restyled primitives)
- `frontend/src/features/command-center/*` (page grid, header, all panels, ViewportChrome, HazardMetricsPanel)
- `frontend/src/features/landing/{LandingPage,ExploreTransition,NarrativeTypography,CinematicScroll}.tsx`
- `frontend/src/three/{shaders/water.ts,water/*,terrain/*,core/*,markers,overlays,geospatial,disasters}`
- `frontend/src/three/terrain/satelliteBasemap.ts` (new)
- `architecture.md` §28e

**Future Context:**
- Esri World Imagery is used without an API key and must stay attributed wherever it renders. If it is ever
  swapped for a keyed provider, the key belongs in environment configuration (CLAUDE.md §18/§24), and the
  "unavailable" fallback path must be preserved — the app must never depend on imagery loading.
- The imagery-derived land/water mask is a rendering heuristic. It must never be used for analysis, exposure
  or any displayed measurement; PostGIS remains the source of truth (architecture.md §14a).
- Terrain *shape* is still procedural and elevation is still reported as unavailable. A future DEM phase
  should replace the height field in `Landmass.tsx` and update `GeographicContextPanel`'s Elevation row in
  the same change.
- `SCENE_UNITS_PER_KM` is now load-bearing for framing, hazard sizes and the basemap footprint. Changing it
  means re-checking `CameraController`'s MIN/MAX distance and `SceneRoot`'s `MIN_FRAME_RADIUS`.

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
