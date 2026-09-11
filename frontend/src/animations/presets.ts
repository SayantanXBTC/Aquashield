/**
 * Shared animation primitives (durations/easings/option builders) so every
 * feature animates with the same cinematic vocabulary instead of scattering
 * magic numbers. These return `animate()`-compatible option objects — they
 * never call `animate()` themselves, so callers stay in control of targets,
 * timing overrides, and cleanup (see cleanup.ts).
 */

export const EASING = {
  standard: "easeOutQuad",
  enter: "easeOutCubic",
  exit: "easeInCubic",
  cinematic: "easeOutExpo",
  spring: "easeOutElastic(1, .6)",
} as const;

export const DURATION = {
  micro: 180,
  fast: 320,
  base: 480,
  slow: 720,
  cinematic: 1100,
} as const;

/** Opacity + upward drift entrance — the default UI reveal. */
export function fadeUp(distance = 12) {
  return {
    opacity: [0, 1],
    translateY: [distance, 0],
    duration: DURATION.base,
    easing: EASING.enter,
  };
}

export function fadeDown(distance = -12) {
  return fadeUp(distance);
}

export function fadeOut() {
  return {
    opacity: [1, 0],
    duration: DURATION.fast,
    easing: EASING.exit,
  };
}

/** Horizontal reveal — used for command-panel slide-ins. */
export function slideIn(distance = 24, axis: "x" | "y" = "x") {
  const prop = axis === "x" ? "translateX" : "translateY";
  return {
    opacity: [0, 1],
    [prop]: [distance, 0],
    duration: DURATION.base,
    easing: EASING.enter,
  };
}

export function slideOut(distance = 24, axis: "x" | "y" = "x") {
  const prop = axis === "x" ? "translateX" : "translateY";
  return {
    opacity: [1, 0],
    [prop]: [0, distance],
    duration: DURATION.fast,
    easing: EASING.exit,
  };
}

/** Subtle scale-in — reserved for hero/cinematic beats, not routine UI. */
export function scaleReveal(from = 0.96) {
  return {
    opacity: [0, 1],
    scale: [from, 1],
    duration: DURATION.cinematic,
    easing: EASING.cinematic,
  };
}
