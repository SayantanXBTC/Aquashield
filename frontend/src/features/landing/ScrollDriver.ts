import { useEffect, useRef } from "react";
import { clampProgress } from "./sceneProgress";

/**
 * Turns native document scroll over a tall container into a normalized
 * 0..1 progress value, rAF-throttled so a scroll storm produces at most one
 * layout read + one callback per frame (Prompt 8.1 "Performance": avoid
 * layout thrashing, no per-frame allocations). `onProgress` is called with
 * a plain number — CinematicScroll writes it straight to element styles,
 * so this hook never touches the DOM itself beyond the one
 * `getBoundingClientRect` read it needs.
 *
 * Not used at all when the caller has already decided reduced-motion
 * applies — see CinematicScroll, which renders a static, non-scroll-driven
 * layout in that case instead of calling this hook.
 */
export function useScrollDriver(containerRef: React.RefObject<HTMLElement | null>, onProgress: (progress: number) => void) {
  const rafRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      rafRef.current = null;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollable = rect.height - viewportHeight;
      const progress = scrollable > 0 ? clampProgress(-rect.top / scrollable) : 0;
      onProgressRef.current(progress);
    };

    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);
}
