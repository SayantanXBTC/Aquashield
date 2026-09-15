/**
 * The real-coast march must never invent a distance. These pin the three
 * outcomes that matter: a measured crossing, an unmeasurable path (the
 * samples left the rendered viewport), and an origin already on land.
 */
import { describe, expect, it } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { measureCoastDistanceKm } from "./mapCoast";
import { kmToLngLat, type GeoAnchor } from "./geoAnchor";

const ANCHOR: GeoAnchor = { lat: 18.9388, lon: 72.8354 };
const ORIGIN: [number, number] = [150, 150];

/**
 * A map whose water polygons cover everything west of `coastLon`, and whose
 * rendered viewport spans `visibleLonSpan` degrees either side of the anchor.
 * Screen space is faked as a linear function of longitude/latitude, which is
 * all `measureCoastDistanceKm` needs: it only asks "is this point on screen"
 * and "what is rendered here".
 */
function fakeMap(coastLon: number, visibleLonSpan = 10): MapLibreMap {
  const width = 1000;
  const height = 1000;
  const lonToX = (lon: number) => ((lon - (ANCHOR.lon - visibleLonSpan)) / (2 * visibleLonSpan)) * width;
  return {
    getStyle: () => ({ layers: [{ id: "water", type: "fill", "source-layer": "water" }] }),
    getLayer: (id: string) => (id === "water" ? {} : undefined),
    getCanvas: () => ({ clientWidth: width, clientHeight: height }),
    project: ([lon]: [number, number]) => ({ x: lonToX(lon), y: height / 2 }),
    queryRenderedFeatures: (point: { x: number }) => {
      const lon = ANCHOR.lon - visibleLonSpan + (point.x / width) * 2 * visibleLonSpan;
      return lon < coastLon ? [{ id: 1 }] : [];
    },
  } as unknown as MapLibreMap;
}

/** Longitude of a point `km` east of the origin, in the same frame the
 * measurement walks. */
function lonEastOfOrigin(km: number): number {
  return kmToLngLat(ORIGIN[0] + km, ORIGIN[1], ANCHOR)[0];
}

describe("measureCoastDistanceKm", () => {
  it("measures the crossing when the whole path is rendered", () => {
    const coastLon = lonEastOfOrigin(20);
    const result = measureCoastDistanceKm(fakeMap(coastLon), ANCHOR, ORIGIN, 90);
    expect(result.reason).toBe("measured");
    expect(result.distanceKm).toBeCloseTo(20, 1);
  });

  it("reports off_screen rather than a distance when the path leaves the view", () => {
    // Coast is 80 km east, but only ~2 km of the path is on screen.
    const coastLon = lonEastOfOrigin(80);
    const narrow = fakeMap(coastLon, 0.02);
    const result = measureCoastDistanceKm(narrow, ANCHOR, ORIGIN, 90);
    expect(result.reason).toBe("off_screen");
    expect(result.distanceKm).toBeNull();
  });

  it("returns 0 when the origin is already on land", () => {
    // Water only far to the west, so the origin itself is land.
    const result = measureCoastDistanceKm(fakeMap(ANCHOR.lon - 5), ANCHOR, ORIGIN, 90);
    expect(result.reason).toBe("on_land");
    expect(result.distanceKm).toBe(0);
  });

  it("cannot measure without a water layer in the style", () => {
    const styleless = { getStyle: () => ({ layers: [] }) } as unknown as MapLibreMap;
    const result = measureCoastDistanceKm(styleless, ANCHOR, ORIGIN, 90);
    expect(result.reason).toBe("no_water_layer");
    expect(result.distanceKm).toBeNull();
  });
});
