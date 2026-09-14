import { describe, expect, it } from "vitest";
import { EXPOSURE_AT_RISK, EXPOSURE_CLEAR, EXPOSURE_IMPACTED } from "@/propagation/structures";
import { collapseTarget, createDamageState, pieceFailure, stressTarget, updateDamageState } from "./collapse";

/**
 * These assertions are the guardrail, not just coverage: the structural
 * response is an illustration of the exposure band (CLAUDE.md §25), so it
 * must stay tied to the band's own thresholds and must stay reversible.
 */
describe("structural response", () => {
  it("maps failure onto the exposure bands", () => {
    expect(collapseTarget(0, "cyclone")).toBe(0);
    expect(collapseTarget(EXPOSURE_AT_RISK, "cyclone")).toBe(0);
    // The `impacted` band breaks a structure up…
    expect(collapseTarget(EXPOSURE_AT_RISK + 0.01, "cyclone")).toBeGreaterThan(0);
    expect(collapseTarget(EXPOSURE_IMPACTED - 0.001, "cyclone")).toBeLessThan(1);
    // …and `severe` finishes it.
    expect(collapseTarget(EXPOSURE_IMPACTED, "cyclone")).toBeGreaterThan(collapseTarget(EXPOSURE_AT_RISK + 0.1, "cyclone"));
    expect(collapseTarget(1, "cyclone")).toBe(1);
    // Monotonic across the whole range.
    let previous = -1;
    for (let e = 0; e <= 1.0001; e += 0.02) {
      const value = collapseTarget(e, "cyclone");
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("shows real scenarios failing rather than standing untouched", () => {
    // A demo tsunami peaks near 0.47 exposure and a demo cyclone near 0.66 —
    // both inside `impacted`. If those read as intact, the illustration is
    // telling the operator the hazard missed.
    expect(collapseTarget(0.47, "tsunami")).toBeGreaterThan(0.3);
    expect(collapseTarget(0.66, "cyclone")).toBeGreaterThan(0.6);
  });

  it("leans through the at_risk band, before anything fails", () => {
    expect(stressTarget(EXPOSURE_CLEAR, "tsunami")).toBe(0);
    expect(stressTarget((EXPOSURE_CLEAR + EXPOSURE_AT_RISK) / 2, "tsunami")).toBeCloseTo(0.5, 1);
    expect(stressTarget(EXPOSURE_AT_RISK, "tsunami")).toBe(1);
  });

  it("never collapses a structure for an oil slick, or with no hazard", () => {
    expect(collapseTarget(1, "oil_spill")).toBe(0);
    expect(collapseTarget(1, null)).toBe(0);
    expect(stressTarget(1, null)).toBe(0);
  });

  it("recovers when the timeline is scrubbed back", () => {
    const state = createDamageState();
    for (let i = 0; i < 200; i++) updateDamageState(state, 1, "cyclone", 1 / 60, i / 60);
    expect(state.collapse).toBeGreaterThan(0.9);
    // The operator scrubs back to a frame the hazard had not reached.
    for (let i = 0; i < 200; i++) updateDamageState(state, 0, "cyclone", 1 / 60, i / 60);
    expect(state.collapse).toBeLessThan(0.02);
    expect(state.stress).toBeLessThan(0.02);
  });

  it("gives each piece stable failure parameters", () => {
    const a = pieceFailure("town-block-1", 3);
    const b = pieceFailure("town-block-1", 3);
    const c = pieceFailure("town-block-1", 4);
    expect(a).toEqual(b);
    expect(a.heading).not.toBe(c.heading);
    expect(a.delay).toBeGreaterThanOrEqual(0);
    expect(a.delay).toBeLessThanOrEqual(0.32);
  });
});
