import { describe, expect, it } from "vitest";
import { rampColor } from "./colorRamp";

describe("rampColor", () => {
  it("returns the first color at t=0 and the second at t=1", () => {
    expect(rampColor("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(rampColor("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });

  it("clamps t outside [0, 1]", () => {
    expect(rampColor("#ff0000", "#0000ff", -5)).toBe("#ff0000");
    expect(rampColor("#ff0000", "#0000ff", 5)).toBe("#0000ff");
  });
});
