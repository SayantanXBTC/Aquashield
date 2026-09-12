import type { ComponentType } from "react";
import type { HazardSnapshot } from "@/propagation/hazards";

export interface DisasterVisualizerProps {
  /** Per-frame accessor for the current hazard state (live preview or
   * recorded replay — the visualizer can't tell and doesn't care). Called
   * inside useFrame, never during render, so param edits and playback
   * never re-render the scene graph. */
  getSnapshot: () => HazardSnapshot | null;
}

export type DisasterVisualizerComponent = ComponentType<DisasterVisualizerProps>;
