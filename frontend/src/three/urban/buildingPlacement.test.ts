import { describe, expect, it } from "vitest";
import { landDepthKm, terrainHeightKm } from "@/three/world/demoWorld";
import { BUILDING_CLEARING_KM, buildBuildingPlacements, type BuildingClass } from "./buildingPlacement";

/** The Dense Coastal Profile's building field is deterministic and purely
 * procedural, so its shape is assertable without a GPU. */
describe("building placement", () => {
  const stands = buildBuildingPlacements([]);
  const all = [...stands.low, ...stands.mid, ...stands.highrise];

  it("plants a town rather than a scattering", () => {
    expect(all.length).toBeGreaterThan(300);
    (Object.keys(stands) as BuildingClass[]).forEach((cls) => {
      expect(stands[cls].length).toBeLessThanOrEqual(700);
    });
  });

  it("keeps the beach and the sea bare", () => {
    for (const b of all) {
      expect(landDepthKm(b.xKm, b.yKm)).toBeGreaterThan(1.1);
    }
  });

  it("stands every building on the flat terrain surface exactly", () => {
    // Dense Coastal Profile's terrain is a constant, so this is a stronger,
    // exact assertion than the forest's tolerance check.
    for (const b of all.slice(0, 500)) {
      expect(b.y).toBe(terrainHeightKm(b.xKm, b.yKm, true));
    }
  });

  it("respects clearings around placed structures", () => {
    const target = all[Math.floor(all.length / 2)];
    const cleared = buildBuildingPlacements([{ xKm: target.xKm, yKm: target.yKm }]);
    const clearedAll = [...cleared.low, ...cleared.mid, ...cleared.highrise];
    for (const b of clearedAll) {
      expect(Math.hypot(b.xKm - target.xKm, b.yKm - target.yKm)).toBeGreaterThanOrEqual(BUILDING_CLEARING_KM);
    }
    expect(clearedAll.length).toBeLessThan(all.length);
  });

  it("is deterministic", () => {
    const again = buildBuildingPlacements([]);
    expect(again.low.length).toBe(stands.low.length);
    expect(again.mid.length).toBe(stands.mid.length);
    expect(again.highrise.length).toBe(stands.highrise.length);
    expect(again.low[10].xKm).toBeCloseTo(stands.low[10].xKm, 10);
    expect(again.highrise[5].rotY).toBeCloseTo(stands.highrise[5].rotY, 10);
  });
});
