/**
 * JS twin of the terrain material's fbm noise (three/terrain/terrainMaterial.ts).
 *
 * The terrain shader paints forest where `tfbm(km * 0.11 + 4.2)` is high. The
 * forest layer plants its trees in those same places, so the noise is
 * re-implemented here with the same construction and constants — the JS/GLSL
 * twin discipline `terrainHeightKm` follows (three/world/demoWorld.ts). Change
 * one, change the other, or the trees drift off the green.
 *
 * This twin is a close match, not a bit-exact one: the shader runs in 32-bit
 * floats and this runs in doubles, so a tree on the very edge of a patch can
 * land a metre either side of where the shader draws the boundary. That is
 * cosmetic — nothing downstream reads these positions.
 *
 * VISUAL DEMONSTRATION — procedural noise, not land-cover data.
 */

function fract(v: number): number {
  return v - Math.floor(v);
}

/**
 * The GLSL twin:
 *   p = fract(p * vec2(123.34, 456.21));
 *   p += dot(p, p + 45.32);
 *   return fract(p.x * p.y);
 *
 * Note what is NOT fract'ed: the dot product is added to p and only the
 * final product is wrapped. Wrapping p again there collapses the output to
 * the product of two [0,1) numbers — mean 0.25 instead of 0.5 — which
 * silently empties the forest.
 */
function thash(x: number, y: number): number {
  let px = fract(x * 123.34);
  let py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d;
  py += d;
  return fract(px * py);
}

function tnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const ux = (x - ix) * (x - ix) * (3 - 2 * (x - ix));
  const uy = (y - iy) * (y - iy) * (3 - 2 * (y - iy));
  const a = thash(ix, iy);
  const b = thash(ix + 1, iy);
  const c = thash(ix, iy + 1);
  const d = thash(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
}

/** 5-octave fbm — the GLSL `tfbm` twin. */
export function tfbm(x: number, y: number): number {
  let v = 0;
  let a = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 5; i++) {
    v += a * tnoise(px, py);
    px = px * 2.07 + 11.3;
    py = py * 2.07 + 11.3;
    a *= 0.5;
  }
  return v;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 0-1 forest density at world km — the twin of the shader's `forestMask`,
 * widened slightly so the canopy edge feathers past the painted patch
 * instead of ending on a hard line. */
export function forestDensity(xKm: number, yKm: number, landDepthKm: number): number {
  const patch = smoothstep(0.5, 0.74, tfbm(xKm * 0.11 + 4.2, yKm * 0.11 + 4.2));
  const inland = smoothstep(1.6, 6.0, landDepthKm);
  return patch * inland;
}
