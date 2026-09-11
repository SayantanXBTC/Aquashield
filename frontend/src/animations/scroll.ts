import { animate, onScroll, type ScrollObserver } from "animejs";
import { EASING } from "./presets";

/**
 * Scroll-scrubbed animation: the linked animation's progress is driven
 * directly by scroll position between `enter`/`leave` thresholds (Anime.js
 * v4 `ScrollObserver.link`), not by a manual scroll listener + RAF loop.
 * Returns the ScrollObserver for cleanup.ts to `.revert()` on unmount.
 */
export function linkScrollProgress(
  target: Element,
  container: Element,
  animationProps: Record<string, unknown>,
): ScrollObserver {
  const observer = onScroll({
    target: container,
    enter: "bottom top",
    leave: "top bottom",
    sync: true,
  });
  observer.link(animate(target, { ...animationProps, easing: "linear", autoplay: observer }));
  return observer;
}

/**
 * Threshold-based enter/leave callbacks (not scroll-scrubbed) — for firing a
 * one-shot stagger reveal when a section becomes roughly centered in view.
 * Returns the ScrollObserver for cleanup.ts.
 */
export function onSectionInView(
  container: Element,
  callbacks: { onEnter?: () => void; onLeave?: () => void },
): ScrollObserver {
  return onScroll({
    target: container,
    enter: "bottom-=15% top",
    leave: "top+=15% bottom",
    onEnter: callbacks.onEnter,
    onLeave: callbacks.onLeave,
  });
}

export const SCROLL_EASING = EASING.standard;
