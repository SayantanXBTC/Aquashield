/**
 * VISUAL DEMONSTRATION — GPU sampler for a curated real city's rasterised
 * land/sea signed-distance field (architecture.md ADR-009, CLAUDE.md §27).
 * The field is coarse Natural Earth coastline data, roughly 100m-1km
 * accurate: a real coastline, not survey-grade geometry or bathymetry.
 *
 * Builds the single-channel float DataTexture that DEMO_WORLD_GLSL's
 * `landDepthKm` samples, from the `LandField` already decoded once by
 * `frontend/src/propagation/world.ts` (`shoreParamsForTown`) — this module
 * never touches the base64/JSON itself, so there is exactly one decode per
 * town shared by the CPU marching code and this texture.
 *
 * NEAREST filtering only, on both axes: bilinear would disagree with the
 * unfiltered nearest-neighbour lookup the CPU twins (this file's `LandField`
 * consumer, and simulation/core/propagation.py) perform on the identical
 * buffer.
 */
import { ClampToEdgeWrapping, DataTexture, FloatType, NearestFilter, RedFormat } from "three";
import type { LandField } from "@/propagation/world";

export interface LandFieldUniformValues {
  uLandFieldEnabled: number;
  uLandFieldOrigin: [number, number];
  uLandFieldSizeKm: number;
  uLandFieldResolution: number;
}

// A scene with no field still binds a real texture object to the sampler
// (never null) so nothing warns about an unbound sampler2D at draw time;
// uLandFieldEnabled = 0 means the shader branch that would sample it never
// runs. One instance for the whole app, like `forestUniforms` — never
// disposed, matching its module-scoped lifetime.
export const LAND_FIELD_DUMMY_TEXTURE = createDummyTexture();

function createDummyTexture(): DataTexture {
  const tex = new DataTexture(new Float32Array([0]), 1, 1, RedFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** The non-texture uniforms for a `ShoreParams`-carried `LandField` (or the
 * disabled defaults when there isn't one) — shared by every material so a
 * disabled scene renders byte-identically to the pre-field code path. */
export function landFieldUniformDefaults(field?: LandField): LandFieldUniformValues {
  if (!field) return { uLandFieldEnabled: 0, uLandFieldOrigin: [0, 0], uLandFieldSizeKm: 1, uLandFieldResolution: 1 };
  return {
    uLandFieldEnabled: 1,
    uLandFieldOrigin: [field.originXKm, field.originYKm],
    uLandFieldSizeKm: field.sizeKm,
    uLandFieldResolution: field.resolution,
  };
}

/** One DataTexture per decoded field. Caller (SceneRoot) memoises this per
 * town and disposes the previous texture on change/unmount — a GPU resource
 * must not be rebuilt every render. */
export function buildLandFieldTexture(field: LandField): DataTexture {
  const km = new Float32Array(field.data.length);
  for (let i = 0; i < field.data.length; i++) km[i] = field.data[i] * field.scaleKm;
  const tex = new DataTexture(km, field.resolution, field.resolution, RedFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
