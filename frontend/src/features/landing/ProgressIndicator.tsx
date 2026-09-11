import type { RefObject } from "react";

interface ProgressIndicatorProps {
  activeIndex: number;
  count: number;
  lineRef: RefObject<HTMLDivElement | null>;
}

/**
 * A minimal cinematic scroll readout — "01 / 06" and a thin progress line.
 * The line's width is written directly by CinematicScroll's scroll loop
 * (via `lineRef`) since it changes every frame; the "N / total" text only
 * re-renders when the active scene actually changes (low frequency).
 */
export function ProgressIndicator({ activeIndex, count, lineRef }: ProgressIndicatorProps) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="pointer-events-none absolute right-6 bottom-6 z-10 flex flex-col items-end gap-2 md:right-10 md:bottom-10"
      aria-hidden="true"
    >
      <span className="text-ink-soft font-mono text-[11px] tracking-[0.2em]">
        {pad(activeIndex + 1)} / {pad(count)}
      </span>
      <div className="bg-ink-faint/30 h-px w-24 overflow-hidden">
        <div ref={lineRef} className="bg-accent-strong h-full" style={{ width: "0%" }} />
      </div>
    </div>
  );
}
