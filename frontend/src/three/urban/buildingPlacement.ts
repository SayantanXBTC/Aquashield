/**
 * Where the Dense Coastal Profile's generic buildings sit.
 *
 * Deterministic, procedural placement over a flat band inland from the demo
 * shoreline — denser near the coast, thinning inland — mirroring
 * three/vegetation/forestPlacement.ts's technique exactly. This module only
 * ever renders under the "dense_coastal" world profile, so it hardcodes the
 * flat terrain surface rather than threading a `flat` parameter through.
 *
 * VISUAL DEMONSTRATION — a fictional, generic coastal-town silhouette, never
 * a real place, never real building footprints. Nothing here feeds
 * simulation, exposure or the AI layer; exposure tinting (DenseBuildingLayer)
 * reads the same exposureFor()/statusFor() functions named structures use,
 * computed separately per frame. Pure and side-effect free, so
 * buildingPlacement.test.ts can assert its shape without a GPU.
 */
import { shoreX, WORLD_KM } from "@/propagation/world";
import { kmToScene, landDepthKm, terrainHeightKm } from "@/three/world/demoWorld";
import { STRUCTURE_CLEARING_KM } from "@/three/vegetation/forestPlacement";

export { STRUCTURE_CLEARING_KM as BUILDING_CLEARING_KM };

export type BuildingClass = "low" | "mid" | "highrise";

/** Candidate grid spacing in km — denser than the forest grid since a town
 * block reads smaller than tree canopies. */
const SPACING_KM = 0.85;
/** How far inland buildings are planted, past the shoreline — a compact
 * coastal corridor, not the forest's full 120 km reach. */
const INLAND_REACH_KM = 32;
const MAX_PER_CLASS = 700;

export interface Placement {
  sceneX: number;
  sceneZ: number;
  y: number;
  xKm: number;
  yKm: number;
  scale: number;
  rotY: number;
}

/** Deterministic 0-1 hash of a grid cell (same technique as
 * forestPlacement.ts's cellHash — independent implementation so this module
 * has no compile-time dependency on vegetation internals). */
function cellHash(ix: number, iy: number, salt: number): number {
  let h = Math.imul(ix + 0x2c1b3c6d, 0x85ebca6b) ^ Math.imul(iy + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function classify(depth: number, roll: number): BuildingClass {
  // Taller buildings cluster near the shore (a coastal corridor silhouette),
  // low buildings dominate further inland.
  const highriseChance = 0.32 * Math.max(0, 1 - depth / 14);
  const midChance = 0.4;
  if (roll < highriseChance) return "highrise";
  if (roll < highriseChance + midChance) return "mid";
  return "low";
}

const CLASS_SCALE: Record<BuildingClass, [number, number]> = {
  low: [1.0, 1.8],
  mid: [2.2, 3.4],
  highrise: [4.0, 7.5],
};

/** Builds a deterministic, capped set of generic building placements for the
 * Dense Coastal Profile. `clearings` are placed named structures — no
 * building renders within BUILDING_CLEARING_KM of one. */
export function buildBuildingPlacements(clearings: { xKm: number; yKm: number }[]): Record<BuildingClass, Placement[]> {
  const out: Record<BuildingClass, Placement[]> = { low: [], mid: [], highrise: [] };
  const columns = Math.ceil(INLAND_REACH_KM / SPACING_KM);
  const rows = Math.ceil(WORLD_KM / SPACING_KM);

  for (let iy = 0; iy < rows; iy++) {
    const baseY = iy * SPACING_KM;
    for (let ix = 0; ix < columns; ix++) {
      const jitterX = (cellHash(ix, iy, 1) - 0.5) * SPACING_KM * 0.85;
      const jitterY = (cellHash(ix, iy, 2) - 0.5) * SPACING_KM * 0.85;
      const yKm = baseY + jitterY;
      if (yKm < 0 || yKm > WORLD_KM) continue;
      const xKm = shoreX(yKm) + 1.4 + ix * SPACING_KM + jitterX;
      if (xKm > WORLD_KM) continue;

      const depth = landDepthKm(xKm, yKm);
      if (depth < 1.2) continue; // beach stays bare

      if (clearings.some((c) => Math.hypot(c.xKm - xKm, c.yKm - yKm) < STRUCTURE_CLEARING_KM)) continue;

      // Density thins with distance from shore, feathered rather than a
      // hard cutoff at INLAND_REACH_KM.
      const density = 0.6 * (1 - Math.min(1, depth / INLAND_REACH_KM)) + 0.05;
      const roll = cellHash(ix, iy, 3);
      if (roll > density) continue;

      const cls = classify(depth, cellHash(ix, iy, 4));
      const [minScale, maxScale] = CLASS_SCALE[cls];
      const sizeRoll = cellHash(ix, iy, 5);
      const [sceneX, sceneZ] = kmToScene(xKm, yKm);
      out[cls].push({
        sceneX,
        sceneZ,
        y: terrainHeightKm(xKm, yKm, true),
        xKm,
        yKm,
        scale: minScale + sizeRoll * (maxScale - minScale),
        rotY: cellHash(ix, iy, 6) * Math.PI * 2,
      });
    }
  }

  // Cap by thinning each class evenly, same rationale as
  // forestPlacement.ts's MAX_TREES_PER_SPECIES: a hard cutoff mid-sweep
  // would leave the north half of the corridor bare.
  (Object.keys(out) as BuildingClass[]).forEach((cls) => {
    const list = out[cls];
    if (list.length <= MAX_PER_CLASS) return;
    const stride = list.length / MAX_PER_CLASS;
    const thinned: Placement[] = [];
    for (let i = 0; thinned.length < MAX_PER_CLASS && Math.floor(i * stride) < list.length; i++) {
      thinned.push(list[Math.floor(i * stride)]);
    }
    out[cls] = thinned;
  });
  return out;
}
