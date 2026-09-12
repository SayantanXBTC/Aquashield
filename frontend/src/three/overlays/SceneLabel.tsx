import type { ReactNode } from "react";
import { Html } from "@react-three/drei";

interface SceneLabelProps {
  position: [number, number, number];
  children: ReactNode;
  /** "primary" is the scenario/hazard callout; "muted" is a secondary
   * annotation (a source marker, an asset name). */
  tone?: "primary" | "muted";
}

/**
 * A screen-space label anchored to a 3D point (a marker, a hazard centre) —
 * the one place UI text is allowed to live inside the Canvas, kept visually
 * consistent so disaster visualizers don't each invent their own label
 * styling.
 *
 * Prompt 11: labels are now a fixed screen size (no `distanceFactor`). A
 * distance-scaled label shrinks to unreadable the moment the camera pulls
 * back to frame a large hazard, which is the opposite of what a callout is
 * for. The leader line below the pill visually ties it to its anchor point
 * now that the text no longer sits directly on it.
 */
export function SceneLabel({ position, children, tone = "primary" }: SceneLabelProps) {
  const surface =
    tone === "primary"
      ? "border-hairline-strong bg-abyss/92 text-ink"
      : "border-hairline bg-abyss/85 text-ink-soft";
  return (
    <Html position={position} center occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="flex -translate-y-3 flex-col items-center">
        <span
          className={`rounded-[var(--radius-control)] border px-2 py-1 font-mono text-[10px] leading-none tracking-[0.04em] whitespace-nowrap shadow-[var(--shadow-raised)] ${surface}`}
        >
          {children}
        </span>
        <span aria-hidden="true" className="bg-hairline-strong h-3 w-px" />
      </div>
    </Html>
  );
}
