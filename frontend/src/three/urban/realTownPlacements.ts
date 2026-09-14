/**
 * Real building placements for a curated city (architecture.md ADR-009) —
 * the DATA SOURCE variant of buildingPlacement.ts's fictional procedural
 * generator. Rendering (DenseBuildingLayer) is identical either way; only
 * where the `Placement[]` comes from differs.
 *
 * VISUAL DEMONSTRATION — real coastline/building geometry, still the same
 * simplified demo physics/exposure model as everywhere else in the app.
 */
import type { TownProfile } from "@shared/types";
import { terrainHeightKm, kmToScene } from "@/three/world/demoWorld";
import { BUILDING_CLEARING_KM, type BuildingClass, type Placement } from "./buildingPlacement";

export function placementsFromTown(town: TownProfile, clearings: { xKm: number; yKm: number }[]): Record<BuildingClass, Placement[]> {
  const shore = { baseXKm: town.shore_base_x_km, terms: town.shore_terms, landSign: 1 };
  const out: Record<BuildingClass, Placement[]> = { low: [], mid: [], highrise: [] };
  for (const b of town.buildings) {
    if (clearings.some((c) => Math.hypot(c.xKm - b.xKm, c.yKm - b.yKm) < BUILDING_CLEARING_KM)) continue;
    const [sceneX, sceneZ] = kmToScene(b.xKm, b.yKm);
    out[b.cls].push({ sceneX, sceneZ, y: terrainHeightKm(b.xKm, b.yKm, true, shore), xKm: b.xKm, yKm: b.yKm, scale: b.scale, rotY: b.rotY });
  }
  return out;
}
