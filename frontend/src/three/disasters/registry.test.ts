import { describe, expect, it } from "vitest";
import { getDisasterVisualizer } from "./registry";
import { FloodVisualizer } from "./flood/FloodVisualizer";
import { TsunamiVisualizer } from "./tsunami/TsunamiVisualizer";
import { CycloneVisualizer } from "./cyclone/CycloneVisualizer";
import { OilSpillVisualizer } from "./oil-spill/OilSpillVisualizer";
import { SearchRescueVisualizer } from "./search-rescue/SearchRescueVisualizer";

describe("getDisasterVisualizer", () => {
  it("resolves the direct disaster types", () => {
    expect(getDisasterVisualizer("flood")).toBe(FloodVisualizer);
    expect(getDisasterVisualizer("tsunami")).toBe(TsunamiVisualizer);
    expect(getDisasterVisualizer("cyclone")).toBe(CycloneVisualizer);
    expect(getDisasterVisualizer("oil_spill")).toBe(OilSpillVisualizer);
    expect(getDisasterVisualizer("search_rescue")).toBe(SearchRescueVisualizer);
  });

  it("resolves reused disaster types to their shared visualizer", () => {
    expect(getDisasterVisualizer("flash_flood")).toBe(FloodVisualizer);
    expect(getDisasterVisualizer("coastal_flood")).toBe(FloodVisualizer);
    expect(getDisasterVisualizer("storm_surge")).toBe(CycloneVisualizer);
    expect(getDisasterVisualizer("chemical_pollution")).toBe(OilSpillVisualizer);
  });

  it("fails safely (returns null, never throws) for an unknown disaster type", () => {
    expect(() => getDisasterVisualizer("volcanic_eruption")).not.toThrow();
    expect(getDisasterVisualizer("volcanic_eruption")).toBeNull();
  });
});
