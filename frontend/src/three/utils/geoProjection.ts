/**
 * Lat/lon -> local scene-space (x, z) projection for VISUAL PLACEMENT ONLY.
 *
 * This is not a geospatial/GIS transform — it is a small equirectangular
 * approximation (same order of approximation as simulation/core/geo.py's
 * server-side great-circle math, reused here purely so a hazard's real
 * lat/lon moves a marker in a believable direction/proportion relative to
 * the scenario's origin). PostGIS remains the source of truth for real
 * geospatial application data (architecture.md §14a) — nothing here is
 * scientific terrain or a real-world coordinate system.
 */

const KM_PER_DEGREE_LAT = 111.32;
/** Scene units per kilometer — keeps a ~50km hazard radius inside a scene a
 * few dozen units across instead of literally hundreds of units wide. */
export const SCENE_UNITS_PER_KM = 0.12;

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface ScenePosition {
  x: number;
  z: number;
}

/** Projects `point` relative to `origin`, in scene units. +z is south,
 * +x is east — an arbitrary but consistent convention across every
 * disaster visualizer and marker. */
export function projectToScene(origin: LatLon, point: LatLon): ScenePosition {
  const kmPerDegreeLon = KM_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  const dxKm = (point.longitude - origin.longitude) * kmPerDegreeLon;
  const dzKm = (point.latitude - origin.latitude) * KM_PER_DEGREE_LAT;
  return { x: dxKm * SCENE_UNITS_PER_KM, z: -dzKm * SCENE_UNITS_PER_KM };
}

export function kmToSceneUnits(km: number): number {
  return km * SCENE_UNITS_PER_KM;
}
