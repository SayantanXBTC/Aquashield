import { describe, expect, it } from "vitest";
import { hazardKindFor } from "@/propagation/hazards";
import { getDisasterVisualizer } from "./registry";

const ALL_TYPES = [
  "flood", "flash_flood", "coastal_flood", "storm_surge", "cyclone", "tsunami", "oil_spill", "chemical_pollution",
] as const;

describe("disaster visualizer registry", () => {
  it("resolves a visualizer for every shoreline-capable disaster type", () => {
    for (const type of ALL_TYPES) expect(getDisasterVisualizer(hazardKindFor(type))).not.toBeNull();
  });
  it("fails safely for types with no shoreline visual", () => {
    expect(getDisasterVisualizer(hazardKindFor("search_rescue"))).toBeNull();
    expect(getDisasterVisualizer(hazardKindFor("nope"))).toBeNull();
  });
});
