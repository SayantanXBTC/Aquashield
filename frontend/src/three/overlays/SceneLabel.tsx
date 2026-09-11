import type { ReactNode } from "react";
import { Html } from "@react-three/drei";

interface SceneLabelProps {
  position: [number, number, number];
  children: ReactNode;
}

/** A screen-space label anchored to a 3D point (a marker, a hazard center) —
 * the one place UI text is allowed to live inside the Canvas, kept visually
 * consistent so disaster visualizers don't each invent their own label
 * styling. */
export function SceneLabel({ position, children }: SceneLabelProps) {
  return (
    <Html position={position} center distanceFactor={40} occlude={false} style={{ pointerEvents: "none" }}>
      <div className="border-hairline-strong bg-abyss/90 text-ink whitespace-nowrap rounded-[var(--radius-control)] border px-2 py-1 font-mono text-[10px] tracking-wide shadow-[var(--shadow-panel)]">
        {children}
      </div>
    </Html>
  );
}
