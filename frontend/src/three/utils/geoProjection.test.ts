import { describe, expect, it } from "vitest";
import { kmToSceneUnits, projectToScene } from "./geoProjection";

describe("projectToScene", () => {
  it("places the origin itself at (0, 0)", () => {
    const origin = { latitude: 10, longitude: 20 };
    const pos = projectToScene(origin, origin);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(0);
  });

  it("moves a point north to negative z", () => {
    const origin = { latitude: 10, longitude: 20 };
    const north = { latitude: 10.5, longitude: 20 };
    const pos = projectToScene(origin, north);
    expect(pos.z).toBeLessThan(0);
    expect(pos.x).toBeCloseTo(0);
  });

  it("moves a point east to positive x", () => {
    const origin = { latitude: 10, longitude: 20 };
    const east = { latitude: 10, longitude: 20.5 };
    const pos = projectToScene(origin, east);
    expect(pos.x).toBeGreaterThan(0);
  });
});

describe("kmToSceneUnits", () => {
  it("scales linearly", () => {
    expect(kmToSceneUnits(10)).toBeCloseTo(kmToSceneUnits(5) * 2);
  });
});
