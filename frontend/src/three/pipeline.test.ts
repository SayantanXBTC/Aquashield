import { describe, expect, it } from "vitest";
import type { SimulationState } from "@shared/types";
import { toVisualState } from "./adapters/simulationVisualAdapter";
import { getDisasterVisualizer } from "./disasters/registry";

const DISASTER_TYPES: SimulationState["disaster_type"][] = [
  "flood",
  "flash_flood",
  "coastal_flood",
  "storm_surge",
  "cyclone",
  "tsunami",
  "oil_spill",
  "chemical_pollution",
  "search_rescue",
];

/**
 * The seam the scene actually depends on, tested without a WebGL context
 * (jsdom cannot provide a real one, and no test-renderer for the
 * currently-installed three.js version does either — see
 * docs/development/command-center.md "Testing" for the limitation this
 * works around): a real SimulationState -> SimulationVisualState -> a
 * resolvable visualizer component, for every disaster type the backend
 * can produce.
 */
describe("simulation state -> visual state -> visualizer pipeline", () => {
  it("resolves a renderable visualizer for every real disaster_type", () => {
    for (const disaster_type of DISASTER_TYPES) {
      const state: SimulationState = {
        simulation_run_id: "r1",
        timestep: 3,
        disaster_type,
        simulation_time: "2026-01-01T00:45:00Z",
        environmental_state: {},
        hazard_state: {},
        affected_area: null,
        risk_state: {},
        infrastructure_impacts: [],
        metadata: { progress: 0.25 },
      };

      const visual = toVisualState(state);
      expect(visual.disasterType).toBe(disaster_type);

      const Visualizer = getDisasterVisualizer(visual.disasterType);
      expect(Visualizer).not.toBeNull();
    }
  });
});
