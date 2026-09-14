# Coastline Orientation and Flat-Canvas Rendering — Design

Date: 2026-09-14
Status: Approved for planning
Related: architecture.md ADR-009 (Real City mode), §26 (simulation mirror rule), §27 (command centre rules), CLAUDE.md §25/§26/§27

## 1. Problem

The demo shoreline world hard-codes a single coastal orientation. `simulation/core/propagation.py`
defines land as everything east of the shoreline curve:

```python
def is_land(x_km, y_km, shore):
    return x_km >= shore_x(y_km, shore)
```

That rule is mirrored line-for-line in `frontend/src/propagation/world.ts` and again as a GLSL twin in
`frontend/src/three/world/demoWorld.ts`. It is correct for a west-facing coast (Arabian Sea cities such as
Mumbai and Kochi) and wrong for an east-facing one (Bay of Bengal cities such as Chennai, Puri and
Visakhapatnam).

Real City mode (ADR-009) works around this in the data-preparation script rather than in the world model.
`scripts/build_town_data.py` negates the cross-shore axis for an east-facing city:

```python
if city.ocean_side == "east":
    dx_km = -dx_km
```

Two consequences follow.

**The rendered city is a mirror image.** Chennai currently draws with the Bay of Bengal to the west and its
street layout laid out left-for-right. It is not a simplified map of Chennai; it is a reversed one. Anyone
comparing the scene to a real map sees the wrong chirality, which undermines the "real coastline and real
buildings" claim the disclosure label makes.

**The city's own default heading is broken.** `TownProfile.heading_deg` records the real compass bearing a
hazard travels toward that coast — 270° for Chennai — and `useScenarioSession.ts:378` feeds it straight into
`PropagationConfig`. The geometry was mirrored; the heading was not. Verified against the committed data:

```
shore_x(150) with Chennai shore   = 147.24
distance_to_coast_along_heading(70, 150, 270) = None
distance_to_coast_along_heading(70, 150,  90) = 77.2423
front_state(..., heading 270, 60 min) -> arrived=False, position_x_km=-380.0
```

A Chennai scenario launched with the town default therefore sends the hazard front out of the world. It never
makes landfall, so `arrival_progress` stays 0, no structure is ever exposed, and no building tints. The bug is
latent only because a scenario that overrides the heading to 90° happens to work.

Fixing the orientation in the world model rather than in the data removes both problems at once and unblocks
the four remaining east-facing cities.

## 2. Approach

Orientation reduces to a sign. Every land test in the codebase is the same subtraction, `x - shore_x(y)`,
so a single scalar on `ShoreParams` covers all of them without touching any call site that already delegates
to `is_land`.

```python
@dataclass(frozen=True)
class ShoreParams:
    base_x_km: float = SHORE_BASE_X_KM
    terms: tuple[tuple[float, float, float], ...] = SHORE_TERMS
    land_sign: float = 1.0   # +1 = land east of the curve, -1 = land west


def land_depth_km(x_km, y_km, shore=DEFAULT_SHORE):
    """Signed distance inland from the shoreline (negative offshore)."""
    return shore.land_sign * (x_km - shore_x(y_km, shore))


def is_land(x_km, y_km, shore=DEFAULT_SHORE):
    return land_depth_km(x_km, y_km, shore) >= 0.0
```

`distance_to_coast_along_heading`, `nearest_shore_distance` and `front_state` need no edits — each already
calls `is_land`. `land_sign` defaults to `+1`, so the fictional demo world produces bit-identical output and
existing fixtures continue to pass unchanged.

### Alternatives considered

**Flip the x axis at render time only.** Negate `kmToScene`'s x for east-facing towns and leave the physics
mirrored. Rejected: it fixes the picture and not the model. Telemetry coordinates and `heading_deg` stay
reversed, the heading bug above survives, and the frontend and the simulation engine would disagree about
where land is — a direct violation of §26's rule that the mirror stays line-for-line faithful.

**Keep the data mirror and correct the heading only.** Negate `town.heading_deg` where it is applied.
Rejected: it repairs the symptom, leaves Chennai rendering reversed, and adds a second hidden mirroring
convention that the next contributor has to discover.

## 3. Scope

Two branches, in order.

`feature/coastline-orientation` — sections 4 through 8. Correctness work: the model change, its mirrors, the
data transform, the downstream sign-aware sites and the tests.

`feature/flat-canvas-polish` — sections 9 through 11. Presentation work: flat-canvas grid ticks, per-type
building geometry, town-bounds camera fit.

The split keeps a cross-domain physics change reviewable on its own, and keeps a frontend-only change out of
the same diff as a simulation-engine change (CLAUDE.md §21).

## 4. The world model and its two mirrors

Per CLAUDE.md §26, the shoreline definition exists in three places and all three change together.

**`simulation/core/propagation.py`** (authoritative). Add `land_sign` to `ShoreParams` as above. Add a
module-level `land_depth_km` and rewrite `is_land` in terms of it. `shore_params_for_city` reads the town
JSON's new `ocean_side` field and maps it: `"west"` (ocean west, land east) to `+1`, `"east"` to `-1`. A town
file without `ocean_side` is a config error, consistent with how the loader already treats a missing
`shore_base_x_km` — it raises rather than guessing an orientation.

**`frontend/src/propagation/world.ts`** (TypeScript mirror). `ShoreParams` gains `landSign: number`;
`DEFAULT_SHORE` sets it to `1`. Add `landDepthKm` and rewrite `isLand`. Note that
`three/world/demoWorld.ts` already exports a `landDepthKm` with the same meaning but no sign; that function
becomes a re-export of the propagation-mirror one so there is a single definition rather than two that can
drift.

**The GLSL twin in `three/world/demoWorld.ts`.** Add a `uLandSign` uniform beside the existing
`uShoreBase`/`uShoreAmp`/`uShoreFreq`/`uShorePhase`, and use it in the GLSL `landDepthKm`:

```glsl
uniform float uLandSign;
float landDepthKm(float xKm, float yKm) { return uLandSign * (xKm - shoreX(yKm)); }
```

`shoreUniformDefaults()` returns `uLandSign` alongside the others. `waterMaterial.ts` and
`terrainMaterial.ts` declare it in their uniform blocks. Because it is a uniform and not a baked constant,
switching cities never triggers a shader recompile — the same rule §27 already states for the shoreline
shape.

`terrainHeightKm` needs no change on either side: it branches on `d = landDepthKm(...)`, which now carries the
sign. The water shader discards against terrain height, so the shoreline stays watertight by construction for
either orientation.

## 5. Town data

`scripts/build_town_data.py` drops the `dx_km = -dx_km` mirror, so `to_local_km` becomes orientation-neutral,
and writes `ocean_side` into the emitted JSON from the existing `CityDef.ocean_side` field. `TownProfile` in
`shared/types/index.ts` gains `ocean_side: "east" | "west"`.

Rebuilding `chennai.json` from source requires Natural Earth and the Overpass API. Rather than depend on
network access for a deterministic transform, apply the exact algebraic equivalent to the committed file:

- `x' = 300 − x` for every building's `xKm`
- `shore_base_x_km' = 300 − shore_base_x_km`
- negate each shore term's `amp` (the sine terms mirror about the base)
- `ocean_side: "east"`, hence `land_sign = −1`
- `rotY' = π − rotY`, since a reflection about the x axis reverses footprint orientation

The transform is exact: `shore_x'(y) = 300 − shore_x(y)`, so `land_sign · (x' − shore_x'(y)) = −((300 − x) −
(300 − shore_x(y))) = x − shore_x(y)`, which is the pre-transform inland depth. Every building's land status
and inland depth are preserved to floating-point precision. Spot-checked: `shore_x'(150) = 152.76`, sample
building `x' = 150.2`, inland under the new sign.

The script change and the data change are equivalent, so re-running the builder with network access
reproduces the committed file rather than contradicting it. A one-shot transform script lives under
`scripts/`, is committed, and states in its docstring that it is a migration of already-fetched data, not a
new data source. `fit_quality` and `data_provenance` carry over unchanged; provenance gains a note that the
file was migrated to the sign convention.

## 6. Sign-aware downstream sites

Eight places assume "inland is `+x`" and are corrected to route through the signed depth. None of them is a
new behaviour; each is the same logic with the sign applied.

| Site | Change |
|---|---|
| `simulation/core/structures.py:83` `inland_depth_km` | Delegate to `propagation.land_depth_km` — one definition, not two. |
| `frontend/src/propagation/structures.ts` (its mirror) | Same. |
| `three/structures/support.ts` `shoreAlignedRotationY` | Its contract is "local −Z faces the sea". With land west, the sea is on the opposite side, so the result rotates by π. `shoreTangent` itself is unchanged; the sign enters only in the facing. |
| `three/structures/StructureModel.tsx:67` | Shore-relative placement clamp. |
| `three/markers/OriginPin.tsx:30` | Clamps a dragged origin back onto water; the margin must be subtracted on the water side, which flips with the sign. |
| `three/urban/buildingPlacement.ts:83` | The fictional procedural field marches inland from the shoreline; the step direction flips. Only ever used by the fictional `dense_coastal` profile, whose sign stays `+1`, but it must respect the parameter rather than the assumption. |
| `features/command-center/hooks/useScenarioSession.ts:45` | Origin clamp against `shoreX`. |
| `features/command-center/components/TelemetryPanel.tsx:51` | Constructs `ShoreParams` from a town; must carry `landSign`. |

`SceneRoot.tsx:76` also constructs `ShoreParams` from a town and gains the same field.

## 7. Exposure and the AI layer

`exposure_for` reads `inland_depth_km` and is otherwise orientation-neutral: the tsunami branch tests
`depth < -0.5 or depth > inundation_km`, and lateral offset is computed perpendicular to the heading, which
carries its own direction. Once `inland_depth_km` is signed, exposure is correct for both orientations with no
further change. The AI layer consumes exposure through the existing read-only data access and needs no edit.

## 8. Testing

- `frontend/src/propagation/mirror.test.ts` is the existing tripwire. Extend
  `scripts/generate_propagation_fixtures.py` to emit east-facing cases (`land_sign = −1`) alongside the
  current ones, then regenerate `shared/fixtures/propagation_cases.json`. Both signs are then pinned across
  the Python/TypeScript boundary.
- `simulation/tests/test_real_city_shore.py` gains a regression for the bug in section 1: for every committed
  town, `distance_to_coast_along_heading(default_origin, town.heading_deg, town_shore)` must be a finite
  number. That single assertion would have caught the current failure.
- A test asserting every building in every committed town file is on land under that town's own sign.
- Existing demo-world tests must pass unmodified — that is the evidence `land_sign = +1` is genuinely
  bit-identical, so their passing is a required check rather than an incidental one.
- `frontend/src/three/urban/realTownPlacements.test.ts` and `buildingPlacement.test.ts` cover placement under
  both signs.

## 9. Flat-canvas grid and coastal edge

Under `world_profile` `dense_coastal` or `real_city`, `terrainHeightKm` already returns a constant `0.05` on
the land side, so the canvas is flat and free of the procedural relief. What is missing is legibility: a flat
matte plate with no reference marks reads as empty space.

Add, inside `ShorelineTerrain` and only when `flat` is true:

- a km-spaced grid drawn as a single `LineSegments`, subordinate in contrast to the buildings
- a shoreline edge polyline sampled from `shoreX` at the same spacing, drawn in a distinct colour so the
  land/sea boundary is explicit rather than inferred from the water's alpha

Both are line primitives added to the existing terrain group. No second terrain mesh and no second water mesh
(§27). The grid is a coordinate reference in the synthetic km frame, not a projected geographic graticule, and
says so in a comment where it is built.

## 10. Per-type building geometry

`shared/constants/towns/chennai.json` classifies its 1535 buildings as 1529 `building`, 5 `hospital` and
1 `lighthouse`, but `realTownPlacements.ts` discards `b.type` and renders everything as a box sized by `cls`.

Route the non-generic types to the existing procedural models in `three/structures/models` and leave the
generic mass in the three `ClassStand` instanced meshes. The instanced path keeps its draw-call budget — a
handful of typed models is a rounding error against 1529 instances — and no new geometry system is
introduced. `StructureType` and `STRUCTURE_LABELS` are unchanged; this only stops discarding a field the data
already carries.

## 11. Town-bounds camera fit

`SceneRoot` frames the origin-to-landfall segment. For `real_city` that can frame open water when the origin
sits far offshore. Add a branch: when a town is present, compute the axis-aligned bounding box of
`town.buildings` in km, convert to scene units, and use its centre and half-extent as `focus` and
`frameRadius`, unioned with the landfall point so the incoming front stays in shot. `CameraController` already
interpolates to a new focus, so the transition is smooth with no change there. Visualizers still never move
the camera.

## 12. Out of scope

**Amber as a proximity buffer.** The request describes amber as "flood front within a safety buffer
distance". Today amber (`at_risk`) is derived from the same exposure value as every other band, in
`propagation/structures.ts` `statusFor`. Changing it to a distance test would change the meaning of a status
that `StructuresPanel` renders and that the AI layer reads through exposure — the band would no longer mean
what the rest of the system takes it to mean. Left unchanged; revisit as its own change with its own
consistency pass across the UI, the exposure mirror and the agent schemas if the semantics really should
change.

**The other four cities.** Mumbai, Puri, Visakhapatnam and Kochi stay commented out in
`build_town_data.py` pending their own fit-quality validation (ADR-009). This design removes the blocker that
made the two east-facing ones impossible to render correctly; it does not enable them.

**New scene-root, terrain, water or building components.** The request named `TownTwinScene.tsx`,
`FlatCanvasTerrain.tsx`, `TownWaterPlane.tsx` and `TownBuildingMesh.tsx`. Creating them would mean a second
scene root, a second terrain mesh and a second water mesh, which §27 forbids and which would break the
watertight-shoreline invariant that depends on exactly one of each evaluating the same height function. The
equivalent behaviour goes into `SceneRoot`, `ShorelineTerrain`, `WaterSurface` and `DenseBuildingLayer`.

## 13. Documentation

- architecture.md: extend ADR-009 with the orientation decision, and §28c with the `land_sign` convention.
- CHANGELOG.md: one entry per branch, in the §19 format.
- `docs/development/simulation.md`: document `land_sign` on `ShoreParams` and the rule that a town file must
  declare `ocean_side`.
- `docs/development/command-center.md`: the flat-canvas grid and the town-bounds camera fit.
