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
import demoWorld from "@shared/constants/demo_world.json";
import { shoreX, WORLD_KM } from "@/propagation/world";

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

/** Signed distance inland from the shoreline, in km (negative = offshore). */
export function landDepthKm(xKm: number, yKm: number): number {
  return xKm - shoreX(yKm);
}

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

/** Terrain height (scene units) at world km coordinates. */
export function terrainHeightKm(xKm: number, yKm: number): number {
  const d = landDepthKm(xKm, yKm);
  const n = vnoise(xKm, yKm);
  if (d < 0) {
    // Sea floor: a shelf that shelves down over ~40 km, noise-broken.
    return -0.8 - 6.0 * smoothstep(0, 40, -d) + n * 0.12 * smoothstep(0, 10, -d);
  }
  const beach = 0.35 + 1.4 * smoothstep(0, 5, d);
  const hills = (n * 0.75 + 2.6) * smoothstep(3, 28, d);
  const ridge = 4.5 * smoothstep(40, 120, d) * (0.6 + 0.4 * Math.sin(yKm * 0.05 + n * 0.1));
  return beach + hills + ridge;
}

const terms = demoWorld.shore_terms;
const f = (v: number) => v.toFixed(6);

/** GLSL chunk: `shoreX(yKm)`, `landDepthKm(xKm, yKm)`, `terrainHeightKm(xKm,
 * yKm)`, and `sceneToKm(vec2)`. Generated from the same constants as the JS
 * functions above. */
export const DEMO_WORLD_GLSL = /* glsl */ `
  const float WORLD_KM = ${f(WORLD_KM)};
  const float WORLD_HALF = ${f(HALF)};
  const float SCENE_PER_KM = ${f(SCENE_UNITS_PER_KM)};

  vec2 sceneToKm(vec2 sceneXZ) {
    return vec2(sceneXZ.x / SCENE_PER_KM + WORLD_HALF, -sceneXZ.y / SCENE_PER_KM + WORLD_HALF);
  }

  float shoreX(float yKm) {
    return ${f(demoWorld.shore_base_x_km)}
      + ${f(terms[0].amp)} * sin(6.28318530718 * ${f(terms[0].freq)} * yKm / WORLD_KM + ${f(terms[0].phase)})
      + ${f(terms[1].amp)} * sin(6.28318530718 * ${f(terms[1].freq)} * yKm / WORLD_KM + ${f(terms[1].phase)})
      + ${f(terms[2].amp)} * sin(6.28318530718 * ${f(terms[2].freq)} * yKm / WORLD_KM + ${f(terms[2].phase)});
  }

  float landDepthKm(float xKm, float yKm) { return xKm - shoreX(yKm); }

  float worldNoise(float x, float y) {
    return 2.2 * sin(0.021 * x + 0.9 * sin(0.017 * y))
      + 1.7 * cos(0.031 * y + 0.8 * sin(0.023 * x))
      + 1.1 * sin(0.057 * x - 0.049 * y + 1.3)
      + 0.6 * cos(0.093 * x + 0.071 * y)
      + 0.3 * sin(0.19 * x - 0.17 * y);
  }

  float terrainHeightKm(float xKm, float yKm) {
    float d = landDepthKm(xKm, yKm);
    float n = worldNoise(xKm, yKm);
    if (d < 0.0) {
      return -0.8 - 6.0 * smoothstep(0.0, 40.0, -d) + n * 0.12 * smoothstep(0.0, 10.0, -d);
    }
    float beach = 0.35 + 1.4 * smoothstep(0.0, 5.0, d);
    float hills = (n * 0.75 + 2.6) * smoothstep(3.0, 28.0, d);
    float ridge = 4.5 * smoothstep(40.0, 120.0, d) * (0.6 + 0.4 * sin(yKm * 0.05 + n * 0.1));
    return beach + hills + ridge;
  }
`;
