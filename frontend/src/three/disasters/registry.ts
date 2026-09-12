import type { HazardKind } from "@/propagation/hazards";
import { CycloneVisualizer } from "./cyclone/CycloneVisualizer";
import { FloodVisualizer } from "./flood/FloodVisualizer";
import { OilSpillVisualizer } from "./oil-spill/OilSpillVisualizer";
import { TsunamiVisualizer } from "./tsunami/TsunamiVisualizer";
import type { DisasterVisualizerComponent } from "./types";

/**
 * hazard kind -> visualizer component. SceneRoot resolves through this
 * only — never an if/else chain — mirroring simulation/core/registry.py.
 * The disaster_type -> kind reuse decisions (flash_flood/coastal_flood ->
 * flood, storm_surge -> cyclone, chemical_pollution -> oil spill) live in
 * src/propagation/hazards.ts `hazardKindFor`, the same place the model
 * formulas are mirrored, so both stay in one seam.
 */
const REGISTRY: Record<HazardKind, DisasterVisualizerComponent> = {
  coastal_flood: FloodVisualizer,
  cyclone: CycloneVisualizer,
  tsunami: TsunamiVisualizer,
  oil_spill: OilSpillVisualizer,
};

/** Returns `null` for an unknown kind — SceneRoot renders no visualizer
 * rather than crashing. */
export function getDisasterVisualizer(kind: HazardKind | null): DisasterVisualizerComponent | null {
  if (!kind) return null;
  return REGISTRY[kind] ?? null;
}
