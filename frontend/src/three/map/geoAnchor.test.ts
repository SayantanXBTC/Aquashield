import { describe, expect, it } from "vitest";
import { WORLD_KM } from "@/propagation/world";
import { kmToLngLat, lngLatToKm, type GeoAnchor } from "./geoAnchor";

const MUMBAI: GeoAnchor = { lat: 18.9388, lon: 72.8354 };
const WORLD_CENTER_KM = WORLD_KM / 2;

describe("geoAnchor", () => {
  it("maps the world centre exactly onto the anchor", () => {
    const [lon, lat] = kmToLngLat(WORLD_CENTER_KM, WORLD_CENTER_KM, MUMBAI);
    expect(lon).toBeCloseTo(MUMBAI.lon, 9);
    expect(lat).toBeCloseTo(MUMBAI.lat, 9);
  });

  it("round-trips km -> lng/lat -> km across the world square", () => {
    for (const [xKm, yKm] of [
      [0, 0],
      [300, 300],
      [150, 150],
      [42.5, 271.3],
      [299.9, 0.1],
    ]) {
      const [lon, lat] = kmToLngLat(xKm, yKm, MUMBAI);
      const [x2, y2] = lngLatToKm(lon, lat, MUMBAI);
      expect(x2).toBeCloseTo(xKm, 6);
      expect(y2).toBeCloseTo(yKm, 6);
    }
  });

  it("moves east for increasing x and north for increasing y", () => {
    const [lonBase, latBase] = kmToLngLat(WORLD_CENTER_KM, WORLD_CENTER_KM, MUMBAI);
    const [lonEast] = kmToLngLat(WORLD_CENTER_KM + 10, WORLD_CENTER_KM, MUMBAI);
    const [, latNorth] = kmToLngLat(WORLD_CENTER_KM, WORLD_CENTER_KM + 10, MUMBAI);
    expect(lonEast).toBeGreaterThan(lonBase);
    expect(latNorth).toBeGreaterThan(latBase);
  });

  it("scales longitude degrees by latitude (a degree of longitude shrinks away from the equator)", () => {
    const equator: GeoAnchor = { lat: 0, lon: 0 };
    const highLat: GeoAnchor = { lat: 60, lon: 0 };
    const [lonAtEquator] = kmToLngLat(WORLD_CENTER_KM + 10, WORLD_CENTER_KM, equator);
    const [lonAtHighLat] = kmToLngLat(WORLD_CENTER_KM + 10, WORLD_CENTER_KM, highLat);
    // Same eastward km offset should correspond to a larger longitude swing
    // the further from the equator cos(lat) shrinks the metres-per-degree.
    expect(Math.abs(lonAtHighLat)).toBeGreaterThan(Math.abs(lonAtEquator));
  });
});
