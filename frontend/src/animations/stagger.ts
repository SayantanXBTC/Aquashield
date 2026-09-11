import { animate, stagger, type JSAnimation } from "animejs";
import { DURATION, EASING } from "./presets";

/**
 * Staggered entrance for a list of elements (nav items, disaster-category
 * labels, panel rows). Returns the JSAnimation so the caller can revert it
 * on unmount via cleanup.ts.
 */
export function staggerIn(
  targets: Element[] | NodeListOf<Element> | string,
  options?: { delayEach?: number; distance?: number; startDelay?: number },
): JSAnimation {
  const { delayEach = 60, distance = 16, startDelay = 0 } = options ?? {};
  return animate(targets, {
    opacity: [0, 1],
    translateY: [distance, 0],
    delay: stagger(delayEach, { start: startDelay }),
    duration: DURATION.base,
    easing: EASING.enter,
  });
}

export function staggerOut(
  targets: Element[] | NodeListOf<Element> | string,
  options?: { delayEach?: number; distance?: number },
): JSAnimation {
  const { delayEach = 40, distance = 10 } = options ?? {};
  return animate(targets, {
    opacity: [1, 0],
    translateY: [0, -distance],
    delay: stagger(delayEach),
    duration: DURATION.fast,
    easing: EASING.exit,
  });
}
