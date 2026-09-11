import { describe, expect, it } from "vitest";
import { clampProgress, getActiveIndex, getSceneDrift, getSceneOpacity, getSceneScale } from "./sceneProgress";

describe("clampProgress", () => {
  it("clamps below 0 and above 1", () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(1.5)).toBe(1);
  });

  it("passes NaN through as 0", () => {
    expect(clampProgress(Number.NaN)).toBe(0);
  });
});

describe("getActiveIndex", () => {
  it("returns the first scene at progress 0", () => {
    expect(getActiveIndex(0, 6)).toBe(0);
  });

  it("returns the last scene at progress 1 (no out-of-range index)", () => {
    expect(getActiveIndex(1, 6)).toBe(5);
  });

  it("returns the middle scene mid-scroll", () => {
    expect(getActiveIndex(0.5, 6)).toBe(3);
  });
});

describe("getSceneOpacity", () => {
  it("first scene starts fully opaque", () => {
    expect(getSceneOpacity(0, 0, 6)).toBeCloseTo(1);
  });

  it("last scene ends fully opaque", () => {
    expect(getSceneOpacity(1, 5, 6)).toBeCloseTo(1);
  });

  it("a scene is fully opaque at the center of its own band", () => {
    const band = 1 / 6;
    const center = 2 * band + band / 2;
    expect(getSceneOpacity(center, 2, 6)).toBeCloseTo(1);
  });

  it("crossfades continuously across a boundary (no hard cut)", () => {
    // Sampled mid-way through the shared transition window that straddles
    // the boundary, not the boundary itself — the outgoing scene's fade
    // completes exactly at the boundary by design (see TRANSITION_FRACTION).
    const band = 1 / 6;
    const boundary = band;
    const midTransition = boundary - (band * 0.45) / 2;
    const outgoing = getSceneOpacity(midTransition, 0, 6);
    const incoming = getSceneOpacity(midTransition, 1, 6);
    expect(outgoing).toBeGreaterThan(0);
    expect(outgoing).toBeLessThan(1);
    expect(incoming).toBeGreaterThan(0);
    expect(incoming).toBeLessThan(1);
  });

  it("a scene far from progress is fully transparent", () => {
    expect(getSceneOpacity(0.02, 5, 6)).toBeCloseTo(0);
  });
});

describe("getSceneScale", () => {
  it("starts at `from` when entering its band", () => {
    expect(getSceneScale(2 / 6, 2, 6, 1.08, 1)).toBeCloseTo(1.08);
  });

  it("reaches `to` at the end of its band", () => {
    expect(getSceneScale(3 / 6, 2, 6, 1.08, 1)).toBeCloseTo(1);
  });

  it("clamps past its band rather than overshooting", () => {
    expect(getSceneScale(1, 0, 6, 1.08, 1)).toBeCloseTo(1);
  });
});

describe("getSceneDrift", () => {
  it("is maximal entering the band and settles to 0 by the end", () => {
    expect(getSceneDrift(0, 0, 6, 24)).toBeCloseTo(24);
    expect(getSceneDrift(1 / 6, 0, 6, 24)).toBeCloseTo(0);
  });
});
