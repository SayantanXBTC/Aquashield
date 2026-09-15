/**
 * Tints the basemap's 3D buildings by the hazard's exposure bands, for the
 * "real_map" world profile.
 *
 * The demo world colours its own placed structures (three/structures/
 * support.ts STATUS_COLOR). Here the buildings belong to the basemap, so the
 * same bands are applied as a data-driven paint expression instead:
 * MapLibre's `distance` operator gives each feature's distance in metres
 * from a GeoJSON point, and a `step` over that distance picks the band.
 *
 * ILLUSTRATIVE ONLY, exactly as CLAUDE.md §27 requires of the structural
 * response elsewhere: these are exposure bands around the hazard's own
 * radius, never a damage, collapse or casualty prediction. No building here
 * is assessed individually — the colour is a function of distance and
 * nothing else.
 */
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

/** Matches STATUS_COLOR in three/structures/support.ts. */
const BAND_SEVERE = "#b91c1c";
const BAND_IMPACTED = "#ef4444";
const BAND_AT_RISK = "#f59e0b";
/** The untouched basemap building colour. */
export const BUILDING_BASE_COLOR = "#9aa5b1";

/** Band edges as multiples of the hazard's current radius. */
const SEVERE_FRACTION = 0.45;
const AT_RISK_FRACTION = 1.7;

export function buildingColorExpression(centerLngLat: [number, number], radiusKm: number): ExpressionSpecification | string {
  if (radiusKm <= 0) return BUILDING_BASE_COLOR;
  const radiusM = radiusKm * 1000;
  const distance: ExpressionSpecification = ["distance", { type: "Point", coordinates: centerLngLat }];
  return [
    "step",
    distance,
    BAND_SEVERE,
    radiusM * SEVERE_FRACTION,
    BAND_IMPACTED,
    radiusM,
    BAND_AT_RISK,
    radiusM * AT_RISK_FRACTION,
    BUILDING_BASE_COLOR,
  ];
}

/** Applies the tint, or clears it when the hazard has no reach yet. Safe to
 * call before the layer exists (during style load, or after a teardown). */
export function applyBuildingExposure(map: MapLibreMap, layerId: string, centerLngLat: [number, number], radiusKm: number): void {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, "fill-extrusion-color", buildingColorExpression(centerLngLat, radiusKm));
}
