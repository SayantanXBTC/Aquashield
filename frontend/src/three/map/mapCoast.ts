/**
 * Real land/sea tests read from the basemap's own water polygons, for the
 * "real_map" world profile.
 *
 * The synthetic demo world decides land with an analytic sine curve
 * (propagation/world.ts). On a real basemap that curve is fiction: it would
 * stop a tsunami 150 km from an origin at a coastline that does not exist in
 * the city underneath. This module answers the same question —
 * "is this point land, and how far to the coast along a heading" — from the
 * vector tiles MapLibre has already drawn.
 *
 * LIMITS, and they are real:
 *   - `queryRenderedFeatures` only sees what is currently RENDERED. A sample
 *     outside the viewport, or in a tile that has not arrived, cannot be
 *     classified, and the march reports `null` (unknown) rather than
 *     guessing. Zooming out until the whole path is visible is what makes a
 *     long march measurable.
 *   - Water polygons are cartographic, not a bathymetric or hydrographic
 *     product. This is a better approximation of the real coast than a sine
 *     wave, not a survey.
 *
 * The hazard model itself is unchanged and still a SIMPLIFIED DEMONSTRATION
 * MODEL — this only replaces where its shoreline is.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import { headingVector, round4 } from "@/propagation/world";
import { kmToLngLat, type GeoAnchor } from "./geoAnchor";

/** OpenMapTiles puts every ocean/sea/lake/river polygon in one source layer. */
const WATER_SOURCE_LAYER = "water";

const DEFAULT_STEP_KM = 0.5;
const DEFAULT_MAX_KM = 300;
const BISECT_STEPS = 12;

/** Ids of the style's filled water layers. Recomputed per call rather than
 * cached: a style can finish loading, and layers can be added, after the map
 * first reports ready. */
export function waterLayerIds(map: MapLibreMap): string[] {
  const style = map.getStyle();
  if (!style?.layers) return [];
  return style.layers
    .filter((layer) => {
      if (layer.type !== "fill") return false;
      return "source-layer" in layer && layer["source-layer"] === WATER_SOURCE_LAYER;
    })
    .map((layer) => layer.id)
    .filter((id) => map.getLayer(id) !== undefined);
}

/** true = water, false = land, null = cannot tell (off-screen, or the tile
 * covering it is not rendered). Never guesses. */
export function isWaterAt(map: MapLibreMap, lng: number, lat: number, layers: string[]): boolean | null {
  if (layers.length === 0) return null;
  const point = map.project([lng, lat]);
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  // A point behind the camera or outside the viewport has nothing rendered
  // to query. Treat the margin as unknown too — features are clipped at the
  // edge and a hit there is unreliable.
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (point.x < 1 || point.y < 1 || point.x > width - 1 || point.y > height - 1) return null;
  return map.queryRenderedFeatures(point, { layers }).length > 0;
}

export interface CoastMeasurement {
  /** Distance in km from the origin to the first land along the heading,
   * 0 if the origin is already on land, or null if the path could not be
   * classified within the rendered viewport. */
  distanceKm: number | null;
  /** Why a null came back, for the operator — never a fabricated distance. */
  reason: "measured" | "on_land" | "off_screen" | "no_land_in_range" | "no_water_layer";
}

/**
 * Marches from a km-frame origin along a compass heading and returns the
 * distance to the first land, measured against the basemap's water polygons.
 *
 * Same march shape as `distanceToCoastAlongHeading` in propagation/world.ts
 * (fixed step, then a bisection to refine the crossing), so the two produce
 * comparable numbers — only the land test differs.
 */
export function measureCoastDistanceKm(
  map: MapLibreMap,
  anchor: GeoAnchor,
  originKm: [number, number],
  headingDeg: number,
  maxKm: number = DEFAULT_MAX_KM,
  stepKm: number = DEFAULT_STEP_KM,
): CoastMeasurement {
  const layers = waterLayerIds(map);
  if (layers.length === 0) return { distanceKm: null, reason: "no_water_layer" };

  const [dx, dy] = headingVector(headingDeg);

  const isLandAt = (km: number): boolean | null => {
    const [lng, lat] = kmToLngLat(originKm[0] + dx * km, originKm[1] + dy * km, anchor);
    const water = isWaterAt(map, lng, lat, layers);
    return water === null ? null : !water;
  };

  const atOrigin = isLandAt(0);
  if (atOrigin === null) return { distanceKm: null, reason: "off_screen" };
  if (atOrigin) return { distanceKm: 0, reason: "on_land" };

  let traveled = 0;
  while (traveled < maxKm) {
    const next = traveled + stepKm;
    const land = isLandAt(next);
    // The path left the rendered area before reaching land: unknown, not
    // "no land". Saying 300 km here would be the same fiction as the sine.
    if (land === null) return { distanceKm: null, reason: "off_screen" };
    if (land) {
      let lo = traveled;
      let hi = next;
      for (let i = 0; i < BISECT_STEPS; i++) {
        const mid = 0.5 * (lo + hi);
        const midLand = isLandAt(mid);
        if (midLand === null) break;
        if (midLand) hi = mid;
        else lo = mid;
      }
      return { distanceKm: round4(hi), reason: "measured" };
    }
    traveled = next;
  }
  return { distanceKm: null, reason: "no_land_in_range" };
}
