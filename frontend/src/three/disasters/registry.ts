import type { DisasterType } from "@shared/types";
import { CycloneVisualizer } from "./cyclone/CycloneVisualizer";
import { FloodVisualizer } from "./flood/FloodVisualizer";
import { OilSpillVisualizer } from "./oil-spill/OilSpillVisualizer";
import { SearchRescueVisualizer } from "./search-rescue/SearchRescueVisualizer";
import { TsunamiVisualizer } from "./tsunami/TsunamiVisualizer";
import type { DisasterVisualizerComponent } from "./types";

/**
 * disaster_type -> visualizer component. SceneRoot resolves through this
 * only — never an if/else chain — mirroring simulation/core/registry.py's
 * model registry on the backend. `flash_flood`/`coastal_flood` reuse
 * FloodVisualizer, `storm_surge` reuses CycloneVisualizer,
 * `chemical_pollution` reuses OilSpillVisualizer, the same reuse pattern
 * Prompt 7 established server-side.
 */
const REGISTRY: Partial<Record<DisasterType, DisasterVisualizerComponent>> = {
  flood: FloodVisualizer,
  flash_flood: FloodVisualizer,
  coastal_flood: FloodVisualizer,
  storm_surge: CycloneVisualizer,
  cyclone: CycloneVisualizer,
  tsunami: TsunamiVisualizer,
  oil_spill: OilSpillVisualizer,
  chemical_pollution: OilSpillVisualizer,
  search_rescue: SearchRescueVisualizer,
};

/** Returns `null` for an unregistered disaster type — SceneRoot renders no
 * visualizer rather than crashing (Prompt 8 "unknown disaster type fails
 * safely"). */
export function getDisasterVisualizer(disasterType: string): DisasterVisualizerComponent | null {
  return REGISTRY[disasterType as DisasterType] ?? null;
}
