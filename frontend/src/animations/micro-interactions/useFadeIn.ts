import { useEffect, type RefObject } from "react";
import { animate } from "animejs";

/**
 * Verifies the Anime.js integration for UI/micro-interaction animation.
 * Three.js/R3F render-loop animation stays in frontend/src/three/ — this
 * module boundary is for UI-side animation only (see animations/README.md).
 */
export function useFadeIn(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 400,
      easing: "easeOutQuad",
    });
  }, [ref]);
}
