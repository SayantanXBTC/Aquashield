/**
 * Demo shoreline world <-> scene-space mapping, plus the GLSL twin of the
 * shoreline/terrain functions so the water shader and the terrain mesh agree
 * on exactly where land begins.
 *
 * VISUAL DEMONSTRATION — the world is the synthetic 300 km square defined
 * in shared/constants/demo_world.json (Python: simulation/core/propagation.py,
 * TS: src/propagation/world.ts). Scene units are kilometres, recentred so the
 * world's middle is the scene origin: sceneX = xKm - 150, sceneZ = -(yKm -
 * 150) (+z is south). Nothing here is GIS data or real terrain.
 */
import { DEFAULT_SHORE, LAND_FIELD_BLEND_KM, landDepthKm, WORLD_KM, type ShoreParams } from "@/propagation/world";

export const SCENE_UNITS_PER_KM = 1;
export const WORLD_SCENE_SIZE = WORLD_KM * SCENE_UNITS_PER_KM;
/** The water and terrain meshes extend 3x past the 300 km world so the
 * horizon fade (not a hard plate edge) is what the eye meets. The shoreline
 * and height functions are analytic and simply continue outside the world;
 * only the origin pin is clamped to the 300 km square. */
export const SCENE_MESH_SIZE = WORLD_SCENE_SIZE * 3;
const HALF = WORLD_KM / 2;

export function kmToScene(xKm: number, yKm: number): [number, number] {
  return [(xKm - HALF) * SCENE_UNITS_PER_KM, -(yKm - HALF) * SCENE_UNITS_PER_KM];
}

export function sceneToKm(sceneX: number, sceneZ: number): [number, number] {
  return [sceneX / SCENE_UNITS_PER_KM + HALF, -sceneZ / SCENE_UNITS_PER_KM + HALF];
}

export function kmToSceneUnits(km: number): number {
  return km * SCENE_UNITS_PER_KM;
}

/** Signed distance inland from the shoreline, in km (negative = offshore).
 * Re-exported from the propagation mirror so the scene and the physics
 * cannot disagree about which side is land. */
export { landDepthKm } from "@/propagation/world";

// --- Terrain height (JS + GLSL twins) --------------------------------------
//
// The land plate rises from a beach at the shoreline to gentle hills; the
// sea floor drops away offshore. Both the CPU terrain mesh and the GPU water
// shader evaluate the same function, which is what makes the shoreline
// watertight: water is discarded wherever this says "land above sea level",
// and (for a flood) lifted onto exactly this surface where inundated.

// Domain-warped sine relief — organic ridges rather than an egg-carton
// grid, still purely analytic so the GLSL twin below matches exactly.
function vnoise(x: number, y: number): number {
  return (
    2.2 * Math.sin(0.021 * x + 0.9 * Math.sin(0.017 * y)) +
    1.7 * Math.cos(0.031 * y + 0.8 * Math.sin(0.023 * x)) +
    1.1 * Math.sin(0.057 * x - 0.049 * y + 1.3) +
    0.6 * Math.cos(0.093 * x + 0.071 * y) +
    0.3 * Math.sin(0.19 * x - 0.17 * y)
  );
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Terrain height (scene units) at world km coordinates. `flat` is the
 * Dense Coastal Profile / real-city rendering choice (CLAUDE.md §27/ADR-009)
 * — the sea-floor branch never changes; only the land-side elevation
 * flattens. `shore` is the fictional demo curve by default, or a curated
 * real city's fitted curve — the shoreline BOUNDARY this determines is what
 * hazard physics and exposure key off, so it must match whatever the
 * scenario is actually using. */
export function terrainHeightKm(xKm: number, yKm: number, flat = false, shore: ShoreParams = DEFAULT_SHORE): number {
  const d = landDepthKm(xKm, yKm, shore);
  if (d < 0) {
    // Sea floor: a shelf that shelves down over ~40 km, noise-broken.
    const n = vnoise(xKm, yKm);
    return -0.8 - 6.0 * smoothstep(0, 40, -d) + n * 0.12 * smoothstep(0, 10, -d);
  }
  if (flat) return 0.05;
  const n = vnoise(xKm, yKm);
  const beach = 0.35 + 1.4 * smoothstep(0, 5, d);
  const hills = (n * 0.75 + 2.6) * smoothstep(3, 28, d);
  const ridge = 4.5 * smoothstep(40, 120, d) * (0.6 + 0.4 * Math.sin(yKm * 0.05 + n * 0.1));
  return beach + hills + ridge;
}

const f = (v: number) => v.toFixed(6);

/** Default GLSL shore uniform values — the fictional demo curve. A curated
 * real city (ADR-009) overrides these per-material at scenario load; the
 * shoreline shape is a runtime uniform, never baked into shader source, so
 * switching cities never requires a shader recompile. */
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

/** GLSL chunk: `shoreX(yKm)`, `landDepthKm(xKm, yKm)`, `terrainHeightKm(xKm,
 * yKm)`, and `sceneToKm(vec2)`. The shoreline shape comes from uniforms
 * (`uShoreBase`/`uShoreAmp`/`uShoreFreq`/`uShorePhase`) — see
 * `shoreUniformDefaults()` for how a consuming material initializes them.
 *
 * `landDepthKm` prefers the curated real city's rasterised coast field
 * (`uLandFieldTex`, architecture.md ADR-009) wherever it covers the sample —
 * the ONLY way this contract can express a peninsula or lagoon, which the
 * single-valued `shoreX(yKm)` curve cannot. Outside its coverage (or when
 * `uLandFieldEnabled` is 0, the demo world's case) it falls back to the sine
 * curve unchanged — see `landFieldUniformDefaults()` in `./landField.ts` for
 * how a consuming material initializes these. NEAREST, texel-centred
 * sampling only, so the GPU lookup agrees with the unfiltered CPU twins
 * (`frontend/src/propagation/world.ts`, `simulation/core/propagation.py`)
 * to the last bit. */
export const DEMO_WORLD_GLSL = /* glsl */ `
  const float WORLD_KM = ${f(WORLD_KM)};
  const float WORLD_HALF = ${f(HALF)};
  const float SCENE_PER_KM = ${f(SCENE_UNITS_PER_KM)};
  uniform float uFlatTerrain;
  uniform float uShoreBase;
  uniform vec3 uShoreAmp;
  uniform vec3 uShoreFreq;
  uniform vec3 uShorePhase;
  uniform float uLandSign;
  uniform float uLandFieldEnabled;
  uniform vec2 uLandFieldOrigin;
  uniform float uLandFieldSizeKm;
  uniform float uLandFieldResolution;
  uniform sampler2D uLandFieldTex;

  vec2 sceneToKm(vec2 sceneXZ) {
    return vec2(sceneXZ.x / SCENE_PER_KM + WORLD_HALF, -sceneXZ.y / SCENE_PER_KM + WORLD_HALF);
  }

  float shoreX(float yKm) {
    return uShoreBase
      + uShoreAmp.x * sin(6.28318530718 * uShoreFreq.x * yKm / WORLD_KM + uShorePhase.x)
      + uShoreAmp.y * sin(6.28318530718 * uShoreFreq.y * yKm / WORLD_KM + uShorePhase.y)
      + uShoreAmp.z * sin(6.28318530718 * uShoreFreq.z * yKm / WORLD_KM + uShorePhase.z);
  }

  float landDepthKm(float xKm, float yKm) {
    float fallback = uLandSign * (xKm - shoreX(yKm));
    if (uLandFieldEnabled > 0.5) {
      float u = (xKm - uLandFieldOrigin.x) / uLandFieldSizeKm;
      float v = (yKm - uLandFieldOrigin.y) / uLandFieldSizeKm;
      if (u >= 0.0 && u < 1.0 && v >= 0.0 && v < 1.0) {
        float col = clamp(floor(u * uLandFieldResolution), 0.0, uLandFieldResolution - 1.0);
        float row = clamp(floor(v * uLandFieldResolution), 0.0, uLandFieldResolution - 1.0);
        vec2 texel = (vec2(col, row) + 0.5) / uLandFieldResolution;
        float sampled = texture2D(uLandFieldTex, texel).r;
        // The raster and the sine describe the same coast from different
        // sources and disagree slightly; an abrupt switch steps the terrain
        // into a rectangular plateau at the field's border.
        float insetKm = min(
          min(xKm - uLandFieldOrigin.x, uLandFieldOrigin.x + uLandFieldSizeKm - xKm),
          min(yKm - uLandFieldOrigin.y, uLandFieldOrigin.y + uLandFieldSizeKm - yKm)
        );
        float weight = smoothstep(0.0, ${f(LAND_FIELD_BLEND_KM)}, insetKm);
        return mix(fallback, sampled, weight);
      }
    }
    return fallback;
  }

  float worldNoise(float x, float y) {
    return 2.2 * sin(0.021 * x + 0.9 * sin(0.017 * y))
      + 1.7 * cos(0.031 * y + 0.8 * sin(0.023 * x))
      + 1.1 * sin(0.057 * x - 0.049 * y + 1.3)
      + 0.6 * cos(0.093 * x + 0.071 * y)
      + 0.3 * sin(0.19 * x - 0.17 * y);
  }

  float terrainHeightKm(float xKm, float yKm) {
    float d = landDepthKm(xKm, yKm);
    if (d < 0.0) {
      float n = worldNoise(xKm, yKm);
      return -0.8 - 6.0 * smoothstep(0.0, 40.0, -d) + n * 0.12 * smoothstep(0.0, 10.0, -d);
    }
    if (uFlatTerrain > 0.5) { return 0.05; }
    float n = worldNoise(xKm, yKm);
    float beach = 0.35 + 1.4 * smoothstep(0.0, 5.0, d);
    float hills = (n * 0.75 + 2.6) * smoothstep(3.0, 28.0, d);
    float ridge = 4.5 * smoothstep(40.0, 120.0, d) * (0.6 + 0.4 * sin(yKm * 0.05 + n * 0.1));
    return beach + hills + ridge;
  }
`;
