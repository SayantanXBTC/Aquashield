/**
 * Projection boundary between the simulation's km-frame and real geographic
 * coordinates — the ONLY place that translation happens (CLAUDE.md's
 * "real_map" world profile). The simulation, fixtures, agents and exposure
 * code all keep speaking the km frame (x=east, y=north, world centred at
 * (150, 150) — same axes as propagation/world.ts's heading convention)
 * unchanged; this module exists purely at the render boundary.
 *
 * A local equirectangular approximation about the anchor lat/lon: the world
 * is 300 km across (WORLD_KM), small enough that ignoring Earth's curvature
 * within it matches how the existing synthetic-world `to_local_km` mapping
 * already worked. Do not reuse this for anything beyond that render layer —
 * it is deliberately not geodesically accurate at larger scales.
 */
import { WORLD_KM } from "@/propagation/world";

export interface GeoAnchor {
  lat: number;
  lon: number;
}

const METERS_PER_DEG_LAT = 110574;
const WORLD_CENTER_KM = WORLD_KM / 2;

function metersPerDegLon(atLat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180);
}

/** km-frame (x=east, y=north) -> [lng, lat], for placing a km-frame point on
 * the real map. */
export function kmToLngLat(xKm: number, yKm: number, anchor: GeoAnchor): [number, number] {
  const eastKm = xKm - WORLD_CENTER_KM;
  const northKm = yKm - WORLD_CENTER_KM;
  const lon = anchor.lon + (eastKm * 1000) / metersPerDegLon(anchor.lat);
  const lat = anchor.lat + (northKm * 1000) / METERS_PER_DEG_LAT;
  return [lon, lat];
}

/** Inverse of kmToLngLat — real [lng, lat] -> km-frame (x=east, y=north). */
export function lngLatToKm(lng: number, lat: number, anchor: GeoAnchor): [number, number] {
  const eastKm = ((lng - anchor.lon) * metersPerDegLon(anchor.lat)) / 1000;
  const northKm = ((lat - anchor.lat) * METERS_PER_DEG_LAT) / 1000;
  return [WORLD_CENTER_KM + eastKm, WORLD_CENTER_KM + northKm];
}
