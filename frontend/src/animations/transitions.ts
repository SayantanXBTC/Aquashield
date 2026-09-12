import { animate } from "animejs";
import { DURATION, EASING, fadeOut, fadeUp } from "./presets";

/**
 * Promise-based whole-screen transitions (JSAnimation is thenable in
 * Anime.js v4). Used by the landing -> explore -> command-center flow so a
 * route change never hard-cuts.
 */
export async function pageTransitionOut(el: Element): Promise<void> {
  await animate(el, {
    opacity: [1, 0],
    scale: [1, 0.985],
    duration: DURATION.slow,
    easing: EASING.exit,
  });
}

export async function pageTransitionIn(el: Element): Promise<void> {
  await animate(el, {
    opacity: [0, 1],
    scale: [1.015, 1],
    duration: DURATION.slow,
    easing: EASING.cinematic,
  });
}

export async function panelEnter(el: Element): Promise<void> {
  await animate(el, slideInFromRight());
}

function slideInFromRight() {
  return {
    opacity: [0, 1],
    translateX: [16, 0],
    duration: DURATION.base,
    easing: EASING.enter,
  };
}

export async function panelExit(el: Element): Promise<void> {
  await animate(el, fadeOut());
}

export async function revealText(el: Element): Promise<void> {
  await animate(el, fadeUp(10));
}

export interface GatewayRevealElements {
  content?: Element | null;
  button?: Element | null;
  shader?: Element | null;
  overlay?: Element | null;
}

export async function exploreGatewayRevealTransition(elements: GatewayRevealElements): Promise<void> {
  const promises: Promise<unknown>[] = [];

  if (elements.content) {
    promises.push(
      Promise.resolve(
        animate(elements.content, {
          opacity: [1, 0],
          translateY: [0, -18],
          scale: [1, 0.96],
          duration: DURATION.base,
          easing: EASING.exit,
        }),
      ),
    );
  }

  if (elements.button) {
    promises.push(
      Promise.resolve(
        animate(elements.button, {
          opacity: [1, 0],
          scale: [1, 0.92],
          duration: DURATION.fast,
          easing: EASING.exit,
        }),
      ),
    );
  }

  if (elements.shader) {
    promises.push(
      Promise.resolve(
        animate(elements.shader, {
          scale: [1, 1.15],
          opacity: [0.45, 0.85, 0],
          duration: DURATION.slow,
          easing: EASING.cinematic,
        }),
      ),
    );
  }

  if (elements.overlay) {
    promises.push(
      Promise.resolve(
        animate(elements.overlay, {
          opacity: [0, 1],
          duration: DURATION.slow,
          easing: EASING.enter,
        }),
      ),
    );
  }

  await Promise.all(promises);
}
