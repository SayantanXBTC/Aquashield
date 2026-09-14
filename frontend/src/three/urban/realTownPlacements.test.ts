import { describe, expect, it } from "vitest";
import type { TownProfile } from "@shared/types";
import chennai from "@shared/constants/towns/chennai.json";
import { shoreParamsForTown } from "@/propagation/world";
import { landDepthKm, terrainHeightKm } from "@/three/world/demoWorld";
import { placementsFromTown } from "./realTownPlacements";

const CHENNAI = chennai as unknown as TownProfile;
const SHORE = shoreParamsForTown(CHENNAI);

/** Real committed building data (architecture.md ADR-009) mapped through the
 * same pure, GPU-free path buildingPlacement.test.ts exercises for the
 * fictional generator. */
describe("real town placements", () => {
  const placements = placementsFromTown(CHENNAI, []);
  const all = [...placements.low, ...placements.mid, ...placements.highrise];

  it("carries over every real building from the committed data", () => {
    expect(all.length).toBe(CHENNAI.buildings.length);
  });

  it("keeps every building on land under its own fitted shoreline", () => {
    for (const b of all) {
      expect(landDepthKm(b.xKm, b.yKm, SHORE)).toBeGreaterThan(0);
    }
  });

  it("grounds every building on the flat real-city terrain surface exactly", () => {
    for (const b of all.slice(0, 500)) {
      expect(b.y).toBe(terrainHeightKm(b.xKm, b.yKm, true, SHORE));
    }
  });

  it("respects clearings around placed structures", () => {
    const target = all[0];
    const cleared = placementsFromTown(CHENNAI, [{ xKm: target.xKm, yKm: target.yKm }]);
    const clearedAll = [...cleared.low, ...cleared.mid, ...cleared.highrise];
    expect(clearedAll.length).toBeLessThan(all.length);
  });

  it("is deterministic", () => {
    const again = placementsFromTown(CHENNAI, []);
    expect(again.low.length).toBe(placements.low.length);
    expect(again.mid[0]?.xKm).toBeCloseTo(placements.mid[0]?.xKm ?? 0, 10);
  });
});
