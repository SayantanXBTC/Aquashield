import { describe, expect, it } from "vitest";
import { LANDING_BEATS } from "./landingAssets";

describe("LANDING_BEATS", () => {
  it("maps exactly the six provided assets, one beat each", () => {
    expect(LANDING_BEATS).toHaveLength(6);
  });

  it("gives every beat a real image source, alt text, and copy", () => {
    for (const beat of LANDING_BEATS) {
      expect(beat.src).toBeTruthy();
      expect(beat.alt.length).toBeGreaterThan(10);
      expect(beat.headline.length).toBeGreaterThan(0);
      expect(beat.body.length).toBeGreaterThan(0);
    }
  });

  it("covers the five canonical disaster categories plus the opening beat", () => {
    const eyebrows = LANDING_BEATS.map((beat) => beat.eyebrow);
    expect(eyebrows).toEqual([
      "AQUASHIELD",
      "Cyclone",
      "Tsunami",
      "Flood",
      "Marine Pollution",
      "Search & Rescue",
    ]);
  });

  it("has no duplicate image sources", () => {
    const sources = new Set(LANDING_BEATS.map((beat) => beat.src));
    expect(sources.size).toBe(LANDING_BEATS.length);
  });
});
