/**
 * Mirror of simulation/tests/test_propagation_orientation.py — the same
 * cases, so the two sides of the port cannot disagree about which side of
 * the shoreline is land.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, distanceToCoastAlongHeading, isLand, landDepthKm, shoreX, type ShoreParams } from "./world";
import { inlandDepthKm } from "./structures";

const EAST_FACING: ShoreParams = {
  baseXKm: 300 - DEFAULT_SHORE.baseXKm,
  terms: DEFAULT_SHORE.terms.map((t) => ({ amp: -t.amp, freq: t.freq, phase: t.phase })),
  landSign: -1,
};

describe("coastal orientation", () => {
  it("defaults to west-facing", () => {
    expect(DEFAULT_SHORE.landSign).toBe(1);
  });

  it("puts land east of the curve when west-facing", () => {
    const x = shoreX(150);
    expect(isLand(x + 10, 150)).toBe(true);
    expect(isLand(x - 10, 150)).toBe(false);
    expect(landDepthKm(x + 10, 150)).toBeCloseTo(10, 9);
  });

  it("puts land west of the curve when east-facing", () => {
    const x = shoreX(150, EAST_FACING);
    expect(isLand(x - 10, 150, EAST_FACING)).toBe(true);
    expect(isLand(x + 10, 150, EAST_FACING)).toBe(false);
    expect(landDepthKm(x - 10, 150, EAST_FACING)).toBeCloseTo(10, 9);
  });

  it("preserves inland depth under reflection", () => {
    for (const [x, y] of [[70, 150], [210, 40], [196, 299]] as const) {
      expect(landDepthKm(x, y)).toBeCloseTo(landDepthKm(300 - x, y, EAST_FACING), 9);
    }
  });

  it("reverses the landward heading", () => {
    const west = distanceToCoastAlongHeading(70, 150, 90);
    const east = distanceToCoastAlongHeading(230, 150, 270, EAST_FACING);
    expect(west).not.toBeNull();
    expect(east).not.toBeNull();
    expect(Math.abs(west! - east!)).toBeLessThan(1e-9);
  });

  it("never lands a seaward heading on an east-facing coast", () => {
    expect(distanceToCoastAlongHeading(230, 150, 90, EAST_FACING)).toBeNull();
  });

  it("signs the structures mirror too", () => {
    const x = shoreX(150, EAST_FACING);
    expect(inlandDepthKm(x - 5, 150, EAST_FACING)).toBeCloseTo(5, 9);
  });
});
