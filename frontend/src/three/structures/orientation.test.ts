import { describe, expect, it } from "vitest";
import { DEFAULT_SHORE, isLand, shoreX, type ShoreParams } from "@/propagation/world";
import { clampOriginToWater } from "@/three/markers/OriginPin";
import { shoreAlignedRotationY } from "./support";

// Same curve shape (and therefore the same tangent at every y) as
// DEFAULT_SHORE, only the land side flipped. Isolates the sign flip from any
// change in geometry: shoreAlignedRotationY's landSign branch is the only
// thing that can move the result, so the difference must be exactly pi at
// every y.
const SIGN_FLIPPED: ShoreParams = { ...DEFAULT_SHORE, landSign: -1 };

// A distinct, mirrored east-facing coastline — its curve is the mirror image
// of DEFAULT_SHORE's (not just a relabelling), so "on land"/"on water" fall
// on the opposite side of the world. Used below for the origin-clamp tests,
// which need a genuinely different coastline position, not just a sign flip.
const EAST_FACING: ShoreParams = {
  baseXKm: 300 - DEFAULT_SHORE.baseXKm,
  terms: DEFAULT_SHORE.terms.map((t) => ({ amp: -t.amp, freq: t.freq, phase: t.phase })),
  landSign: -1,
};

const TWO_PI = Math.PI * 2;
const wrap = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

describe("shore-aligned rotation", () => {
  it("faces the opposite way when the land side flips", () => {
    for (const y of [40, 150, 260]) {
      const west = shoreAlignedRotationY(y);
      const east = shoreAlignedRotationY(y, SIGN_FLIPPED);
      expect(wrap(east - west)).toBeCloseTo(Math.PI, 6);
    }
  });
});

describe("origin clamp", () => {
  // Calls the real clamp used by markers/OriginPin.tsx's drag handler, so
  // this proves the component's actual behaviour rather than a
  // re-implementation of the rule.
  it("pushes west on a west-facing coast", () => {
    const y = 150;
    const onLand = shoreX(y) + 5;
    const [clampedX] = clampOriginToWater(onLand, y, DEFAULT_SHORE);
    expect(clampedX).toBeLessThan(shoreX(y));
    expect(isLand(clampedX, y)).toBe(false);
  });

  it("pushes east on an east-facing coast", () => {
    const y = 150;
    const onLand = shoreX(y, EAST_FACING) - 5;
    const [clampedX] = clampOriginToWater(onLand, y, EAST_FACING);
    expect(clampedX).toBeGreaterThan(shoreX(y, EAST_FACING));
    expect(isLand(clampedX, y, EAST_FACING)).toBe(false);
  });
});
