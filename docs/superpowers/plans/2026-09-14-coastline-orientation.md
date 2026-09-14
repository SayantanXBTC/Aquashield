# Coastline Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Represent coastal orientation as a sign on `ShoreParams` so east-facing cities (Bay of Bengal) render and simulate correctly, instead of being mirrored during data preparation.

**Architecture:** Every land test in the codebase is the same subtraction, `x - shore_x(y)`. Adding a `land_sign` field (+1 = land east, −1 = land west) to `ShoreParams` and routing all land tests through a signed `land_depth_km` covers the simulation engine, its TypeScript mirror, and its GLSL twin without touching any call site that already delegates to `is_land`. The default is +1, so the fictional demo world stays bit-identical. Chennai's committed data is then transformed offline to the unmirrored orientation.

**Tech Stack:** Python 3 (simulation engine, pytest), TypeScript + React (frontend mirror, Vitest), GLSL (Three.js shader uniforms).

**Spec:** `docs/superpowers/specs/2026-09-14-coastline-orientation-design.md`

## Global Constraints

- `simulation/core/propagation.py` is authoritative. `frontend/src/propagation/world.ts` is a line-for-line mirror of it, and `frontend/src/three/world/demoWorld.ts` holds a GLSL twin. All three change together, and `frontend/src/propagation/mirror.test.ts` is the tripwire (CLAUDE.md §26).
- After any change to propagation formulas or shoreline constants, regenerate fixtures: `.venv/bin/python scripts/generate_propagation_fixtures.py`.
- `simulation/` imports no FastAPI, SQLAlchemy, React or Three.js. It may read committed JSON from `shared/constants/` by path (this is the existing ADR-009 pattern).
- Determinism is required: identical `disaster_type` + `scenario_config` + `timestep_config` + `seed` must produce an identical `TimelineFrame` sequence.
- `land_sign` defaults to `+1.0` everywhere. Every pre-existing demo-world test must pass **unmodified** — that is the evidence the default path is bit-identical.
- The shoreline shape is a runtime uniform, never a baked shader constant. Switching cities must not force a shader recompile (CLAUDE.md §27).
- Exactly one `<Canvas>`, one terrain mesh and one water mesh in the app. Do not create `TownTwinScene.tsx`, `FlatCanvasTerrain.tsx`, `TownWaterPlane.tsx` or `TownBuildingMesh.tsx` (CLAUDE.md §27).
- Never present exposure bands as damage or casualty estimates.
- Branch: `feature/coastline-orientation`, cut from `develop`.
- Commit format: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Scope note:** This plan covers spec sections 4–8 (the correctness work). Spec sections 9–11 — flat-canvas grid ticks, per-type building geometry, town-bounds camera fit — are presentation work for a second branch, `feature/flat-canvas-polish`, and get their own plan.

**Test commands used throughout:**

```bash
.venv/bin/python -m pytest simulation/tests -q          # simulation engine
cd frontend && npm test -- --run                        # Vitest, whole suite
cd frontend && npm test -- --run src/propagation        # Vitest, mirror only
cd frontend && npm run build                            # type-check + bundle
```

---

### Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Confirm a clean tree and cut the branch**

```bash
git status --short
git checkout develop
git checkout -b feature/coastline-orientation
```

Expected: `git status --short` shows nothing but untracked scratch directories before you begin. If it shows modified tracked files, stop and ask — do not stash someone else's work.

- [ ] **Step 2: Record the baseline**

```bash
.venv/bin/python -m pytest simulation/tests -q
cd frontend && npm test -- --run && cd ..
```

Expected: both green. Write down the test counts; the same tests must still pass at the end of Task 1 through Task 5 with no edits to their assertions.

---

### Task 1: Signed land depth in the simulation engine

**Files:**
- Modify: `simulation/core/propagation.py:62-72` (`ShoreParams`), `:102-103` (`is_land`)
- Modify: `simulation/core/structures.py:81-83` (`inland_depth_km`)
- Test: `simulation/tests/test_propagation_orientation.py` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ShoreParams(base_x_km: float = 196.0, terms: tuple[tuple[float, float, float], ...] = SHORE_TERMS, land_sign: float = 1.0)`
  - `land_depth_km(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float`
  - `is_land(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> bool` (signature unchanged, semantics now signed)
  - `simulation.core.structures.inland_depth_km` keeps its signature and delegates to `land_depth_km`.

- [ ] **Step 1: Write the failing test**

Create `simulation/tests/test_propagation_orientation.py`:

```python
"""Coastal orientation: a west-facing coast (ocean west, land east, the
historical default) and an east-facing coast (ocean east, land west) are the
same geometry with an opposite sign."""

from simulation.core.propagation import (
    DEFAULT_SHORE,
    ShoreParams,
    distance_to_coast_along_heading,
    is_land,
    land_depth_km,
    shore_x,
)
from simulation.core.structures import inland_depth_km

# The demo shoreline reflected about x = 150: shore_x'(y) = 300 - shore_x(y).
EAST_FACING = ShoreParams(
    base_x_km=300.0 - DEFAULT_SHORE.base_x_km,
    terms=tuple((-amp, freq, phase) for amp, freq, phase in DEFAULT_SHORE.terms),
    land_sign=-1.0,
)


def test_default_shore_is_west_facing():
    assert DEFAULT_SHORE.land_sign == 1.0


def test_west_facing_land_is_east_of_the_curve():
    x = shore_x(150.0)
    assert is_land(x + 10.0, 150.0) is True
    assert is_land(x - 10.0, 150.0) is False
    assert land_depth_km(x + 10.0, 150.0) == 10.0


def test_east_facing_land_is_west_of_the_curve():
    x = shore_x(150.0, EAST_FACING)
    assert is_land(x - 10.0, 150.0, EAST_FACING) is True
    assert is_land(x + 10.0, 150.0, EAST_FACING) is False
    assert land_depth_km(x - 10.0, 150.0, EAST_FACING) == 10.0


def test_reflection_preserves_inland_depth():
    """A point and its mirror image are equally far inland."""
    for x, y in ((70.0, 150.0), (210.0, 40.0), (196.0, 299.0)):
        assert land_depth_km(x, y) == land_depth_km(300.0 - x, y, EAST_FACING)


def test_headings_reverse_between_orientations():
    """East is landward on a west-facing coast; west is landward on an
    east-facing one. The mirrored pair must agree on the distance."""
    west = distance_to_coast_along_heading(70.0, 150.0, 90.0)
    east = distance_to_coast_along_heading(230.0, 150.0, 270.0, EAST_FACING)
    assert west is not None and east is not None
    assert abs(west - east) < 1e-9


def test_east_facing_hazard_moving_seaward_never_lands():
    assert distance_to_coast_along_heading(230.0, 150.0, 90.0, EAST_FACING) is None


def test_structures_inland_depth_is_signed():
    x = shore_x(150.0, EAST_FACING)
    assert inland_depth_km(x - 5.0, 150.0, EAST_FACING) == 5.0
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m pytest simulation/tests/test_propagation_orientation.py -q`
Expected: FAIL — `ImportError: cannot import name 'land_depth_km'`, and `ShoreParams` rejects the `land_sign` keyword.

- [ ] **Step 3: Add the sign to `ShoreParams`**

In `simulation/core/propagation.py`, replace the `ShoreParams` dataclass body (currently lines 62-69) with:

```python
@dataclass(frozen=True)
class ShoreParams:
    """The shoreline's shape and which side of it is land — the fictional
    demo constants by default, or a curated real city's fitted curve
    (ADR-009). Never real lat/lon; always the same 3-term-sine shape
    `shore_x` expects, whatever produced it.

    `land_sign` is the coast's orientation: +1 means land lies east of the
    curve and the ocean west of it (a west-facing coast, e.g. the Arabian
    Sea); -1 is the reverse (an east-facing coast, e.g. the Bay of Bengal).
    It is the ONLY thing that distinguishes the two — every land test in the
    engine is `land_sign * (x - shore_x(y))`."""

    base_x_km: float = SHORE_BASE_X_KM
    terms: tuple[tuple[float, float, float], ...] = SHORE_TERMS
    land_sign: float = 1.0
```

- [ ] **Step 4: Add `land_depth_km` and rewrite `is_land`**

In the same file, replace `is_land` (currently lines 102-103) with:

```python
def land_depth_km(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float:
    """Signed distance inland from the shoreline in km; negative offshore.
    Carries the coast's orientation, so this is the single place the
    east/west facing distinction lives."""
    return shore.land_sign * (x_km - shore_x(y_km, shore))


def is_land(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> bool:
    return land_depth_km(x_km, y_km, shore) >= 0.0
```

Leave `distance_to_coast_along_heading`, `nearest_shore_distance` and `front_state` untouched — they already call `is_land`.

- [ ] **Step 5: Delegate the structures copy**

In `simulation/core/structures.py`, change the import on line 35 and the function at lines 81-83:

```python
from simulation.core.propagation import DEFAULT_SHORE, ShoreParams, heading_vector, land_depth_km, shore_x
```

```python
def inland_depth_km(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float:
    """Signed distance inland from the shoreline (negative offshore).
    One definition, in propagation.py — this name is kept because the
    exposure rules below read better with it."""
    return land_depth_km(x_km, y_km, shore)
```

`shore_x` stays imported: `nearest_shore_distance`-style code elsewhere in the module still uses it.

- [ ] **Step 6: Run the new test**

Run: `.venv/bin/python -m pytest simulation/tests/test_propagation_orientation.py -q`
Expected: PASS, 7 tests.

- [ ] **Step 7: Prove the default path is bit-identical**

Run: `.venv/bin/python -m pytest simulation/tests -q`
Expected: PASS with the same count as the Task 0 baseline plus 7. If any pre-existing test needed an edit to pass, the change is not bit-identical — stop and find out why.

- [ ] **Step 8: Commit**

```bash
git add simulation/core/propagation.py simulation/core/structures.py simulation/tests/test_propagation_orientation.py
git commit -m "$(cat <<'EOF'
feat(simulation): carry coastal orientation as a sign on ShoreParams

Land tests were hard-coded to "land is east of the shoreline", which is
correct for a west-facing coast and wrong for an east-facing one. Route
every test through a signed land_depth_km so an east-facing coast is the
same geometry with land_sign = -1.

Defaults to +1, so the fictional demo world is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Signed land depth in the TypeScript mirror

**Files:**
- Modify: `frontend/src/propagation/world.ts:26-44` (`ShoreParams`, `DEFAULT_SHORE`, `isLand`)
- Modify: `frontend/src/propagation/structures.ts:28-30` (`inlandDepthKm`)
- Modify: `frontend/src/three/world/demoWorld.ts:35-38` (`landDepthKm`)
- Test: `frontend/src/propagation/orientation.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's semantics (this is its mirror; the formulas must match line-for-line).
- Produces:
  - `interface ShoreParams { baseXKm: number; terms: ReadonlyArray<TownShoreTerm>; landSign: number }`
  - `landDepthKm(xKm: number, yKm: number, shore?: ShoreParams): number` exported from `@/propagation/world`
  - `isLand(xKm, yKm, shore?): boolean` (signature unchanged)
  - `@/three/world/demoWorld` re-exports `landDepthKm` rather than defining its own.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/propagation/orientation.test.ts`:

```typescript
/**
 * Mirror of simulation/tests/test_propagation_orientation.py — the same
 * cases, so the two sides of the port cannot disagree about which side of
 * the shoreline is land.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, distanceToCoastAlongHeading, isLand, landDepthKm, shoreX, type ShoreParams } from "./world";
import { inlandDepthKm } from "./structures";

const EAST_FACING: ShoreParams = {
  baseXKm: 300 - DEFAULT_SHORE.baseXKm,
  terms: DEFAULT_SHORE.terms.map((t) => ({ amp: -t.amp, freq: t.freq, phase: t.phase })),
  landSign: -1,
};

describe("coastal orientation", () => {
  it("defaults to west-facing", () => {
    expect(DEFAULT_SHORE.landSign).toBe(1);
  });

  it("puts land east of the curve when west-facing", () => {
    const x = shoreX(150);
    expect(isLand(x + 10, 150)).toBe(true);
    expect(isLand(x - 10, 150)).toBe(false);
    expect(landDepthKm(x + 10, 150)).toBeCloseTo(10, 9);
  });

  it("puts land west of the curve when east-facing", () => {
    const x = shoreX(150, EAST_FACING);
    expect(isLand(x - 10, 150, EAST_FACING)).toBe(true);
    expect(isLand(x + 10, 150, EAST_FACING)).toBe(false);
    expect(landDepthKm(x - 10, 150, EAST_FACING)).toBeCloseTo(10, 9);
  });

  it("preserves inland depth under reflection", () => {
    for (const [x, y] of [[70, 150], [210, 40], [196, 299]] as const) {
      expect(landDepthKm(x, y)).toBeCloseTo(landDepthKm(300 - x, y, EAST_FACING), 9);
    }
  });

  it("reverses the landward heading", () => {
    const west = distanceToCoastAlongHeading(70, 150, 90);
    const east = distanceToCoastAlongHeading(230, 150, 270, EAST_FACING);
    expect(west).not.toBeNull();
    expect(east).not.toBeNull();
    expect(Math.abs(west! - east!)).toBeLessThan(1e-9);
  });

  it("never lands a seaward heading on an east-facing coast", () => {
    expect(distanceToCoastAlongHeading(230, 150, 90, EAST_FACING)).toBeNull();
  });

  it("signs the structures mirror too", () => {
    const x = shoreX(150, EAST_FACING);
    expect(inlandDepthKm(x - 5, 150, EAST_FACING)).toBeCloseTo(5, 9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/propagation/orientation.test.ts`
Expected: FAIL — `landDepthKm` is not exported from `./world`, and `landSign` is not a property of `ShoreParams`.

- [ ] **Step 3: Add the sign to the mirror**

In `frontend/src/propagation/world.ts`, replace the `ShoreParams` interface, `DEFAULT_SHORE` and `isLand` (lines 24-44) with:

```typescript
/** The shoreline's shape and which side of it is land — the fictional demo
 * constants by default, or a curated real city's fitted curve
 * (architecture.md ADR-009). `landSign` is +1 when land lies east of the
 * curve (a west-facing coast) and -1 when it lies west (east-facing); it is
 * the only thing that distinguishes the two. */
export interface ShoreParams {
  baseXKm: number;
  terms: ReadonlyArray<TownShoreTerm>;
  landSign: number;
}

export const DEFAULT_SHORE: ShoreParams = { baseXKm: SHORE_BASE_X_KM, terms: SHORE_TERMS, landSign: 1 };

/** East-west position of the shoreline at northing `yKm`. */
export function shoreX(yKm: number, shore: ShoreParams = DEFAULT_SHORE): number {
  let x = shore.baseXKm;
  for (const { amp, freq, phase } of shore.terms) {
    x += amp * Math.sin((2 * Math.PI * freq * yKm) / WORLD_KM + phase);
  }
  return x;
}

/** Signed distance inland from the shoreline in km; negative offshore.
 * Carries the coast's orientation. */
export function landDepthKm(xKm: number, yKm: number, shore: ShoreParams = DEFAULT_SHORE): number {
  return shore.landSign * (xKm - shoreX(yKm, shore));
}

export function isLand(xKm: number, yKm: number, shore: ShoreParams = DEFAULT_SHORE): boolean {
  return landDepthKm(xKm, yKm, shore) >= 0;
}
```

Keep the existing `shoreX` if it is already identical; the block above is written out in full so the ordering (`shoreX` before `landDepthKm`) is unambiguous.

- [ ] **Step 4: Delegate the two other copies**

In `frontend/src/propagation/structures.ts`, change the import on line 9 and `inlandDepthKm` at lines 28-30:

```typescript
import { DEFAULT_SHORE, headingVector, landDepthKm, shoreX, type ShoreParams } from "./world";
```

```typescript
export function inlandDepthKm(xKm: number, yKm: number, shore: ShoreParams = DEFAULT_SHORE): number {
  return landDepthKm(xKm, yKm, shore);
}
```

In `frontend/src/three/world/demoWorld.ts`, replace its own `landDepthKm` (lines 35-38) with a re-export so there is one definition:

```typescript
/** Signed distance inland from the shoreline, in km (negative = offshore).
 * Re-exported from the propagation mirror so the scene and the physics
 * cannot disagree about which side is land. */
export { landDepthKm } from "@/propagation/world";
```

Add `landDepthKm` to that file's existing import from `@/propagation/world` if `terrainHeightKm` needs it locally — it does, at line 73. The import line becomes:

```typescript
import { DEFAULT_SHORE, landDepthKm, shoreX, WORLD_KM, type ShoreParams } from "@/propagation/world";
```

and the local `landDepthKm` call inside `terrainHeightKm` is left as it is.

- [ ] **Step 5: Run the new test**

Run: `cd frontend && npm test -- --run src/propagation/orientation.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole frontend suite and the type-check**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: PASS with the Task 0 baseline count plus 7, and a clean build. Every construction of a `ShoreParams` object literal now needs `landSign`; the build will name each one. Fix them by adding `landSign: 1` **only** where the object is the fictional demo shore. Sites that build one from a `TownProfile` are handled in Task 5 — for now give them `landSign: 1` and leave a `// TODO(Task 5)` marker, which Task 5 removes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/propagation/world.ts frontend/src/propagation/structures.ts frontend/src/three/world/demoWorld.ts frontend/src/propagation/orientation.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): mirror the coastal orientation sign in the propagation port

Matches simulation/core/propagation.py: land tests run through a signed
landDepthKm, and three/world/demoWorld.ts re-exports it instead of keeping
a second unsigned copy that could drift.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The GLSL twin

**Files:**
- Modify: `frontend/src/three/world/demoWorld.ts:93-151` (`shoreUniformDefaults`, `DEMO_WORLD_GLSL`)
- Modify: `frontend/src/three/water/waterMaterial.ts:44-52`
- Modify: `frontend/src/three/terrain/terrainMaterial.ts:23-27`
- Test: `frontend/src/three/world/glslTwin.test.ts` (create)

**Interfaces:**
- Consumes: `ShoreParams.landSign` from Task 2.
- Produces: `shoreUniformDefaults(shore?)` returns an extra `uLandSign: number`; the GLSL chunk declares `uniform float uLandSign;` and uses it in `landDepthKm`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/three/world/glslTwin.test.ts`:

```typescript
/**
 * The GLSL twin is compiled by the GPU, not by Vitest, so what is testable
 * here is that the uniform contract is complete and consistent: every
 * uniform the shader source declares is produced by shoreUniformDefaults,
 * and the sign it carries matches the ShoreParams it came from.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, type ShoreParams } from "@/propagation/world";
import { DEMO_WORLD_GLSL, shoreUniformDefaults } from "./demoWorld";

const EAST_FACING: ShoreParams = {
  baseXKm: 300 - DEFAULT_SHORE.baseXKm,
  terms: DEFAULT_SHORE.terms.map((t) => ({ amp: -t.amp, freq: t.freq, phase: t.phase })),
  landSign: -1,
};

describe("GLSL shore uniforms", () => {
  it("declares uLandSign", () => {
    expect(DEMO_WORLD_GLSL).toContain("uniform float uLandSign;");
  });

  it("applies the sign inside landDepthKm", () => {
    expect(DEMO_WORLD_GLSL).toContain("return uLandSign * (xKm - shoreX(yKm));");
  });

  it("does not bake the shoreline into shader source", () => {
    // A curated city must switch by uniform, never by recompile (CLAUDE.md §27).
    expect(DEMO_WORLD_GLSL).not.toContain(String(DEFAULT_SHORE.baseXKm));
  });

  it("carries the sign through shoreUniformDefaults", () => {
    expect(shoreUniformDefaults().uLandSign).toBe(1);
    expect(shoreUniformDefaults(EAST_FACING).uLandSign).toBe(-1);
  });

  it("produces one uniform value per declared shore uniform", () => {
    const declared = [...DEMO_WORLD_GLSL.matchAll(/uniform \w+ (u\w+);/g)].map((m) => m[1]).filter((n) => n !== "uFlatTerrain");
    const produced = Object.keys(shoreUniformDefaults());
    expect(new Set(produced)).toEqual(new Set(declared));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/three/world/glslTwin.test.ts`
Expected: FAIL on the first assertion — the chunk has no `uLandSign` declaration.

- [ ] **Step 3: Extend `shoreUniformDefaults`**

In `frontend/src/three/world/demoWorld.ts`, replace the function at lines 93-101:

```typescript
export function shoreUniformDefaults(shore: ShoreParams = DEFAULT_SHORE): {
  uShoreBase: number;
  uShoreAmp: [number, number, number];
  uShoreFreq: [number, number, number];
  uShorePhase: [number, number, number];
  uLandSign: number;
} {
  const [t0, t1, t2] = shore.terms;
  return {
    uShoreBase: shore.baseXKm,
    uShoreAmp: [t0.amp, t1.amp, t2.amp],
    uShoreFreq: [t0.freq, t1.freq, t2.freq],
    uShorePhase: [t0.phase, t1.phase, t2.phase],
    uLandSign: shore.landSign,
  };
}
```

- [ ] **Step 4: Extend the GLSL chunk**

In the same file, add the declaration to the uniform block inside `DEMO_WORLD_GLSL` (after `uniform vec3 uShorePhase;`):

```glsl
  uniform float uLandSign;
```

and replace the GLSL `landDepthKm`:

```glsl
  float landDepthKm(float xKm, float yKm) { return uLandSign * (xKm - shoreX(yKm)); }
```

Nothing else in the chunk changes. `terrainHeightKm` already branches on `d = landDepthKm(...)`, and `three/shaders/water.ts` reaches land only through `landDepthKm` and `terrainHeightKm`, so both pick the sign up automatically.

- [ ] **Step 5: Declare the uniform in both materials**

In `frontend/src/three/water/waterMaterial.ts`, add to the uniform object beside the existing `uShore*` entries (around line 52):

```typescript
    uLandSign: SHORE_DEFAULTS.uLandSign,
```

In `frontend/src/three/terrain/terrainMaterial.ts`, add beside the others (around line 27):

```typescript
    shader.uniforms.uLandSign = { value: shoreUniforms.uLandSign };
```

- [ ] **Step 6: Pass the sign from `WaterSurface`**

`WaterSurface` sets each shore uniform as a prop. In `frontend/src/three/water/WaterSurface.tsx`, add to the `<waterMaterial>` element beside `uShorePhase` (around line 87):

```tsx
          uLandSign={shoreUniforms.uLandSign}
```

- [ ] **Step 7: Run the test and the build**

Run: `cd frontend && npm test -- --run src/three/world/glslTwin.test.ts && npm run build`
Expected: PASS, 5 tests, clean build.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/three/world/demoWorld.ts frontend/src/three/water/waterMaterial.ts frontend/src/three/water/WaterSurface.tsx frontend/src/three/terrain/terrainMaterial.ts frontend/src/three/world/glslTwin.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): add uLandSign to the shoreline GLSL twin

The water and terrain shaders reach land only through landDepthKm and
terrainHeightKm, so signing the former orients both. Kept a uniform rather
than a shader constant so switching cities never recompiles.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sign-aware frontend call sites

**Files:**
- Modify: `frontend/src/three/structures/support.ts:22-35` (`shoreTangent`, `shoreAlignedRotationY`)
- Modify: `frontend/src/three/structures/StructureModel.tsx:67`
- Modify: `frontend/src/three/markers/OriginPin.tsx:30`
- Modify: `frontend/src/three/urban/buildingPlacement.ts:83`
- Modify: `frontend/src/features/command-center/hooks/useScenarioSession.ts:45`
- Test: `frontend/src/three/structures/orientation.test.ts` (create)

**Interfaces:**
- Consumes: `landDepthKm`, `ShoreParams.landSign` from Task 2.
- Produces: no new exported names. `shoreAlignedRotationY(yKm, shore?)` keeps its signature; its result rotates by π when `shore.landSign` is −1.

These five sites assume "inland is +x". Each keeps its behaviour for `landSign: 1` and flips for −1.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/three/structures/orientation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, isLand, shoreX, type ShoreParams } from "@/propagation/world";
import { shoreAlignedRotationY } from "./support";

const EAST_FACING: ShoreParams = {
  baseXKm: 300 - DEFAULT_SHORE.baseXKm,
  terms: DEFAULT_SHORE.terms.map((t) => ({ amp: -t.amp, freq: t.freq, phase: t.phase })),
  landSign: -1,
};

const TWO_PI = Math.PI * 2;
const wrap = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

describe("shore-aligned rotation", () => {
  it("faces the opposite way on an east-facing coast", () => {
    for (const y of [40, 150, 260]) {
      const west = shoreAlignedRotationY(y);
      const east = shoreAlignedRotationY(y, EAST_FACING);
      expect(wrap(east - west)).toBeCloseTo(Math.PI, 6);
    }
  });
});

describe("origin clamp", () => {
  // Mirrors markers/OriginPin.tsx's rule: a dragged origin is pushed back to
  // the water side of the shoreline, whichever side that is.
  const SHORE_MARGIN_KM = 2;
  const clampToWater = (x: number, y: number, shore: ShoreParams) =>
    isLand(x, y, shore) ? shoreX(y, shore) - shore.landSign * SHORE_MARGIN_KM : x;

  it("pushes west on a west-facing coast", () => {
    const y = 150;
    const onLand = shoreX(y) + 5;
    const clamped = clampToWater(onLand, y, DEFAULT_SHORE);
    expect(clamped).toBeLessThan(shoreX(y));
    expect(isLand(clamped, y)).toBe(false);
  });

  it("pushes east on an east-facing coast", () => {
    const y = 150;
    const onLand = shoreX(y, EAST_FACING) - 5;
    const clamped = clampToWater(onLand, y, EAST_FACING);
    expect(clamped).toBeGreaterThan(shoreX(y, EAST_FACING));
    expect(isLand(clamped, y, EAST_FACING)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run src/three/structures/orientation.test.ts`
Expected: FAIL on "faces the opposite way" — `shoreAlignedRotationY` ignores the sign, so the difference is 0, not π.

- [ ] **Step 3: Sign the shore-aligned rotation**

In `frontend/src/three/structures/support.ts`, replace `shoreAlignedRotationY` (lines 30-35):

```typescript
/** Scene-space Y rotation that aligns a model's local +X with the shore
 * tangent (so quays run along the coast) and its local -Z toward the sea.
 * Which side the sea is on flips with the coast's orientation, so an
 * east-facing coast turns the model through half a revolution. */
export function shoreAlignedRotationY(yKm: number, shore: ShoreParams = DEFAULT_SHORE): number {
  const [tx, ty] = shoreTangent(yKm, shore);
  // km (tx, ty) -> scene (tx, -ty); angle of that vector from +x toward +z.
  const along = -Math.atan2(-ty, tx);
  return shore.landSign >= 0 ? along : along + Math.PI;
}
```

`shoreTangent` itself is unchanged — the tangent direction does not depend on which side is land.

- [ ] **Step 4: Sign the origin clamp**

In `frontend/src/three/markers/OriginPin.tsx`, line 30 currently reads:

```typescript
      if (isLand(x, y, shore)) x = Math.max(0.5, shoreX(y, shore) - SHORE_MARGIN_KM);
```

Replace it with a clamp that pushes to whichever side is water, and stays inside the world square:

```typescript
      // Push a dragged origin back onto the water — which side that is
      // depends on the coast's orientation.
      if (isLand(x, y, shore)) {
        const water = shoreX(y, shore) - shore.landSign * SHORE_MARGIN_KM;
        x = Math.min(WORLD_KM - 0.5, Math.max(0.5, water));
      }
```

`WORLD_KM` is already imported in that file.

- [ ] **Step 5: Sign the two structure-placement clamps**

`useScenarioSession.ts:43-48` drops a new structure on or just inland of the shoreline. It takes no `shore` at all, so it silently uses the fictional demo curve even for a real city — fix both problems together. Replace `defaultStructurePosition`:

```typescript
/** Default drop point for a new structure of `type`: on the shoreline
 * (port/lighthouse/terminal) or just inland (others), staggered by how many
 * already exist so they don't stack. "Inland" follows the coast's
 * orientation, so this works on either side of the shoreline. */
export function defaultStructurePosition(
  type: StructureType,
  existing: number,
  aroundYKm: number,
  shore: ShoreParams = DEFAULT_SHORE,
): [number, number] {
  const y = Math.max(5, Math.min(WORLD_KM - 5, aroundYKm + ((existing % 7) - 3) * 9));
  const shoreAtY = shoreX(y, shore);
  const coastal = type === "port" || type === "lighthouse" || type === "fuel_terminal";
  const inland = coastal ? 0.6 : 4 + Math.floor(existing / 7) * 6;
  const x = shoreAtY + shore.landSign * inland;
  return [Math.max(2, Math.min(WORLD_KM - 2, x)), y];
}
```

Then update its callers in the same file to pass the `shore` memo built at line 105. Find them with:

```bash
grep -rn "defaultStructurePosition" frontend/src
```

`StructureModel.tsx:64-71` clamps a dragged structure to the land side. Replace the `clamp` callback:

```typescript
  const clamp = useCallback(
    (xRaw: number, yRaw: number): [number, number] => {
      const y = Math.max(2, Math.min(WORLD_KM - 2, yRaw));
      const shoreAtY = shoreX(y, shoreParams);
      const sign = shoreParams.landSign;
      if (coastal) return [shoreAtY + sign * 0.6, y]; // snaps to the shoreline
      // Keep it at least 1.2 km inland, on whichever side inland is.
      const minInland = shoreAtY + sign * 1.2;
      const clamped = sign >= 0 ? Math.max(minInland, xRaw) : Math.min(minInland, xRaw);
      return [Math.max(2, Math.min(WORLD_KM - 2, clamped)), y];
    },
    [coastal, shoreParams],
  );
```

- [ ] **Step 6: Sign the procedural building field**

In `frontend/src/three/urban/buildingPlacement.ts`, line 83 marches inland from the shoreline:

```typescript
      const xKm = shoreX(yKm) + 1.4 + ix * SPACING_KM + jitterX;
```

This generator only ever runs for the fictional `dense_coastal` profile, whose sign is +1, but it must respect the parameter rather than the assumption. Give the function a `shore: ShoreParams = DEFAULT_SHORE` parameter and use:

```typescript
      const xKm = shoreX(yKm, shore) + shore.landSign * (1.4 + ix * SPACING_KM + jitterX);
```

Update `landDepthKm(xKm, yKm)` on line 86 to `landDepthKm(xKm, yKm, shore)`.

- [ ] **Step 7: Run the tests and the build**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: PASS. `buildingPlacement.test.ts` and `realTownPlacements.test.ts` must pass **unmodified** — they exercise the `landSign: 1` path, which is unchanged.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/three/structures/support.ts frontend/src/three/structures/StructureModel.tsx frontend/src/three/markers/OriginPin.tsx frontend/src/three/urban/buildingPlacement.ts frontend/src/features/command-center/hooks/useScenarioSession.ts frontend/src/three/structures/orientation.test.ts
git commit -m "$(cat <<'EOF'
feat(frontend): make shore-relative placement respect coastal orientation

Five sites assumed inland was +x: shore-aligned model facing, the structure
placement clamp, the dragged-origin clamp, the procedural building field and
the scenario origin clamp. Each now reads the sign rather than the axis.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Pin both orientations in the shared fixtures

**Files:**
- Modify: `scripts/generate_propagation_fixtures.py`
- Modify: `frontend/src/propagation/mirror.test.ts`
- Regenerate: `shared/fixtures/propagation_cases.json`

**Interfaces:**
- Consumes: Task 1's `ShoreParams(land_sign=...)`, Task 2's `ShoreParams.landSign`.
- Produces: every fixture case gains a `shore` object `{base_x_km, terms: [{amp, freq, phase} x3], land_sign}`; the mirror test builds a `ShoreParams` from it and passes it to every call.

This task pins both signs across the language boundary **before** any real data changes, so Task 6 has a working tripwire.

- [ ] **Step 1: Add an east-facing shore to the generator**

In `scripts/generate_propagation_fixtures.py`, after the `MODELS` constant, add:

```python
from simulation.core.propagation import DEFAULT_SHORE, ShoreParams  # noqa: E402

# A synthetic east-facing coast: the demo shoreline reflected about x = 150,
# with land to the west. Fixture geometry only — not a place.
EAST_FACING_SHORE = ShoreParams(
    base_x_km=300.0 - DEFAULT_SHORE.base_x_km,
    terms=tuple((-amp, freq, phase) for amp, freq, phase in DEFAULT_SHORE.terms),
    land_sign=-1.0,
)
SHORES = [("west", DEFAULT_SHORE), ("east", EAST_FACING_SHORE)]


def shore_to_json(shore: ShoreParams) -> dict:
    return {
        "base_x_km": shore.base_x_km,
        "terms": [{"amp": a, "freq": f, "phase": p} for a, f, p in shore.terms],
        "land_sign": shore.land_sign,
    }
```

Merge the import into the existing `from simulation.core.propagation import (...)` block rather than adding a second one.

- [ ] **Step 2: Mirror the coast cases for the east-facing shore**

`COAST_CASES` and `PARAM_SETS` are written for a west-facing coast. Reflect them rather than inventing new numbers, so both orientations exercise identical geometry:

```python
def reflect_case(x: float, y: float, heading: float) -> tuple[float, float, float]:
    """Mirror a west-facing case about x = 150. A heading reflects as
    (360 - heading) % 360, because reflection negates the east component."""
    return 300.0 - x, y, (360.0 - heading) % 360.0


def reflect_params(raw: dict) -> dict:
    out = dict(raw)
    out["origin_x_km"] = 300.0 - raw["origin_x_km"]
    out["heading_deg"] = (360.0 - raw["heading_deg"]) % 360.0
    return out


def reflect_structures(structures: list[dict]) -> list[dict]:
    return [{**s, "x_km": 300.0 - s["x_km"]} for s in structures]
```

- [ ] **Step 3: Emit a `shore` alongside every case**

Rewrite `main()` so each case carries the shore it was computed with. The whole function:

```python
def main() -> None:
    cases: dict = {"shore_x": [], "distance_to_coast": [], "nearest_shore": [], "front_state": [], "models": []}

    for label, shore in SHORES:
        sj = shore_to_json(shore)
        coast_cases = COAST_CASES if label == "west" else [reflect_case(*c) for c in COAST_CASES]
        param_sets = PARAM_SETS if label == "west" else [reflect_params(p) for p in PARAM_SETS]
        structures = STRUCTURES if label == "west" else reflect_structures(STRUCTURES)

        cases["shore_x"] += [{"shore": sj, "y": y, "x": shore_x(y, shore)} for y in SHORE_SAMPLES]
        cases["distance_to_coast"] += [
            {"shore": sj, "x": x, "y": y, "heading": h, "distance": distance_to_coast_along_heading(x, y, h, shore)}
            for x, y, h in coast_cases
        ]
        cases["nearest_shore"] += [
            {"shore": sj, "x": x, "y": y, "distance": nearest_shore_distance(x, y, shore)} for x, y, _ in coast_cases
        ]

        for raw in param_sets:
            params = PropagationParams.from_config(raw, default_speed_kmh=1, default_spread_radius_km=1)
            params = replace(params, shore=shore)
            for stop in (True, False):
                for t in TIMES_MIN:
                    fs = front_state(params, t, stop_at_coast=stop)
                    cases["front_state"].append(
                        {
                            "shore": sj,
                            "params": raw,
                            "stop_at_coast": stop,
                            "elapsed_minutes": t,
                            "result": {
                                "traveled_km": fs.traveled_km,
                                "position_x_km": fs.position_x_km,
                                "position_y_km": fs.position_y_km,
                                "coast_distance_total_km": fs.coast_distance_total_km,
                                "distance_to_coast_km": fs.distance_to_coast_km,
                                "arrival_progress": fs.arrival_progress,
                                "arrived": fs.arrived,
                                "eta_minutes": fs.eta_minutes,
                                "minutes_since_arrival": fs.minutes_since_arrival,
                            },
                        }
                    )

        clock = SimulationClock(
            start_time=datetime(2026, 1, 1, tzinfo=timezone.utc), duration_minutes=360, timestep_minutes=5
        )
        for disaster_type in MODELS:
            model_cls = get_model_class(disaster_type)
            for raw in param_sets:
                config = {**raw, "structures": structures}
                model = model_cls(config=config, clock=clock, location=None, rng=Random(0))
                model.initialize()  # sets self.params; the override must follow it
                model.params = replace(model.params, shore=shore)
                frames = []
                for t in TIMES_MIN:
                    step = t // 5
                    _, hazard, _ = model.get_state(step)
                    impacts = model.get_infrastructure_impacts(step)
                    frames.append({"elapsed_minutes": t, "hazard_state": hazard, "infrastructure_impacts": impacts})
                cases["models"].append(
                    {"shore": sj, "disaster_type": disaster_type, "params": raw, "structures": structures, "frames": frames}
                )

    out = REPO_ROOT / "shared" / "fixtures" / "propagation_cases.json"
    out.write_text(json.dumps(cases, indent=1) + "\n")
    print(f"wrote {out} ({len(cases['front_state'])} front cases, {len(cases['models'])} model cases)")
```

Add `from dataclasses import replace  # noqa: E402` to the imports.

Note the ordering: each model assigns `self.params = PropagationParams.from_config(...)` inside `initialize()`, not `__init__`, so the override must come **after** `model.initialize()`, exactly as written above. `PropagationParams` is a frozen dataclass, so `replace()` is the way to change one field; `self.params` is a plain attribute, so the assignment sticks. Production never does this — it resolves the shore from `city_id` — and this is fixture-generation code reaching for a synthetic shore that has no city file. Say so in the generator's docstring.

- [ ] **Step 4: Regenerate and inspect**

```bash
.venv/bin/python scripts/generate_propagation_fixtures.py
git diff --stat shared/fixtures/propagation_cases.json
```

Expected: the case counts roughly double. Confirm the previously existing west-facing entries are unchanged apart from gaining a `"shore"` key — if a west-facing number moved, Task 1 was not bit-identical.

- [ ] **Step 5: Make the mirror test read the shore**

In `frontend/src/propagation/mirror.test.ts`, add a helper below the imports:

```typescript
import type { ShoreParams } from "./world";

interface FixtureShore {
  base_x_km: number;
  terms: { amp: number; freq: number; phase: number }[];
  land_sign: number;
}

const shoreOf = (c: { shore: FixtureShore }): ShoreParams => ({
  baseXKm: c.shore.base_x_km,
  terms: c.shore.terms,
  landSign: c.shore.land_sign,
});
```

Then thread it through every call in the file:

```typescript
  it("shore_x matches", () => {
    for (const c of cases.shore_x) expect(shoreX(c.y, shoreOf(c))).toBeCloseTo(c.x, 6);
  });

  it("distance_to_coast matches", () => {
    for (const c of cases.distance_to_coast) {
      const d = distanceToCoastAlongHeading(c.x, c.y, c.heading, shoreOf(c));
      if (c.distance === null) expect(d).toBeNull();
      else expect(d).toBeCloseTo(c.distance, 4);
    }
  });

  it("nearest_shore matches", () => {
    for (const c of cases.nearest_shore) expect(nearestShoreDistance(c.x, c.y, shoreOf(c))).toBeCloseTo(c.distance, 4);
  });
```

In `front_state matches`, pass the shore as `frontState`'s fourth argument: `frontState(params, c.elapsed_minutes, c.stop_at_coast, shoreOf(c))`.

In `model hazard formulas match` and `recorded-frame replay`, pass it as `computeHazard`'s fourth argument: `computeHazard(kind, params, f.elapsed_minutes, shoreOf(m))`.

In `structure exposure mirror`, pass it to both: `computeHazard(kind, params, f.elapsed_minutes, shoreOf(m))` and `assessStructures(m.structures as never, geometryFromSnapshot(snap), shoreOf(m))`.

- [ ] **Step 6: Run the mirror test**

Run: `cd frontend && npm test -- --run src/propagation`
Expected: PASS, with roughly double the previous case count exercised. A failure here means the Python and TypeScript signs disagree — fix the mirror, not the fixture.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate_propagation_fixtures.py frontend/src/propagation/mirror.test.ts shared/fixtures/propagation_cases.json
git commit -m "$(cat <<'EOF'
test(simulation,frontend): pin both coastal orientations in the shared fixtures

Every case now carries the ShoreParams it was computed with, and the set is
generated twice: the existing west-facing geometry, and its reflection with
land_sign = -1. The mirror test replays both, so an east-facing coast cannot
drift between Python and TypeScript.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `ocean_side` on the town profile

**Files:**
- Modify: `shared/types/index.ts:605-623` (`TownProfile`)
- Modify: `simulation/core/propagation.py:75-91` (`shore_params_for_city`)
- Modify: `frontend/src/three/core/SceneRoot.tsx:76-79`
- Modify: `frontend/src/features/command-center/components/TelemetryPanel.tsx:51`
- Modify: `frontend/src/features/command-center/hooks/useScenarioSession.ts:105`
- Modify: `scripts/build_town_data.py:103-112` (`to_local_km`), and the emitted JSON dict
- Test: `simulation/tests/test_real_city_shore.py` (extend)

**Interfaces:**
- Consumes: `ShoreParams(land_sign=...)` / `ShoreParams.landSign`.
- Produces:
  - `TownProfile.ocean_side: "east" | "west"`
  - `shore_params_for_city(city_id)` maps `ocean_side` `"west"` to `land_sign = +1.0` and `"east"` to `-1.0`, and raises `SimulationConfigError` when the field is absent.
  - A shared helper on the frontend, `shoreParamsForTown(town: TownProfile): ShoreParams`, exported from `frontend/src/propagation/world.ts`, replacing the three hand-built object literals.

This task changes the **contract**. The Chennai data itself is still mirrored at the end of it, so add `"ocean_side": "west"` to `chennai.json` here — which is what the mirrored data honestly is — and let Task 7 flip both the geometry and the field together. Nothing renders differently after this task.

- [ ] **Step 1: Write the failing test**

Add to `simulation/tests/test_real_city_shore.py`:

```python
import json
import pytest
from simulation.core.errors import SimulationConfigError
from simulation.core.propagation import _TOWNS_DIR, shore_params_for_city


def _town_ids() -> list[str]:
    return sorted(p.stem for p in _TOWNS_DIR.glob("*.json"))


@pytest.mark.parametrize("city_id", _town_ids())
def test_town_declares_an_ocean_side(city_id: str) -> None:
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    assert data["ocean_side"] in ("east", "west")


@pytest.mark.parametrize("city_id", _town_ids())
def test_shore_params_carry_the_orientation(city_id: str) -> None:
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    shore = shore_params_for_city(city_id)
    assert shore.land_sign == (1.0 if data["ocean_side"] == "west" else -1.0)


def test_missing_ocean_side_is_a_config_error(tmp_path, monkeypatch) -> None:
    bad = tmp_path / "nowhere.json"
    bad.write_text(json.dumps({"shore_base_x_km": 150.0, "shore_terms": []}), encoding="utf-8")
    monkeypatch.setattr("simulation.core.propagation._TOWNS_DIR", tmp_path)
    with pytest.raises(SimulationConfigError):
        shore_params_for_city("nowhere")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m pytest simulation/tests/test_real_city_shore.py -q`
Expected: FAIL — `chennai.json` has no `ocean_side` key, and the loader does not raise for a missing one.

- [ ] **Step 3: Read `ocean_side` in the loader**

In `simulation/core/propagation.py`, replace the body of `shore_params_for_city` after the JSON parse (lines 87-91):

```python
    try:
        terms = tuple((t["amp"], t["freq"], t["phase"]) for t in data["shore_terms"])
        ocean_side = data["ocean_side"]
    except (KeyError, TypeError) as exc:
        raise SimulationConfigError(
            f"Town data at {path} is missing shore_base_x_km/shore_terms/ocean_side: {exc}"
        ) from exc
    if ocean_side not in ("east", "west"):
        raise SimulationConfigError(f"Town data at {path} has ocean_side={ocean_side!r}; expected 'east' or 'west'.")
    # Ocean west means land lies east of the curve, and vice versa.
    return ShoreParams(base_x_km=data["shore_base_x_km"], terms=terms, land_sign=1.0 if ocean_side == "west" else -1.0)
```

Note `data["shore_base_x_km"]` must be inside the guarded block or read before it; keep it in the `try` so a missing key raises the config error rather than a `KeyError`.

- [ ] **Step 4: Add the field to the committed data and the type**

In `shared/constants/towns/chennai.json`, add `"ocean_side": "west"` beside `"shore_base_x_km"`. This is truthful about the currently mirrored data; Task 7 changes it to `"east"` together with the geometry.

In `shared/types/index.ts`, add to `TownProfile` after `shore_terms`:

```typescript
  /** Which real compass side the ocean lies on. Sets the shoreline's
   * orientation: "west" means land is east of the curve (land_sign +1),
   * "east" the reverse. */
  ocean_side: "east" | "west";
```

- [ ] **Step 5: Add one frontend helper and use it everywhere**

Three files build a `ShoreParams` from a `TownProfile` by hand. Replace all three with one helper. In `frontend/src/propagation/world.ts`, add:

```typescript
import type { TownProfile } from "@shared/types";

/** The `ShoreParams` for a curated real city (architecture.md ADR-009).
 * The single place a TownProfile becomes a shoreline, so the orientation
 * cannot be dropped at one call site and kept at another. */
export function shoreParamsForTown(town: TownProfile): ShoreParams {
  return {
    baseXKm: town.shore_base_x_km,
    terms: town.shore_terms,
    landSign: town.ocean_side === "west" ? 1 : -1,
  };
}
```

In `frontend/src/three/core/SceneRoot.tsx`, replace the `useMemo` at lines 76-79:

```typescript
  const shore: ShoreParams = useMemo(
    () => (worldProfile === "real_city" && town ? shoreParamsForTown(town) : DEFAULT_SHORE),
    [worldProfile, town],
  );
```

In `frontend/src/features/command-center/components/TelemetryPanel.tsx` line 51 and `frontend/src/features/command-center/hooks/useScenarioSession.ts` line 105, replace each hand-built literal with:

```typescript
  const shore: ShoreParams = useMemo(() => (town ? shoreParamsForTown(town) : DEFAULT_SHORE), [town]);
```

Import `shoreParamsForTown` from `@/propagation/world` in each. Remove the `// TODO(Task 5)` markers left in Task 2 — they should all be at these three sites.

- [ ] **Step 6: Stop mirroring in the builder and emit the field**

In `scripts/build_town_data.py`, delete the mirror from `to_local_km` (lines 110-111) and update its docstring:

```python
def to_local_km(lat: float, lon: float, city: CityDef) -> tuple[float, float]:
    """Real lat/lon to the synthetic km frame, city centre at (150, 150).
    The cross-shore axis is NOT mirrored: orientation is carried by the
    emitted `ocean_side` field and applied as ShoreParams.land_sign, so an
    east-facing city keeps its real chirality."""
    dx_km = (lon - city.center_lon) * km_per_deg_lon(city.center_lat)
    dy_km = (lat - city.center_lat) * KM_PER_DEG_LAT
    return dx_km + WORLD_KM / 2, dy_km + WORLD_KM / 2
```

In the emitted dict (around line 271), add beside `shore_base_x_km`:

```python
        "ocean_side": city.ocean_side,
```

- [ ] **Step 7: Run the tests and the build**

Run: `.venv/bin/python -m pytest simulation/tests -q && cd frontend && npm test -- --run && npm run build`
Expected: PASS everywhere. Chennai still renders exactly as before — the data is still mirrored and now honestly labelled `"west"`.

- [ ] **Step 8: Commit**

```bash
git add shared/types/index.ts shared/constants/towns/chennai.json simulation/core/propagation.py simulation/tests/test_real_city_shore.py scripts/build_town_data.py frontend/src/propagation/world.ts frontend/src/three/core/SceneRoot.tsx frontend/src/features/command-center/components/TelemetryPanel.tsx frontend/src/features/command-center/hooks/useScenarioSession.ts
git commit -m "$(cat <<'EOF'
feat(shared,simulation,frontend): declare a town's ocean side

A town profile now states which compass side its ocean is on, and that
becomes ShoreParams.land_sign on both sides of the port. The data-prep
script stops mirroring the cross-shore axis; one helper replaces the three
hand-built ShoreParams literals so orientation cannot be dropped at one
call site.

Chennai is still labelled "west" here because its committed geometry is
still mirrored; the next commit flips both together.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Flip Chennai to its real orientation

**Files:**
- Create: `scripts/migrate_town_orientation.py`
- Modify: `shared/constants/towns/chennai.json` (regenerated by the script)
- Test: `simulation/tests/test_real_city_shore.py` (extend)

**Interfaces:**
- Consumes: `shore_params_for_city` from Task 6, `is_land`/`land_depth_km` from Task 1.
- Produces: no new code interfaces. `chennai.json` gains `ocean_side: "east"`, its `shore_base_x_km` becomes `136.094`, its shore-term amplitudes are negated, and every building's `xKm` is reflected about 150.

This is the task that changes what the user sees. It is last so that every consumer is already sign-aware.

- [ ] **Step 1: Write the failing regression test**

Add to `simulation/tests/test_real_city_shore.py`:

```python
from simulation.core.propagation import (
    DEFAULT_ORIGIN_X_KM,
    DEFAULT_ORIGIN_Y_KM,
    distance_to_coast_along_heading,
    is_land,
    land_depth_km,
)


@pytest.mark.parametrize("city_id", _town_ids())
def test_every_building_is_on_land(city_id: str) -> None:
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    shore = shore_params_for_city(city_id)
    offshore = [b for b in data["buildings"] if not is_land(b["xKm"], b["yKm"], shore)]
    assert offshore == [], f"{len(offshore)} of {len(data['buildings'])} buildings are offshore"


@pytest.mark.parametrize("city_id", _town_ids())
def test_town_default_heading_reaches_land(city_id: str) -> None:
    """Regression: Chennai's own heading_deg (270) was the real compass
    bearing while its geometry was mirrored, so a scenario launched with the
    town default sent the front out of the world and never made landfall."""
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    shore = shore_params_for_city(city_id)
    distance = distance_to_coast_along_heading(
        DEFAULT_ORIGIN_X_KM if shore.land_sign > 0 else 300.0 - DEFAULT_ORIGIN_X_KM,
        DEFAULT_ORIGIN_Y_KM,
        data["heading_deg"],
        shore,
    )
    assert distance is not None, f"{city_id}: heading {data['heading_deg']} never reaches land"
    assert distance > 0


@pytest.mark.parametrize("city_id", _town_ids())
def test_buildings_sit_within_a_plausible_inland_band(city_id: str) -> None:
    """A sanity bound on the reflection: a coastal city's footprints are
    inland, but not hundreds of km inland."""
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    shore = shore_params_for_city(city_id)
    depths = [land_depth_km(b["xKm"], b["yKm"], shore) for b in data["buildings"]]
    assert max(depths) < 60.0
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m pytest simulation/tests/test_real_city_shore.py -q`
Expected: `test_town_default_heading_reaches_land` FAILS with "chennai: heading 270.0 never reaches land" — the bug from the spec, now caught. The other two pass, because the mirrored data is self-consistent.

- [ ] **Step 3: Write the migration script**

Create `scripts/migrate_town_orientation.py`:

```python
"""One-shot migration of already-fetched town data to the ocean_side
convention (architecture.md ADR-009).

This is NOT a data source. scripts/build_town_data.py is, and it now emits
the unmirrored orientation directly. This script exists because rebuilding
requires Natural Earth and the Overpass API, and the transform is exactly
algebraic: reflecting a mirrored east-facing city about x = 150 and setting
land_sign = -1 reproduces, to floating-point precision, what the builder
would fetch. Re-running the builder with network access must produce the
same file.

    .venv/bin/python scripts/migrate_town_orientation.py chennai
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TOWNS_DIR = REPO_ROOT / "shared" / "constants" / "towns"
WORLD_KM = 300.0

# Cities whose committed data was produced under the old mirror and whose
# real ocean side is east. Keep in step with CITIES in build_town_data.py.
EAST_FACING = {"chennai", "puri", "visakhapatnam"}


def reflect(city_id: str) -> None:
    path = TOWNS_DIR / f"{city_id}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("ocean_side") == "east":
        print(f"{city_id}: already east-facing, nothing to do")
        return

    data["shore_base_x_km"] = round(WORLD_KM - data["shore_base_x_km"], 3)
    data["shore_terms"] = [{**t, "amp": round(-t["amp"], 4)} for t in data["shore_terms"]]
    data["buildings"] = [
        {**b, "xKm": round(WORLD_KM - b["xKm"], 3), "rotY": round((math.pi - b["rotY"]) % (2 * math.pi), 4)}
        for b in data["buildings"]
    ]
    data["ocean_side"] = "east"
    data["data_provenance"]["migrated_by"] = "scripts/migrate_town_orientation.py"
    data["data_provenance"]["migration_note"] = (
        "Cross-shore axis un-mirrored to the ocean_side convention; geometry is "
        "the same fetched data reflected about x=150, not a re-fetch."
    )

    path.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    print(f"{city_id}: reflected {len(data['buildings'])} buildings, base -> {data['shore_base_x_km']}")


def main() -> None:
    ids = sys.argv[1:] or sorted(EAST_FACING)
    for city_id in ids:
        if city_id not in EAST_FACING:
            print(f"{city_id} is not an east-facing city; nothing to migrate.", file=sys.stderr)
            continue
        if not (TOWNS_DIR / f"{city_id}.json").exists():
            print(f"No committed data for {city_id}; skipping.", file=sys.stderr)
            continue
        reflect(city_id)


if __name__ == "__main__":
    main()
```

Match the existing file's JSON formatting: check whether `chennai.json` was written with `indent=1` and a trailing newline (that is what `build_town_data.py` uses) and keep the diff to real content changes only.

- [ ] **Step 4: Run the migration**

```bash
.venv/bin/python scripts/migrate_town_orientation.py chennai
git diff --stat shared/constants/towns/chennai.json
```

Expected: `ocean_side` becomes `"east"`, `shore_base_x_km` becomes `136.094`, the three term amplitudes flip sign, and 1535 building x/rotation pairs change. No change to `label`, `heading_deg`, `cls`, `scale`, `type`, `fit_quality`, or the original provenance fields.

- [ ] **Step 5: Run the regression tests**

Run: `.venv/bin/python -m pytest simulation/tests/test_real_city_shore.py -q`
Expected: PASS, all four parametrized tests. In particular `test_town_default_heading_reaches_land` now returns a finite distance for heading 270.

- [ ] **Step 6: Verify the fix by hand**

```bash
.venv/bin/python -c "
from simulation.core.propagation import *
s = shore_params_for_city('chennai')
print('land_sign', s.land_sign)
print('shore_x(150) = %.2f' % shore_x(150, s))
print('dist along 270 from (230,150):', distance_to_coast_along_heading(230, 150, 270.0, s))
p = PropagationParams.from_config({'city_id':'chennai','origin_x_km':230,'heading_deg':270.0}, default_speed_kmh=500, default_spread_radius_km=12)
fs = front_state(p, 60.0, stop_at_coast=True)
print('arrived', fs.arrived, 'total', fs.coast_distance_total_km, 'pos %.1f' % fs.position_x_km)
"
```

Expected: `land_sign -1.0`, a finite distance along heading 270, and `arrived True` with the position at the shoreline rather than `-380.0`.

- [ ] **Step 7: Run everything**

Run: `.venv/bin/python -m pytest simulation/tests -q && cd frontend && npm test -- --run && npm run build`
Expected: PASS. `realTownPlacements.test.ts` exercises the town path and must pass with the reflected data; if it hard-codes a coordinate from the old mirrored file, update that expectation and say so in the commit body.

- [ ] **Step 8: Check the scene by hand**

Run the app and open a Chennai `real_city` scenario. Confirm: the Bay of Bengal is drawn east of the city, the hazard front advances east to west, the shoreline has no gap or z-fighting against the water, and buildings tint clear → amber → red as the front crosses them. A blank or inverted scene means a uniform is not reaching the shader — check `uLandSign` in both materials before changing anything else.

- [ ] **Step 9: Commit**

```bash
git add scripts/migrate_town_orientation.py shared/constants/towns/chennai.json simulation/tests/test_real_city_shore.py
git commit -m "$(cat <<'EOF'
fix(simulation,shared): render Chennai on its real side of the coast

The committed geometry was mirrored about x=150 so that the engine's
"land is east" rule would hold, which drew the city reversed and left
TownProfile.heading_deg inconsistent with it: a scenario launched with the
town's own default heading of 270 never reached land, so nothing ever made
landfall, no structure was exposed and no building tinted.

Reflect the data back to its real chirality and mark it ocean_side "east",
which the engine now reads as land_sign -1. Adds the regression: every
town's default heading must reach land.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Documentation

**Files:**
- Modify: `architecture.md` (ADR-009, §28c)
- Modify: `CHANGELOG.md`
- Modify: `docs/development/simulation.md`
- Modify: `CLAUDE.md` §26 (the propagation-field checklist)

- [ ] **Step 1: Extend ADR-009 and §28c in `architecture.md`**

Add to ADR-009 a paragraph recording the decision: coastal orientation is a property of the world model (`ShoreParams.land_sign`), not of data preparation; the previous approach mirrored the cross-shore axis in `build_town_data.py`, which rendered east-facing cities reversed and desynchronised `TownProfile.heading_deg` from the geometry. Note that `ocean_side` is required in every town file and that a missing value is a config error.

In §28c, document the convention in one line: `land_sign` is +1 when land lies east of the shoreline curve and −1 when it lies west, and it is the only difference between the two orientations.

- [ ] **Step 2: Add the CHANGELOG entry**

Add at the top of `CHANGELOG.md`, in the §19 format:

```markdown
### 2026-09-14 — Coastal orientation as a world-model property

**Added/Changed:**
- `ShoreParams` carries `land_sign` (+1 land east, −1 land west) on both the Python engine and its TypeScript mirror; every land test routes through a signed `land_depth_km`.
- The shoreline GLSL twin gained a `uLandSign` uniform, so a city's orientation switches without a shader recompile.
- `TownProfile` requires `ocean_side`; `scripts/build_town_data.py` no longer mirrors the cross-shore axis.
- Chennai's committed geometry was reflected back to its real chirality (`scripts/migrate_town_orientation.py`).
- Shared propagation fixtures are generated for both orientations, so `mirror.test.ts` pins each.

**Why:**
- East-facing (Bay of Bengal) cities were rendered as mirror images, and their real `heading_deg` did not match the mirrored geometry — a Chennai scenario using the town default heading never made landfall, so no exposure or building tinting ever occurred.

**Files/Modules:**
- `simulation/core/propagation.py`, `simulation/core/structures.py`
- `frontend/src/propagation/{world,structures}.ts`, `frontend/src/three/world/demoWorld.ts`
- `frontend/src/three/{water,terrain}/*Material.ts`, `frontend/src/three/structures/support.ts`, `frontend/src/three/markers/OriginPin.tsx`, `frontend/src/three/urban/buildingPlacement.ts`
- `shared/types/index.ts`, `shared/constants/towns/chennai.json`, `shared/fixtures/propagation_cases.json`
- `scripts/{build_town_data,migrate_town_orientation,generate_propagation_fixtures}.py`

**Future Context:**
- The four remaining ADR-009 cities stay commented out pending fit-quality validation, but the east-facing blocker is gone: Puri and Visakhapatnam need only `ocean_side: "east"` in their generated data.
- Flat-canvas grid ticks, per-type building geometry and the town-bounds camera fit are deliberately not in this change — see `docs/superpowers/specs/2026-09-14-coastline-orientation-design.md` §9–11.
```

- [ ] **Step 3: Document the convention for contributors**

In `docs/development/simulation.md`, document `ShoreParams.land_sign`, the rule that a town file must declare `ocean_side`, and that `scripts/migrate_town_orientation.py` is a one-shot migration of already-fetched data rather than a data source.

In `CLAUDE.md` §26, the checklist for adding a common propagation field lists the files to update in step. Add the GLSL twin and the shore uniform helpers to that list, since this change proved they belong there:

> Adding a common propagation field: update `PropagationConfig` (`backend/app/schemas/scenario_config.py`), `simulation/core/propagation.py`, `frontend/src/propagation/kinematics.ts`, and regenerate the fixtures. A field that affects world geometry also needs the GLSL twin in `frontend/src/three/world/demoWorld.ts`, `shoreUniformDefaults()`, and the uniform blocks in `waterMaterial.ts` and `terrainMaterial.ts`.

- [ ] **Step 4: Commit**

```bash
git add architecture.md CHANGELOG.md docs/development/simulation.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: record coastal orientation as a world-model property

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Final verification

**Files:** none

- [ ] **Step 1: Run the full suite**

```bash
.venv/bin/python -m pytest simulation/tests -q
.venv/bin/python -m pytest backend/tests -q
cd frontend && npm test -- --run && npm run build && cd ..
```

Expected: all green. `backend/tests/db/*` skipping without a PostgreSQL instance is normal — do not "fix" a skip by swapping in SQLite.

- [ ] **Step 2: Confirm the fixture regeneration is idempotent**

```bash
.venv/bin/python scripts/generate_propagation_fixtures.py
git diff --stat shared/fixtures/propagation_cases.json
```

Expected: no diff. A diff here means the generator is not deterministic, which breaks the §26 determinism requirement.

- [ ] **Step 3: Confirm the migration is idempotent**

```bash
.venv/bin/python scripts/migrate_town_orientation.py chennai
git diff --stat shared/constants/towns/chennai.json
```

Expected: `chennai: already east-facing, nothing to do`, and no diff.

- [ ] **Step 4: Review the whole branch**

```bash
git diff develop...HEAD --stat
git log --oneline develop..HEAD
```

Expected: changes confined to `simulation/`, `shared/`, `frontend/src/`, `scripts/` and docs. No `.env`, no credentials, no bulk data beyond the two regenerated JSON files. No new component files under `frontend/src/three/` — this branch extends existing ones.

- [ ] **Step 5: Hand back**

Report: the tests that ran and their counts, the manual scene check from Task 7 Step 8, and the before/after of the Chennai heading probe. Do not merge to `develop` without the user's say-so.
