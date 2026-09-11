/**
 * Pure scroll-progress -> visual-state math for the cinematic landing
 * sequence. Kept dependency-free (no DOM, no Anime.js) so the crossfade/
 * zoom curve that drives CinematicScroll's imperative style writes can be
 * unit-tested directly, and so CinematicScroll only ever *applies* numbers
 * this module already validated instead of recomputing the curve inline.
 *
 * Model: `count` equal-width scroll "bands", each owning one narrative
 * scene. A scene is fully opaque across the middle of its band and
 * crossfades with its neighbor across a shared transition window at each
 * boundary (continuous overlap, not a hard cut) — Prompt 8.1's explicit
 * "image A -> overlap -> image B" requirement, not a stacked-card carousel.
 */

const TRANSITION_FRACTION = 0.45;

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clampProgress((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Which scene "owns" the current scroll progress — the one nearest full
 * opacity, used to swap narrative text and the progress readout. */
export function getActiveIndex(progress: number, count: number): number {
  if (count <= 0) return 0;
  const p = clampProgress(progress);
  return Math.min(count - 1, Math.max(0, Math.floor(p * count)));
}

/** 0..1 opacity for scene `index`, continuous across the whole scroll range
 * — 1 while progress is inside its band's held middle, crossfading down as
 * progress moves into the next/previous scene's band. */
export function getSceneOpacity(progress: number, index: number, count: number): number {
  if (count <= 0) return 0;
  const p = clampProgress(progress);
  const band = 1 / count;
  const start = index * band;
  const end = start + band;
  const fade = band * TRANSITION_FRACTION;

  const fadeIn = index === 0 ? 1 : smoothstep(start - fade, start, p);
  const fadeOut = index === count - 1 ? 1 : 1 - smoothstep(end - fade, end, p);
  return Math.min(fadeIn, fadeOut);
}

/** Slow Ken Burns zoom across a scene's own band — `from` at band entry to
 * `to` at band exit — the single consistent transition technique the whole
 * sequence uses (Prompt 8.1: "pick one dominant technique, not all at
 * once"). Continues past the band edges instead of snapping so a scene
 * still mid-crossfade keeps moving smoothly. */
export function getSceneScale(progress: number, index: number, count: number, from = 1.08, to = 1): number {
  if (count <= 0) return from;
  const p = clampProgress(progress);
  const band = 1 / count;
  const start = index * band;
  const local = clampProgress((p - start) / band);
  return from + (to - from) * local;
}

/** Small counter-drift used alongside the zoom for a subtle sense of depth
 * (foreground/background separation) — deliberately tiny, in scene units
 * (px), not layout-affecting. */
export function getSceneDrift(progress: number, index: number, count: number, distancePx = 24): number {
  if (count <= 0) return 0;
  const p = clampProgress(progress);
  const band = 1 / count;
  const start = index * band;
  const local = clampProgress((p - start) / band);
  return (1 - local) * distancePx;
}
