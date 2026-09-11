# AAA 3D Command Center & Landing — AQUASHIELD

The first visually complete AQUASHIELD experience: a cinematic landing sequence, a dedicated gateway
screen, and a 3D-dominant command center wired to Prompt 7's real simulation execution API. Full detail
below; see architecture.md §28 for the high-level summary and CLAUDE.md §27 for the rules this phase
established.

## Routing

```
/                Landing — the six-beat cinematic scroll sequence (LandingPage)
/explore         Explore gateway — a dedicated screen, its own route (ExploreGatewayPage)
/command-center  The 3D-dominant application (CommandCenterPage) — lazy-loaded
/scenarios       The Prompt 6 Scenario Builder — preserved, also lazy-loaded
*                Redirects to /
```

`react-router-dom@7.18.3` was added for this — the first real router in the project (architecture.md
ADR-001 explicitly left routing as "add a lightweight client-side router when needed"; this phase is that
moment, since the prompt's own routing spec names three concrete routes). `App.tsx` is the only file that
constructs `<Routes>`; no other file does ad hoc view-switching.

`/scenarios` is additive, not requested by this phase's spec, but preserves Prompt 6's working CRUD
scenario builder rather than orphaning it — the new command center's scenario panel is read/execute-focused
(select a scenario, create/execute a run), not a replacement for creating or editing scenarios.

## Landing architecture

```
frontend/src/features/landing/
├── landingAssets.ts       — the six-asset -> beat mapping (source of truth, not scattered paths)
├── LandingBeatSection.tsx — one full-viewport beat: scroll-scrubbed image + threshold text reveal
├── ScrollSequence.tsx     — maps landingAssets to LandingBeatSection
├── ExploreTransition.tsx  — the gateway screen's content (presentational)
├── ExploreGatewayPage.tsx — the "/explore" route: navigation + page-transition-out
└── LandingPage.tsx        — the "/" route: ScrollSequence + a link into "/explore"
```

### The six assets

Provided at repo-root `assets/image1.png`–`image6.png` (originals: 900×506 up to 3000×3000, 564 KB–12 MB).
Not replaced or substituted — resized (longest edge 1920px) and re-encoded as JPEG (quality 68) into
`frontend/src/assets/landing/imageN.jpg` (242 KB–910 KB, 3.2 MB total) purely for web delivery; this is
the "optimize their loading" instruction, not asset substitution. `landingAssets.ts` maps each to a beat:

| File | Beat | Eyebrow |
|---|---|---|
| image1.jpg | Opening — a duck resting on still water | AQUASHIELD |
| image5.jpg | A cyclone viewed from orbit | Cyclone |
| image2.jpg | A tsunami wave breaking over trees | Tsunami |
| image6.jpg | An inundated coastal town | Flood |
| image3.jpg | A grounded vessel breaking apart in surf | Marine Pollution |
| image4.jpg | A U.S. Coast Guard rescue hoist | Search & Rescue |

All six are real photography (one, image6, is a wire-service photo carrying its own visible
attribution mark — left untouched, not cropped). None are AI-generated or stock placeholders. A footer
credit line (`LANDING_IMAGE_CREDIT`) makes explicit that this is illustrative photography, not live
simulation output — the same "visual demonstration vs. scientific data" distinction Prompt 8 requires of
the 3D world applies to the landing imagery too.

### Scroll sequence mechanics

Each `LandingBeatSection` is a normal `100vh` block in **native document scroll** — deliberately not
scroll-jacked, so keyboard/screen-reader/reduced-motion behavior stays whatever the browser already does
well. Two independent Anime.js v4 `ScrollObserver`s per section (`frontend/src/animations/scroll.ts`):

- `linkScrollProgress` — scroll-scrubbed: the background image's `scale` is directly driven by scroll
  position between the section's enter/leave bounds (`ScrollObserver.link`), producing the parallax
  "dolly" effect. Skipped entirely under `prefers-reduced-motion`.
- `onSectionInView` — threshold-based: fires a staggered text reveal (`animations/stagger.ts`) once per
  entry/exit, not a continuous scroll-driven transform.

Every `ScrollObserver`/`JSAnimation` created is reverted on unmount via `animations/cleanup.ts` — no
Anime.js handle in this codebase outlives its component.

### Explore gateway & CTA

`/explore` hosts `LiquidMetalButton` (`frontend/src/components/ui/LiquidMetalButton.tsx`) — AQUASHIELD's
own implementation of the "metallic glowing border, fluid hover" interaction referenced from
21st.dev's Liquid Metal Button, built from scratch in the project's own cyan/aqua palette (a rotating
conic-gradient ring behind a glass center), not a literal port of that component's code. Clicking it plays
a real page-transition-out (`animations/transitions.ts`, thenable Anime.js v4 animation) before navigating
to `/command-center`.

## 3D architecture (`frontend/src/three/`)

```
three/
├── core/          AquaCanvas, SceneRoot, CameraController, LightingSystem, EnvironmentSystem, PerformanceMonitor
├── water/         WaterSurface + a custom vertex/fragment shader (shaders/water.ts)
├── terrain/       Landmass — procedurally displaced coastline patch
├── markers/       LocationMarker — scenario/hazard beacon + pulse ring
├── overlays/      SceneLabel — the one screen-space (drei Html) label style
├── particles/     InstancedDrift — GPU-instanced particle cluster (oil spill, search & rescue)
├── adapters/      simulationVisualAdapter.ts — the Prompt 7 <-> Three.js seam
├── disasters/     registry.ts + one visualizer per disaster family
└── utils/         geoProjection.ts, colorRamp.ts
```

`AquaCanvas` is the **one** `<Canvas>` in the app (`dpr={[1,2]}`, `shadows`, `powerPreference:
"high-performance"`). `SceneRoot` is the one scene graph: `EnvironmentSystem` (background color + fog,
no network-fetched HDRI — self-contained, no CDN dependency), `LightingSystem` (hemisphere + directional +
ambient), `CameraController` (damped `OrbitControls`, clamped distance/polar angle, damping disabled under
reduced motion), `WaterSurface`, `Landmass`, the scenario's own `LocationMarker`, and — resolved from
`disasters/registry.ts` — the active disaster's visualizer.

**VISUAL DEMONSTRATION, not scientific data:** the water is a stylized shader surface (two-octave sine
displacement + a fresnel rim term), and the landmass is a radially-falloff-shaped pseudo-noise patch (no
noise-library dependency — CLAUDE.md §16). Neither claims to represent real bathymetry, terrain, or GIS
data; PostGIS remains the source of truth for real geospatial application data (architecture.md §14a).
`three/utils/geoProjection.ts` documents the same caveat for its lat/lon → scene-space projection.

### Disaster visualizers

One per Prompt 7 disaster family, resolved through `disasters/registry.ts` exactly like
`simulation/core/registry.py` resolves a model server-side — never an if/else chain:

| Visualizer | Disaster types | Visual language |
|---|---|---|
| `FloodVisualizer` | flood, flash_flood, coastal_flood | Expanding inundation disc, color ramps clear→murky with water level |
| `TsunamiVisualizer` | tsunami | Propagating wave-front ring at the coast + a source marker connected by a dashed line |
| `CycloneVisualizer` | cyclone, storm_surge | Concentric wind-field rings, rotating at a speed driven by wind intensity, around the storm's real moving center |
| `OilSpillVisualizer` | oil_spill, chemical_pollution | GPU-instanced drifting particle slick around the real moving plume center |
| `SearchRescueVisualizer` | search_rescue | Growing search-area disc, color shifting confident-green → uncertain-amber as confidence falls |

`chemical_pollution` reuses `OilSpillVisualizer` (`disasters/pollution/index.ts` re-exports it) — the same
reuse decision `simulation/core/registry.py` and `scenario_config.py`'s `DISASTER_CONFIG_SCHEMAS` already
made server-side. An unregistered disaster type resolves to `null`; `SceneRoot` renders nothing extra
rather than throwing (verified — `disasters/registry.test.ts`).

### The simulation → visual adapter

`three/adapters/simulationVisualAdapter.ts`'s `toVisualState()` is the only place a `SimulationState` is
interpreted for rendering — visualizers never read `hazard_state` directly. Every numeric field it reads
(`water_level_m`, `wave_height_m`, `arrival_progress`, `wind_speed_kt`, `slick_area_km2`,
`search_radius_km`, `confidence`, …) is real Prompt 7 model output; where a *visual* quantity has no
direct field (e.g. tsunami has no `impact_radius_km`), the mapping is a documented, fixed visualization
convenience (`8 + coastal_impact_m * 15`), never an invented physical formula — exactly the distinction
Prompt 8 draws.

## Real simulation integration

```
Scenario (scenarioApi)
   -> SimulationRun (scenarioApi.getRuns / createRun)
   -> Simulation API (simulationApi.getRun / executeRun / getTimeline — Prompt 7)
   -> TimelineFrame[] (frontend/src/features/command-center/types.ts)
   -> useCommandCenterSession (frontend/src/features/command-center/hooks/)
   -> toVisualState() -> SceneRoot -> disaster visualizer
```

`frontend/src/features/command-center/api/simulationApi.ts` is a real HTTP client for Prompt 7's
`/simulation-runs/*` endpoints (no backend URL hardcoded — `VITE_API_URL`, same convention as
`scenarioApi.ts`). `SimulationRunDetail`/`SimulationArtifactOut`/`TimelineResponse` were added to
`shared/types/index.ts` in this phase — mirroring `backend/app/schemas/simulation.py` — since the command
center is their first frontend consumer (a deliberate, documented shared-contract addition, per
docs/development/git-workflow.md "Shared Contract Changes"; nothing existing was changed, only added to).

`useCommandCenterSession` (`hooks/useCommandCenterSession.ts`) is the single orchestration hook: lists
`ready` scenarios, loads the selected scenario's detail + runs, loads the selected run's detail, and — only
once a run is `completed` — fetches its timeline. `executeRun`/`createRun` call the real
`POST /simulation-runs/{id}/execute` and `POST /scenarios/{id}/runs` endpoints; nothing is simulated in the
frontend. A frame slider (not full playback — that is explicitly Prompt 9's job) lets the user pick a
timestep, which flows through `toVisualState` into the 3D scene.

**Manually verified disaster types (real backend execution → real frame → real visual mapping):**
flood and tsunami, per Prompt 8's explicit manual-verification requirement — see "Manual verification"
below. Cyclone, oil_spill, and search_rescue are wired through the identical registry/adapter path and
covered by `backend/tests/api/test_simulation_runs.py::test_execute_different_disaster_types_end_to_end`
(Prompt 7) and `three/pipeline.test.ts` (this phase) end to end at the data layer, but were not separately
walked through a live browser session.

## UI component system (`frontend/src/components/ui/`)

`GlassPanel`, `PanelHeader`, `CommandPanel`, `SectionLabel`, `Divider`, `StatusIndicator`, `HazardBadge`,
`DataReadout`, `CommandButton`, `IconButton`, `LiquidMetalButton`, `LoadingOverlay`, `ErrorState`,
`EmptyState` — each has real reuse (2+ call sites) rather than being a one-off. `DataReadout` renders `—`
for a `null`/`undefined` value; nothing in this component library fabricates a number (Prompt 8 "No fake
data"). `Tooltip`/`Modal`/`Drawer`/`Toast` from the prompt's example list are **not implemented** — nothing
in this phase's flow needs a dialog, a toast, or a tooltip yet; see "Not implemented" below.

## Design tokens (`frontend/src/styles/tokens.css`)

Tailwind v4 `@theme` tokens — color (`--color-void/abyss/surface/ink/accent/status-*`), radius, shadow/glow,
font stack. Named `ink`/`ink-soft`/`ink-faint` rather than `text-primary`/etc. specifically so the
generated Tailwind utilities read cleanly (`text-ink`, not `text-text-primary`). No Google Fonts/external
font — a system-ui stack, so the landing page has zero extra network dependency before first paint.
`prefers-reduced-motion` gets its own token block; Tailwind's `motion-safe:`/`motion-reduce:` variants
handle the rest per-component.

## Lazy loading & code splitting

Verified via `npm run build` output, not assumed:

| Chunk | Gzip size | Loaded |
|---|---|---|
| `index-*.js` (landing, routing, UI kit, animations) | ~97 KB | Always (initial) |
| `ScenarioBuilderFeature-*.js` | ~6 KB | Only on `/scenarios` |
| `CommandCenterPage-*.js` (Three.js + R3F + drei + the whole scene graph) | ~255 KB | Only on `/command-center` |

Both `CommandCenterPage` and `ScenarioBuilderFeature` are `React.lazy()` + `Suspense` in `App.tsx` — the
landing page's initial load never pays for Three.js. `LoadingOverlay` (real stage list —
`["Environment","Simulation","Visualization","Command Systems"]`, indeterminate spinner, **no fabricated
percentage** — Prompt 8 explicitly forbids a fake `73%`) is the `Suspense` fallback while the command
center chunk loads.

Images: `loading="lazy"`/`decoding="async"` on every beat image except the first (`eager`/`fetchPriority:
"high"`, since it's on screen immediately at load).

## Performance decisions

- `dpr={[1,2]}` on the one `<Canvas>` — never renders at a raw 3x/4x device pixel ratio.
- `InstancedDrift` is one `InstancedMesh` draw call regardless of particle count (70–290 particles for oil
  spill/search & rescue) — never one component per particle.
- Terrain/water geometry is built once (`useMemo`)/is coarse (64×64, 96×96 segments) — never rebuilt per
  frame; only uniforms (`uTime`) and instance matrices update in `useFrame`.
- `PerformanceMonitor` renders drei's `<Stats>` only in dev with `?debug=1` — zero cost by default,
  in production, and even in dev without the flag.
- No postprocessing pipeline — Prompt 8 §"Three.js/R3F requirement" makes it explicitly conditional
  ("only if performance permits"); not adding one is a scope decision, not an oversight — see "Planned".
- No `<Environment preset>`/HDRI — avoids an unpredictable third-party CDN fetch on scene load.

## Accessibility

- Native document scroll for the landing sequence (no scroll-jacking) — keyboard/screen-reader behavior is
  the browser's own.
- `usePrefersReducedMotion` (`frontend/src/hooks/`) gates: the scroll-linked image parallax (skipped
  entirely), text-reveal travel distance (16px → 0px), and `OrbitControls` damping (disabled).
- Every icon-only control (`IconButton`) requires a `label` prop that becomes its accessible name.
- `ErrorState`/`EmptyState`/`LoadingOverlay` use `role="alert"`/`role="status"` with `aria-live` where
  appropriate.
- Focus rings (`focus-visible:ring-*`) on every interactive control, including `LiquidMetalButton`.

## Testing

Run for real, not assumed — `cd frontend && npm run test`:

- **Landing:** `landingAssets.test.ts` (6 beats map to 6 distinct real assets, correct disaster-category
  order).
- **Three.js (data/registry layer):** `disasters/registry.test.ts` (correct visualizer per type, reused
  types, unknown type returns `null` without throwing), `adapters/simulationVisualAdapter.test.ts` (every
  disaster type's real `hazard_state` fields map to the expected radius/intensity/center — including "a
  missing field becomes 0, never a guess"), `three/pipeline.test.ts` (a real `SimulationState` for every
  one of the 9 disaster types resolves to a renderable visualizer end to end), `utils/geoProjection.test.ts`,
  `utils/colorRamp.test.ts`.
- **Command center (data flow, mocked network):** `command-center/tests/CommandCenterPage.test.tsx` —
  loads a scenario + pending run, shows an error state when scenarios fail to load, shows an empty state
  with no runs, and executes a run end to end (mocked `simulationApi`/`scenarioApi`) confirming a real
  frame's `hazard_state` reaches the UI as the adapter's label text. The 3D viewport itself is stubbed in
  this file specifically (`vi.mock("../components/CommandCenterViewport", ...)`) — see "Known limitations."
- **App/routing:** `app/App.test.tsx` — the landing route renders real beat content, and the "Continue"
  link navigates into the `/explore` gateway.

**39 frontend tests, all passing** (this phase's ~30 new tests + the 12→9 pre-existing scenario-builder
tests reorganized under the same command; see `npm run test` output). `npm run lint` and `npm run build`
(`tsc --noEmit && vite build`) both clean.

### Known limitation: no automated WebGL render test

`@react-three/test-renderer` (the standard tool for this) was evaluated and removed — its mocked WebGL
context doesn't implement `texImage3D`, which the installed `three@0.186.0`'s `WebGLRenderer` now requires
unconditionally (three has dropped WebGL1 support; this test-renderer package's last real release
predates that and is effectively unmaintained — npm flags its most recent tag as "released in error, no
changes"). Rather than force a fragile workaround, scene-graph correctness is verified at the seam that
actually varies (`toVisualState` + `getDisasterVisualizer`, both pure functions, both fully tested) and
`CommandCenterPage`'s data flow is tested with the viewport stubbed out. **Actual WebGL rendering was not
exercised by an automated test in this environment** — see "Manual verification."

## Manual verification (2026-09-12)

**VERIFIED** (with a live `uvicorn` backend, a real PostgreSQL/PostGIS instance, and the real `vite`
dev server):

- Backend `/health` reachable; CORS correctly allows the Vite dev origin (`http://localhost:5173`).
- All four SPA routes (`/`, `/explore`, `/command-center`, `/scenarios`) return `200` from the dev server.
- A landing asset (`/src/assets/landing/image1.jpg`) is served correctly.
- `npm run build` output confirms `CommandCenterPage` (Three.js/R3F/drei — 255 KB gzip) is a separate chunk
  from the initial bundle (~97 KB gzip) — the initial load does not pull in the 3D command center.
- End-to-end backend behavior this UI depends on (execute a run, retrieve a changing timeline, flood and
  tsunami producing distinct real output) was re-verified directly against the API in Prompt 7's own
  manual verification and again here via the full `backend/tests/api/test_simulation_runs.py` suite.

**NOT VERIFIED** — no browser automation tool was available in this environment:

- Actually scrolling through the six-beat landing sequence and observing the animation quality/smoothness.
- Visually confirming the 3D scene renders (water shader, terrain, markers, disaster visualizers) in a
  real browser.
- Clicking through Landing → Explore → Command Center → selecting a scenario → executing a run → seeing
  the 3D scene update, end to end, with human eyes.
- Checking the browser console for runtime warnings/errors during that flow.
- Confirming no memory leaks across repeated navigation (would require a real browser + profiler).

This is stated plainly rather than implied: the code, the automated test suite, and the production build
are verified; the rendered visual experience is not, and should be checked in a browser before this is
considered demo-ready.

## IMPLEMENTED / VERIFIED / SIMPLIFIED / PLANNED / NOT IMPLEMENTED

**IMPLEMENTED & VERIFIED** (automated tests and/or build output confirm it works):
- Routing (`/`, `/explore`, `/command-center`, `/scenarios`), all lazy-loaded appropriately.
- Six-asset landing scroll sequence with Anime.js-driven parallax + text reveal, reduced-motion aware.
- `LiquidMetalButton` CTA and page-transition navigation into the command center.
- Full Three.js/R3F/drei scene graph (water shader, procedural terrain, lighting, camera, markers,
  instanced particles) — compiles, builds, and its data-driving logic (adapter + registry) is unit-tested.
- Real integration with Prompt 7: scenario selection, run creation/execution, timeline retrieval, frame
  selection, all via real HTTP calls with real error/loading/empty states.
- Design token system, reusable UI component library.
- Code splitting confirmed via build output; reduced-motion, focus-visible, and aria-live states in place.

**SIMPLIFIED / DEMONSTRATION** (real, but not scientifically or visually final):
- The water surface, terrain, and every disaster visualizer are stylized/illustrative, not GIS-backed —
  documented at every relevant file's top comment.
- `lat/lon -> scene position` is an equirectangular approximation for visualization only.
- The landing page's cinematic quality (motion feel, timing) is implemented per the described vocabulary
  but not human-eye-verified in this environment.

**PLANNED** (explicitly deferred, not started):
- `Tooltip`, `Modal`, `Drawer`, `Toast` components.
- `three/currents/`, `three/waves/` as dedicated subsystems (currently folded into each disaster
  visualizer directly — would be extracted if a second visualizer needed the same current/wave logic).
- Postprocessing pipeline (bloom/vignette) — conditional per the prompt itself ("only if performance
  permits"); not evaluated in this environment given no browser to profile against.
- `<Environment>`/HDRI-based atmosphere.

**NOT IMPLEMENTED** (out of scope for this phase, per its explicit hard stop):
- Timeline playback/scrubbing/speed controls, WebSocket streaming (Prompt 9).
- Risk/vulnerability/geospatial analysis (Prompt 10).
- AI agents, RAG, response planning, Incident Action Plan (Prompts 11-13).
- Automated WebGL scene-render testing (see "Known limitation" above) and live browser visual
  verification (see "Manual verification" above).
