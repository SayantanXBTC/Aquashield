# AAA 3D Command Center & Landing — AQUASHIELD

## Prompt 12 — Authenticated interactive console (2026-09-12)

> Sections below this one describe earlier prompts and are kept as history. Where they conflict with this
> section (rails layout, satellite basemap, lat/lon projection, `simulationVisualAdapter`, the scenario
> builder route, the cinematic scroll landing), this section is current. Architecture: architecture.md §29,
> ADR-004, ADR-005.

**Routes.** `/` one-screen landing (`FluidBackdrop` — raw WebGL2 domain-warped fbm, no three.js in the
initial bundle), `/explore` the sign-in gateway (only the `SignInCard`), `/command-center` behind
`RequireAuth`. `/scenarios` redirects to the console. A successful sign-in sets router state
`{ entrance: "warp" }`: `WarpTransition` (canvas 2D streaks → flash) hands off to `CameraController`'s
dolly-in, and the HUD fades in on `onEntranceComplete`.

**Auth.** `features/auth/AuthProvider.tsx` owns the Firebase session (`onAuthStateChanged`), exposes
Google/email sign-in, sign-up, reset, sign-out, and registers a token getter (`tokenProvider.ts`) that
`api/client.ts` uses to attach `Authorization: Bearer <id token>` to every request. `ProfileMenu` (photo or
initials, account details, Sign out → `/`). Firebase config is read from `VITE_FIREBASE_*`; when absent the
card renders an explicit configuration error. Dev bypass: `VITE_AUTH_DEV_BYPASS=1` (dev builds only) +
backend `AUTH_DEV_BYPASS_UID`.

**Layout.** Full-bleed `AquaCanvas`; a `pointer-events-none` HUD layer with `pointer-events-auto` glass
panels (`HudPanel`: collapsible, blur, hairline; collapsed state remembered per panel in localStorage).
Left: `ScenarioTray` (my tests, New test, archive) + `ParameterPanel`. Right: `TelemetryPanel` (8 Hz poll of
the snapshot) + `RunsPanel`. Bottom: `PlaybackBar`. Top: `TopBar`. A toggle hides the side columns.

**State.** `useScenarioSession(clock)`: owner-scoped scenario list (`?scenario=<id>` deep link), selected
scenario → `PropagationParams` (from `current_version.scenario_config` via `paramsFor`), `setParams` (live)
+ `commitParams` (debounced 700 ms autosave → `PATCH /scenarios/{id}` with a merged `scenario_config`, i.e.
a new immutable version), `durationHours`, `recordRun` (create + execute), `replayRunId` (frames from
`/timeline`, params locked), and `getSnapshot()` — the per-frame accessor the scene and telemetry share
(memoised on params + clock minute). `playback/playbackClock.ts` is an external store: the scene reads
`elapsedMinutes` at frame rate, the HUD subscribes at ≤10 Hz; 1x = 2 sim-minutes per real second (a UI
convenience).

**The mirror.** `src/propagation/{world,kinematics,hazards}.ts` port `simulation/core/propagation.py` and
the four demo models; `mirror.test.ts` replays `shared/fixtures/propagation_cases.json`. `hazardKindFor`
maps disaster types to the four visual kinds.

**3D.** `three/world/demoWorld.ts` (km ↔ scene; `DEMO_WORLD_GLSL` twin of `shoreX`/`terrainHeightKm`),
`terrain/ShorelineTerrain.tsx`, `water/WaterSurface.tsx` + `shaders/water.ts` (shoreline discard, beach
damping, tsunami crest, oil discolouration, cyclone chop/spiral foam, flood/run-up inland lift),
`hazard/hazardChannel.ts` (visualizer → uniforms, no React), `markers/OriginPin.tsx` (drag on the y=0
plane, clamped to water, OrbitControls suspended while dragging), `markers/HeadingGuide.tsx` (dashed line to
the model's landfall point), `disasters/{tsunami,cyclone,oil-spill,flood}` (write the channel + small overlay
meshes + a throttled `SceneLabel`), `disasters/registry.ts` keyed by hazard kind. Camera looks from the sea
toward the shore (azimuth 252°) and frames origin → landfall. Meshes extend 3x past the 300 km world so the
horizon fade, not a plate edge, closes the view. `?debug=3d` shows the diagnostics panel; `?t=<minutes>`
(dev builds) seeks the clock on load.

**Structures (Prompt 13).** `StructuresPanel` (right column) adds/toggles/renames/removes structures;
`three/structures/StructureLayer` renders enabled ones as procedural models on the terrain
(`terrainHeightKm` puts them on the surface; coastal types are rotated along the shore tangent), draggable
through `three/markers/useGroundDrag.ts`. Each model reads its own `impacts` entry from the snapshot every
frame: palette tints toward damage (`support.ts applyDamage`), a cyclone shakes it, the ring/label colour
follows `clear/at_risk/impacted/severe`. Labels show only for affected, hovered or selected structures.
Models are authored at ~3 km footprints and drawn at 2x (`STRUCTURE_VISUAL_SCALE`) — a visual scale.

**Verification (2026-09-12).** `tsc`, `eslint`, `vitest` (13 tests incl. the mirror + replay tests), `npm run
build` (three only in the lazy chunk). Headless Chrome (SwiftShader) screenshots of the landing, tsunami at
T+8/T+40 (front arc, landfall, run-up band), oil spill at T+5 h (slick + rim + particles), cyclone at T+3 h
20 (spiral wind field), coastal flood at T+2 h 30 (inundation lift), and the HUD/telemetry. Not verified in
this environment: a real Firebase sign-in (no project configured), the warp → entrance sequence end-to-end,
and pointer drag of the origin pin (headless has no pointer) — the drag path is unit-simple (raycast → clamp
→ `setParams`) and mirrors what sliders already exercise.

The first visually complete AQUASHIELD experience: a cinematic landing sequence, a dedicated gateway
screen, and a 3D-dominant command center wired to Prompt 7's real simulation execution API. Full detail
below; see architecture.md §28 for the high-level summary and CLAUDE.md §27 for the rules this phase
established.

## Prompt 8.1 — Visual correction (2026-09-12)

Prompt 8 shipped the architecture; a first real run in a browser (screenshot review) showed it wasn't
landing visually: the landing page's stacked-section parallax read as six separate cards rather than one
cinematic sequence, and the command center's default camera/terrain/water/atmosphere composition read as
"an empty dark scene with a grey polygon," not a command center. Prompt 8.1 is a **visual-only correction**
on `feature/visual-correction` — no new architecture, no fake data, no Prompt 9 functionality. Diagnosis and
fixes:

| Symptom | Root cause | Fix |
|---|---|---|
| Landing felt like stacked cards, not one sequence | `ScrollSequence`/`LandingBeatSection` were six independent `100vh` sections, each with its own scroll-linked animation | Replaced with `CinematicScroll` — one sticky viewport driven by a single normalized scroll progress; see "Landing architecture" below |
| "Empty dark void" | `EnvironmentSystem` was a flat background color with no horizon | Added drei's procedural `Sky` (no HDRI/network fetch) tuned to a moody dusk, so there's an actual horizon/atmosphere |
| "A grey polygon floating in the ocean" | `Landmass`'s large radius (70) + low relief (peakHeight 9) put most of the surface in a flat, pale "sand" color band, and it sat directly under the camera's look-at point | Smaller radius (46), taller relief (16), a color ramp that spends most of its range in vegetation/rock tones with only a thin waterline shelf tone, and repositioned off-center as a coastal accent rather than the dead-center subject |
| Generic/flat camera composition | `AquaCanvas`'s start pose (`[55,42,55]`, fov 42) was a steep, close, top-down-ish angle relative to the landmass's own scale | Wider, lower establishing shot (`[92,30,118]`, fov 38) plus matching `CameraController` distance/polar-angle clamps |
| Flat, static-looking water | Shader only had two low-frequency swell waves and a fixed-axis fresnel approximation | Added a fine chop layer, true view-vector fresnel, and a directional sun-glint specular term (`three/shaders/water.ts`) |
| "TIMELINE DATA UNAVAILABLE" read as broken | `SimulationStatusPanel` rendered a bare `EmptyState` with no framing | Reworded to "Awaiting playback data" under a "Simulation timeline" label — a deliberate, explained state, not an apparent bug |
| `/explore` gateway was a flat black screen with no imagery | `ExploreTransition` never rendered a background | Added the existing "cyclone" landing asset (`image5.jpg`) as a dimmed backdrop — no new/substitute image |

Nothing about the routing, the simulation adapter/registry, `useCommandCenterSession`'s data flow, or the
backend changed. See the sections below for the corrected architecture in detail.

## Prompt 9 — Timeline Playback Engine (2026-09-12)

Extends `useCommandCenterSession`'s single-frame selector (`frames`/`frameIndex`/`setFrameIndex`/
`currentFrame` — already real, already wired into `CommandCenterViewport`) into full client-side playback:
play, pause, speed, and scrub, all driven off the `TimelineFrame[]` already fetched from Prompt 7's
`GET /simulation-runs/{run_id}/timeline`. No backend or shared-contract change — this is 100%
interval-driven playback over data that already exists on the client; there is no WebSocket streaming and
no new API call.

### Timeline playback

`useCommandCenterSession.ts` adds `isPlaying`, `playbackSpeed`, `play()`, `pause()`, `togglePlay()`, and
`setPlaybackSpeed(speed)` alongside the existing `frameIndex`/`setFrameIndex`/`currentFrame` — none of those
three were renamed or restructured, only extended, so `CommandCenterPage.tsx`'s existing wiring didn't need
to change shape.

**Pacing model:** `TimelineFrame` (`shared/types/index.ts`) carries no duration/fps field — a `timestep`
integer and an optional `simulation_time` string, nothing else — so there is no "real" per-frame duration to
derive a playback rate from. `PLAYBACK_BASE_INTERVAL_MS = 600` is a plain UI pacing constant (600ms per
frame at 1x, 300ms at 2x, 150ms at 4x, 1200ms at 0.5x — `PLAYBACK_BASE_INTERVAL_MS / playbackSpeed`),
documented as such at its declaration. This is a deliberate simpler choice over pacing off
`simulation_time` deltas (which Prompt 9's own brief allows either way): every demo model in `simulation/`
(architecture.md §27) advances its clock in fixed steps, so real per-frame deltas would be uniform anyway
and add complexity (parsing/diffing ISO timestamps) without changing the visible behavior.

**Interval + cleanup:** one `useEffect` owns a single `window.setInterval` while `isPlaying && frames.length
> 0`, advancing `frameIndex` by one tick each interval; the effect's cleanup (`clearInterval`) fires
whenever `isPlaying`, `playbackSpeed`, or `frames` changes, and on unmount — the same "every timer/animation
handle gets torn down, no exceptions" discipline `animations/cleanup.ts` establishes for Anime.js handles
(CLAUDE.md §27), applied here to a plain interval instead. Verified directly with Vitest fake timers
(`useCommandCenterSession.test.ts`): advancing timers past unmount fires nothing, and `vi.getTimerCount()`
returns to `0` after unmount.

**Auto-pause, never a silent loop:** a second effect watches `frameIndex`/`frames.length` and stops
playback (`setIsPlaying(false)`) the instant `frameIndex` reaches the last frame — advancing further leaves
it clamped there, it never wraps back to `0` (no looping toggle exists; that would be a separate, explicitly
labeled feature, out of scope here). Playback is also force-paused whenever the selected scenario changes,
the selected run changes, or the timeline reloads/empties — each of those code paths already resets
`frames`/`frameIndex` and now also resets `isPlaying`, so a stale interval can never advance a `frameIndex`
that belongs to a different run's frame set. Manually scrubbing (`setFrameIndex`, called from the slider)
pauses playback first, then jumps — an explicit user override always wins over the interval rather than the
two fighting each other.

**UI:** `PlaybackControls.tsx` (new, `components/`) renders inside `SimulationStatusPanel`'s existing
frame-slider area — it replaces the panel's old bare `<input type="range">` with one Play/Pause
`CommandButton` (`aria-pressed` + an accessible `aria-label` that flips between "Play playback"/"Pause
playback"), a small 0.5x/1x/2x/4x speed group (also `CommandButton`, matching the existing scientific-
instrumentation look — no new button style introduced), and the same scrub slider as before, now wired to
pause-then-scrub. `DataReadout`'s "Frame"/"Timestep" counters are unchanged and keep updating during
playback since they read `frameIndex`/`frame` directly. Space toggles play/pause only when the Play/Pause
button itself has focus — that's the browser's native `<button>` behavior, not a page-level keydown
listener, so it never hijacks Space elsewhere on the page. The "Awaiting playback data" empty state (Prompt
8.1) for a completed-but-frameless run is untouched: `PlaybackControls` only ever renders when
`frames.length > 0`.

**3D seam unchanged:** `CommandCenterViewport.tsx`'s `useMemo` keyed on `currentFrame` already recomputes
`visualState` (via `toVisualState`) every time `frameIndex` advances, since `currentFrame = frames[frameIndex]`
is a different array element each tick — playback needed no change here. No second simulation/animation
system was added to the 3D layer; the scene keeps reacting through the existing adapter/registry seam one
frame at a time, exactly as it does for manual scrubbing.

**Explicitly not built:** a dedicated full-width bottom timeline scrubber bar (a separate, larger UI
surface than the compact control living inside the Simulation panel) — the compact `PlaybackControls`
inside the existing panel is this phase's chosen scope, not a placeholder for something bigger. Also not
built: WebSocket/streaming playback, looping, scenario-comparison playback (side-by-side A/B, architecture.md
§7/§11) — all out of scope per this phase's brief.

## Prompt 9.1 — Complete Disaster Catalog (2026-09-12)

Full detail (the disaster-type vs. scenario-instance distinction, the parallel-registry diagram, the
`GET /disaster-types` discovery endpoint, and the fact-checked parameter-consumption honesty matrix) lives in
docs/development/scenarios.md "Complete disaster catalog" — this section covers only what changed inside the
Command Center itself.

**"New scenario" link** — `ScenarioContextPanel.tsx`'s panel header now includes a `Link` to `/scenarios`
(styled to match `CommandButton`'s default tone) alongside the existing scenario `<select>`. The Command
Center stays read/execute-focused; it does not grow a second scenario-creation form of its own — this link
is a door to the Scenario Builder's existing, already-complete-for-all-9-types creation flow.

**Why only 2-3 types were visible before this pass** — not a catalog gap. `useCommandCenterSession`'s
`loadScenarios()` has always filtered to `status="ready"` scenarios (this is correct, intentional behavior —
a `draft` scenario shouldn't clutter a run-execution UI), and `backend/app/db/seed.py` originally only
seeded 3 scenarios (flood/oil_spill `READY`, tsunami `DRAFT`). Fixed by backfilling one `READY` demo
scenario per previously-unrepresented disaster type via an idempotent `_ensure_scenario` helper (looks each
scenario up by name before inserting — safe to re-run against a partially-seeded database, never duplicates
the pre-existing 3). All 9 types now have at least one `READY` scenario available in the Command Center's
selector out of the box.

**Scenario Builder visual language** — `ScenarioForm.tsx`/`FormField.tsx`/`DisasterParameterFields.tsx` (the
`/scenarios` route's form) previously used raw Tailwind slate/sky classes predating the Prompt 8 design-token
system; restyled onto `bg-surface`/`text-ink`/`border-hairline`/`components/ui`'s `CommandButton`/
`SectionLabel` so `/scenarios` reads as the same product as the Command Center rather than a generic form.
While fixing this, a real bug surfaced and was fixed: the form had no `noValidate`, so a disaster-specific
field with an HTML `max`/`min` attribute (e.g. cyclone's central pressure) triggered the browser's native
constraint-validation and silently blocked submission before the app's own styled `validateScenarioForm`
error ever ran.

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
├── landingAssets.ts          — the six-asset -> beat mapping (source of truth, not scattered paths)
├── sceneProgress.ts          — pure scroll-progress -> opacity/scale/drift math (unit-tested, no DOM)
├── ScrollDriver.ts           — useScrollDriver: native scroll -> rAF-throttled 0..1 progress
├── ImageStage.tsx            — the six images, stacked, opacity/transform written per scroll tick
├── OverlayGradient.tsx       — the static legibility gradient (never animated)
├── NarrativeTypography.tsx   — the six eyebrow/headline/body blocks, crossfaded on the same curve
├── ProgressIndicator.tsx     — "01 / 06" + a thin progress line
├── CinematicScroll.tsx       — composes the above into one sticky-viewport stage; reduced-motion fallback
├── ExploreTransition.tsx     — the gateway screen's content (presentational)
├── ExploreGatewayPage.tsx    — the "/explore" route: navigation + page-transition-out
└── LandingPage.tsx           — the "/" route: CinematicScroll + a link into "/explore"
```

`ScrollSequence.tsx`/`LandingBeatSection.tsx` (Prompt 8's stacked-section implementation) were removed in
Prompt 8.1 — superseded by `CinematicScroll`, not kept alongside it.

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

### Cinematic scroll mechanics (Prompt 8.1)

`CinematicScroll` renders one tall spacer (`SCENE_COUNT * 140vh`, native document scroll — no
scroll-jacking) containing a `position: sticky` viewport. `ScrollDriver.ts`'s `useScrollDriver` hook turns
native scroll into a single rAF-throttled 0..1 progress value (one `getBoundingClientRect` read per animation
frame, not per scroll event); `CinematicScroll` writes that progress straight into `imageRefs`/`textRefs`
DOM node styles (`opacity`, `transform: scale()/translateY()`) and the progress-line width — no React state
update on scroll, so a scroll frame never triggers a re-render. `sceneProgress.ts` is the pure math behind
this (`getSceneOpacity`/`getSceneScale`/`getSceneDrift`/`getActiveIndex`, all unit-tested in
`sceneProgress.test.ts`): each of the six scenes owns an equal band of progress, is fully opaque through
its middle, and crossfades continuously with its neighbor across a shared transition window at each
boundary — a slow Ken Burns zoom (1.08 → 1.0) is the one consistent transition technique used throughout,
per Prompt 8.1's "pick one dominant technique."

`activeIndex` (which scene "owns" the current progress) is the only continuous-scroll-derived value kept in
React state, and only changes 5 times across the whole sequence — it drives `ProgressIndicator`'s "N / 06"
text.

Under `prefers-reduced-motion`, `CinematicScroll` renders an entirely different, non-scroll-driven tree: six
plain stacked `100vh` sections with static images and always-visible text, no `useScrollDriver` call, no
scroll/resize listeners attached at all (verified in `CinematicScroll.test.tsx`).

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
├── vegetation/    ForestLayer + placement, tree geometry, sway/hazard shader
├── markers/       LocationMarker — scenario/hazard beacon + pulse ring
├── overlays/      SceneLabel — the one screen-space (drei Html) label style
├── particles/     InstancedDrift — GPU-instanced particle cluster (oil spill, search & rescue)
├── adapters/      simulationVisualAdapter.ts — the Prompt 7 <-> Three.js seam
├── structures/    StructureLayer, StructureModel, procedural models, collapse.ts
├── disasters/     registry.ts + one visualizer per disaster family
└── utils/         geoProjection.ts, colorRamp.ts
```

`AquaCanvas` is the **one** `<Canvas>` in the app (`dpr={[1,2]}`, `shadows`, `powerPreference:
"high-performance"`). `SceneRoot` is the one scene graph: `EnvironmentSystem` (procedural sky + fog),
`LightingSystem` (hemisphere + directional + ambient), `CameraController` (damped `OrbitControls`, clamped
distance/polar angle, damping disabled under reduced motion), `WaterSurface`, `Landmass`, the scenario's own
`LocationMarker`, and — resolved from `disasters/registry.ts` — the active disaster's visualizer.

**VISUAL DEMONSTRATION, not scientific data:** the water is a stylized shader surface (swell + chop
displacement, view-dependent fresnel, a directional sun-glint highlight), the sky is drei's procedural
Preetham `Sky` (geometry + shader, no HDRI/texture download), and the landmass is a radially-falloff-shaped
pseudo-noise patch (no noise-library dependency — CLAUDE.md §16). None of these claim to represent real
bathymetry, terrain, weather, or GIS data; PostGIS remains the source of truth for real geospatial
application data (architecture.md §14a). `three/utils/geoProjection.ts` documents the same caveat for its
lat/lon → scene-space projection.

### Camera & composition (Prompt 8.1)

`AquaCanvas`'s default camera pose is a low, wide establishing shot — `position: [92, 30, 118]`, `fov: 38`
— chosen so the horizontal distance from the scenario origin is large relative to camera height, giving a
shallow elevation angle with a visible horizon rather than looking steeply down at the scene.
`CameraController`'s `OrbitControls` clamps `minDistance`/`maxDistance` to `[45, 230]` (can't zoom into the
low-poly terrain up close, can pull back to a full vista) and `minPolarAngle`/`maxPolarAngle` to
`[0.2π, 0.47π]` (can't flip below the water or point straight down), with `target: [0, 4, 0]` slightly above
the water plane.

### The landmass (Prompt 8.1: "the grey polygon")

`Landmass` (`three/terrain/Landmass.tsx`) previously defaulted to `radius=70, peakHeight=9` — a large, low
plateau whose radial falloff put most of its surface in a flat, pale "sand" color band, positioned directly
under the camera's look-at point. From the default camera distance this read as an unfinished grey polygon
rather than terrain. Corrected to `radius=46, peakHeight=16, segments=112` (smaller footprint, taller
relief, an added higher-frequency noise octave for visible ridging), a color ramp that spends most of its
range in vegetation/rock tones with only a thin waterline "shelf" tone blending toward the water's own
shallow color (`#0d3a44`) instead of a hard sand cutoff, and repositioned to `[38, -0.4, 22]` — a coastal
accent near, not under, the scenario's own `LocationMarker` (which stays at the origin).

### Vegetation (`three/vegetation/`)

The land plate carries a forest of roughly 4,000 trees in three species — conifer, broadleaf and a palm
fringe behind the beach.

| File | Owns |
|---|---|
| `worldNoise.ts` | JS twin of the terrain material's fbm noise |
| `forestPlacement.ts` | Where trees grow — pure, deterministic, testable without a GPU |
| `treeGeometry.ts` | The merged trunk/canopy geometry per species |
| `forestMaterial.ts` | Wind sway + the hazard's effect on the canopy, and the shared uniform block |
| `ForestLayer.tsx` | Six `InstancedMesh` draw calls for the whole forest, and the per-frame uniforms |

**Placement follows the paint.** The terrain material paints forest where `tfbm(km * 0.11 + 4.2)` is high;
`worldNoise.ts` re-implements that noise so trees grow in the same patches, thin on the dunes, and stay off
bare rock, steep faces and the beach. Every tree is seated on the same `terrainHeightKm` the land mesh is
built from. Slope is measured in the shader's own units (`1 - normal.y`), not as a raw gradient.

> The JS/GLSL twin is a **close** match, not a bit-exact one — the shader runs in 32-bit floats. That is
> cosmetic; nothing downstream reads tree positions.

**Why that twin is fragile enough to have its own test.** The GLSL hash fracts only the *final* product; an
earlier JS twin also fract'ed the intermediate, which pulled the noise mean from ~0.5 to ~0.25. Because the
forest mask keys off `smoothstep(0.5, 0.74)`, that is indistinguishable from "this world has no forest" — it
produced 93 trees across 300 km and looked like a deliberate design choice. `forestPlacement.test.ts` asserts
the noise distribution, so the next such drift fails a test instead of quietly emptying the world.

**Animation is GPU-side.** Sway and the inundated-canopy response are vertex-shader work driven by one
module-level uniform block (`forestUniforms`, the same pattern as `hazardChannel`); the per-frame CPU cost is
writing a handful of uniforms. A cyclone's wind field raises the sway amplitude; a tsunami or flood lays the
canopy over and desaturates it inside the hazard's current inland reach. Trees are cleared within
`STRUCTURE_CLEARING_KM` of a placed structure — a cleared tree is scaled to zero, so instance counts and
buffers stay stable while a structure is dragged.

### Structures: seating and structural response

**Seating.** `footprintGround` (`three/structures/support.ts`) samples `terrainHeightKm` on two rings around
the footprint and returns the highest ground under it plus the relief across it. The model sits at the high
point and a foundation cylinder reaches down past the low point, so a structure neither floats on its
downhill corner nor buries its uphill one on the sloping plate.

**Structural response.** As the exposure band rises, a model leans, then comes apart piece by piece and
settles into a debris field. `three/structures/collapse.ts` owns it, and three properties are deliberate:

1. **Nothing computed there is read by anything else.** The output is a rotation and a position. Exposure
   comes from `propagation/structures.ts` and is never modified.
2. **It is a pure function of the current exposure** — no accumulation. Scrub the timeline back and the
   structure stands up again, because that frame is one the hazard had not reached. A structure that stayed
   down would assert a permanent outcome the simulation never produced.
3. **Only the `severe` band collapses.** The thresholds are imported from `propagation/structures.ts`, so
   the picture and the reported status cannot disagree: lean from `at_risk`, failure inside `severe`, and an
   oil slick never knocks anything down.

This is an **illustration of the exposure band, not a damage model** — AQUASHIELD has none. The
`StructuresPanel` says so in the UI, next to the statuses, so the picture is never the only thing telling the
operator what it means (CLAUDE.md §25). `collapse.test.ts` asserts the thresholds, the reversibility and the
oil-spill exemption.

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
frontend. Play/pause/speed/scrub playback (Prompt 9 — see "Timeline playback" above) steps through the
fetched frames client-side; each step flows through the same `toVisualState` seam into the 3D scene as
manual scrubbing always did.

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
| `index-*.js` (landing, routing, UI kit, animations) | ~96 KB | Always (initial) |
| `ScenarioBuilderFeature-*.js` | ~6 KB | Only on `/scenarios` |
| `CommandCenterPage-*.js` (Three.js + R3F + drei + the whole scene graph, now including the procedural `Sky`) | ~258 KB | Only on `/command-center` |

Both `CommandCenterPage` and `ScenarioBuilderFeature` are `React.lazy()` + `Suspense` in `App.tsx` — the
landing page's initial load never pays for Three.js. `LoadingOverlay` (real stage list —
`["Environment","Simulation","Visualization","Command Systems"]`, indeterminate spinner, **no fabricated
percentage** — Prompt 8 explicitly forbids a fake `73%`) is the `Suspense` fallback while the command
center chunk loads.

Images: all six scenes now sit in the same stacked viewport rect (`ImageStage`), so native
`loading="lazy"`'s scroll-position-based deferral can't apply the way it did for Prompt 8's separate
sections — fetch priority does the deferring instead: the first scene is `fetchPriority="high"`/`eager`,
the other five are `fetchPriority="low"`/`lazy`. `decoding="async"` on all six.

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
- No `<Environment preset>`/HDRI texture — the sky (drei's `Sky`) is geometry + shader, computed, so it
  carries no texture download and no third-party CDN dependency.

## Accessibility

- Native document scroll for the landing sequence (no scroll-jacking) — keyboard/screen-reader behavior is
  the browser's own.
- `usePrefersReducedMotion` (`frontend/src/hooks/`) gates: the scroll-linked image parallax (skipped
  entirely), text-reveal travel distance (16px → 0px), and `OrbitControls` damping (disabled).
- Every icon-only control (`IconButton`) requires a `label` prop that becomes its accessible name.
- `ErrorState`/`EmptyState`/`LoadingOverlay` use `role="alert"`/`role="status"` with `aria-live` where
  appropriate.
- Focus rings (`focus-visible:ring-*`) on every interactive control, including `LiquidMetalButton`.
- `PlaybackControls`' Play/Pause button responds to Space/Enter via the native `<button>` element's own
  default behavior (Prompt 9) — no page-level keydown listener, so Space only toggles playback when that
  specific button has focus.

## Testing

Run for real, not assumed — `cd frontend && npm run test`:

- **Landing:** `landingAssets.test.ts` (6 beats map to 6 distinct real assets, correct disaster-category
  order), `sceneProgress.test.ts` (crossfade continuity across every scene boundary, Ken Burns scale/drift
  curves, active-index selection — pure functions, no DOM), `CinematicScroll.test.tsx` (reduced-motion
  renders all six headlines statically with zero scroll listeners attached; full-motion mode renders the
  sticky stage with only the first scene initially opaque, and its scroll listener is removed on unmount).
- **Three.js (data/registry layer):** `disasters/registry.test.ts` (correct visualizer per type, reused
  types, unknown type returns `null` without throwing), `adapters/simulationVisualAdapter.test.ts` (every
  disaster type's real `hazard_state` fields map to the expected radius/intensity/center — including "a
  missing field becomes 0, never a guess"), `three/pipeline.test.ts` (a real `SimulationState` for every
  one of the 9 disaster types resolves to a renderable visualizer end to end), `utils/geoProjection.test.ts`,
  `utils/colorRamp.test.ts`.
- **Command center (data flow, mocked network):** `command-center/tests/CommandCenterPage.test.tsx` —
  loads a scenario + pending run, shows an error state when scenarios fail to load, shows an empty state
  with no runs, executes a run end to end (mocked `simulationApi`/`scenarioApi`) confirming a real frame's
  `hazard_state` reaches the UI as the adapter's label text, (Prompt 8.1) confirms a completed run with
  zero timeline frames renders the "Awaiting playback data" state, not the old bare "Timeline data
  unavailable" text, and (Prompt 9) confirms clicking Play/Pause flips the button's `aria-pressed` state end
  to end and that dragging the scrub slider while playing pauses it. The 3D viewport itself is stubbed in
  this file specifically (`vi.mock("../components/CommandCenterViewport", ...)`) — see "Known limitations."
- **Timeline playback (Prompt 9):** `command-center/tests/useCommandCenterSession.test.ts` (new) — exercises
  the interval state machine directly with Vitest fake timers: `play()` advances `frameIndex` on the
  documented interval, `pause()` stops it, `setPlaybackSpeed` changes the interval's timing (2x halves it),
  playback auto-stops at the last frame without looping, playback auto-pauses when the selected run or
  scenario changes (and when frames reload), manual `setFrameIndex` (scrub) pauses playback, `play()` is a
  no-op already at the last frame, and the interval is provably cleaned up on unmount
  (`vi.getTimerCount()` returns to `0`). `command-center/tests/PlaybackControls.test.tsx` (new) —
  Play/Pause `aria-pressed`/label text, toggling via `onTogglePlay` on click and on Space-while-focused,
  the active speed button's `aria-pressed`, `onSpeedChange` firing with the right multiplier, and the
  slider's `onScrub` firing with a numeric index.
- **App/routing:** `app/App.test.tsx` — the landing route renders real beat content, and the "Continue"
  link navigates into the `/explore` gateway.

**98 frontend tests, all passing** (Prompt 8/8.1/9's 72 + Prompt 9.1's 26 new: `ScenarioForm.test.tsx` (24
cases covering all 9 disaster types' fields/descriptions/templates/validation) + `ScenarioContextPanel.test.tsx`
+ 1 new `CommandCenterPage.test.tsx` case). `npm run lint` and `npm run build` (`tsc --noEmit && vite build`)
both clean. Backend: 84 tests passing (up from 39 — Prompt 9.1 added `GET /disaster-types` tests, seed
idempotency tests, and parameterized disaster-type coverage; see docs/development/scenarios.md); `simulation/tests`:
57 passing (unchanged).

### Known limitation: no automated WebGL render test

`@react-three/test-renderer` (the standard tool for this) was evaluated and removed — its mocked WebGL
context doesn't implement `texImage3D`, which the installed `three@0.186.0`'s `WebGLRenderer` now requires
unconditionally (three has dropped WebGL1 support; this test-renderer package's last real release
predates that and is effectively unmaintained — npm flags its most recent tag as "released in error, no
changes"). Rather than force a fragile workaround, scene-graph correctness is verified at the seam that
actually varies (`toVisualState` + `getDisasterVisualizer`, both pure functions, both fully tested) and
`CommandCenterPage`'s data flow is tested with the viewport stubbed out. **Actual WebGL rendering was not
exercised by an automated test in this environment** — see "Manual verification."

#### Compiling shaders headlessly (one-off technique)

A custom shader that fails to compile shows up as a black or untextured viewport, and `tsc`, ESLint and
Vitest all pass regardless. Headless Chrome with SwiftShader does give a real WebGL context, which is enough
to prove the GLSL compiles:

```
npm run dev &
# a throwaway page that builds the materials and renders one frame,
# writing the result into document.title / the DOM
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --virtual-time-budget=9000 --dump-dom http://localhost:5173/<page>.html
```

Used to verify the forest and terrain materials compile (3 programs, no errors) when the vegetation layer
landed. It is a manual technique, not a committed test — the harness page is deleted afterwards.

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

### Prompt 8.1 manual verification (2026-09-12)

Same constraint: **no browser automation tool was available in this environment for this pass either.**
Verified programmatically: `npm run test` (55 passing), `npm run lint` (clean), `npm run build` (clean,
`CommandCenterPage` chunk still separate from the initial bundle), `pytest backend/tests` (39 passing),
`pytest simulation` (57 passing) — all after the camera/terrain/water/environment/landing changes above.
**Not verified**: actually scrolling through the corrected `CinematicScroll` sequence, or visually
confirming the corrected camera framing, terrain shading, water shader, and sky in a real browser. The
diagnosis behind each fix in the table above was made by reading the source (geometry radius vs. camera
distance, color ramp bands, shader math) against the reported screenshot, not by re-observing the fix live
— this should be the first thing checked in a real browser before treating this pass as complete.

### Prompt 9 manual verification (2026-09-12)

Same constraint again: **no browser automation tool was available in this environment for this pass
either.** Verified programmatically: `npm run test` (72 passing, up from 55), `npm run lint` (clean),
`npm run build` (clean, `tsc --noEmit` clean, `CommandCenterPage` chunk still separate from the initial
bundle), `pytest backend/tests` (39 passing, unchanged), `pytest simulation` (57 passing, unchanged) — this
phase touched no backend or simulation code. **Not verified**: actually pressing Play in a real browser and
watching the 3D scene step through frames, the feel of the interval pacing at each speed, whether the
Play/Pause button's focus ring and Space-key behavior feel right in practice, or any of it on a touch/mobile
scrub interaction. The interval/auto-pause state machine itself is verified deterministically with Vitest
fake timers (`useCommandCenterSession.test.ts`) rather than by eye — that test suite is the actual
correctness evidence for this phase; a real-browser pass is still the right next check before demo use.

### Prompt 9.1 manual verification (2026-09-12)

Same constraint again: **no browser automation tool was available in this environment for this pass
either.** Verified programmatically: `npm run test` (98 passing, up from 72), `npm run lint` (clean),
`npm run build` (clean, chunk layout unchanged), `pytest backend/tests` (84 passing, up from 39),
`pytest simulation` (57 passing, unchanged). Also verified directly (not just via automated tests): the
updated seed script was actually run against the local dev PostgreSQL/PostGIS instance
(`python -m app.db.seed`), and a `psql` query confirmed all 9 disaster types now have at least one `READY`
scenario row; `GET /disaster-types` was smoke-tested via `TestClient` and confirmed to return all 9 entries
with correctly-resolved `model_identifier`s (including `storm_surge` → `cyclone-demo-v1`). **Not verified**:
actually clicking the new "New scenario" link in a browser, visually confirming the restyled Scenario
Builder form's appearance, or selecting each of the 9 types end-to-end by hand in the Command Center and
watching the correct visualizer render. A real-browser pass covering all 9 disaster types end to end (create
→ run → execute → timeline → playback → visualizer) remains the right next check before demo use.

## IMPLEMENTED / VERIFIED / SIMPLIFIED / PLANNED / NOT IMPLEMENTED

**IMPLEMENTED & VERIFIED** (automated tests and/or build output confirm it works):
- Routing (`/`, `/explore`, `/command-center`, `/scenarios`), all lazy-loaded appropriately.
- Six-asset cinematic scroll stage (`CinematicScroll`) — one sticky viewport, continuous crossfade/Ken
  Burns transitions driven by a single scroll-progress value, reduced-motion aware (Prompt 8.1; supersedes
  Prompt 8's stacked-section `ScrollSequence`).
- `LiquidMetalButton` CTA and page-transition navigation into the command center; `/explore` now has a
  dimmed backdrop image (reused landing asset) instead of a flat void (Prompt 8.1).
- Full Three.js/R3F/drei scene graph (improved water shader, corrected terrain, procedural `Sky` +
  fog atmosphere, corrected camera composition, lighting, markers, instanced particles) — compiles,
  builds, and its data-driving logic (adapter + registry) is unit-tested.
- Real integration with Prompt 7: scenario selection, run creation/execution, timeline retrieval, frame
  selection, all via real HTTP calls with real error/loading/empty states.
- Timeline playback (Prompt 9): play/pause/speed(0.5x-4x)/scrub over the fetched `TimelineFrame[]`, with a
  deterministic interval/auto-pause state machine verified under Vitest fake timers — see "Timeline
  playback" above.
- Design token system, reusable UI component library.
- Code splitting confirmed via build output; reduced-motion, focus-visible, and aria-live states in place.
- Complete disaster catalog (Prompt 9.1): all 9 disaster types selectable/configurable in the Scenario
  Builder, discoverable from the Command Center via a "New scenario" link, and backed by at least one
  `READY` seeded demo scenario each — see docs/development/scenarios.md for the full catalog/honesty-matrix
  detail.

**SIMPLIFIED / DEMONSTRATION** (real, but not scientifically or visually final):
- The water surface, terrain, and every disaster visualizer are stylized/illustrative, not GIS-backed —
  documented at every relevant file's top comment.
- `lat/lon -> scene position` is an equirectangular approximation for visualization only.
- The landing page's cinematic quality (motion feel, timing) is implemented per the described vocabulary
  but not human-eye-verified in this environment — same caveat applies to Prompt 8.1's camera/terrain/water
  corrections, per "Prompt 8.1 manual verification" above.

**PLANNED** (explicitly deferred, not started):
- `Tooltip`, `Modal`, `Drawer`, `Toast` components.
- `three/currents/`, `three/waves/` as dedicated subsystems (currently folded into each disaster
  visualizer directly — would be extracted if a second visualizer needed the same current/wave logic).
- Postprocessing pipeline (bloom/vignette) — conditional per the prompt itself ("only if performance
  permits"); not evaluated in this environment given no browser to profile against.
- A dedicated full-width bottom timeline scrubber bar — Prompt 9 deliberately scoped playback to a compact
  control inside the existing Simulation panel (`PlaybackControls`) rather than a separate, larger timeline
  surface; that bigger surface is still not built, and would be a distinct future UI change, not a
  correction of what shipped here.
- Looping playback and scenario-comparison/A-B playback (architecture.md §7/§11) — playback stops at the
  last frame by design (see "Timeline playback" above); side-by-side comparison is unrelated future scope.

**NOT IMPLEMENTED** (out of scope for this phase, per its explicit hard stop):
- WebSocket/real-time streaming of simulation telemetry (still Prompt 9's non-goal, per its brief — this
  phase's playback is 100% client-side over already-fetched frames).
- Risk/vulnerability/geospatial analysis (Prompt 10).
- AI agents, RAG, response planning, Incident Action Plan (Prompts 11-13).
- Automated WebGL scene-render testing (see "Known limitation" above) and live browser visual
  verification (see "Manual verification" above) — including Prompt 9's playback, per "Prompt 9 manual
  verification" above.
