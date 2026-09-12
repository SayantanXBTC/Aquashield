/**
 * Where the forest grows.
 *
 * Deterministic placement over the demo land plate, driven by the same
 * procedural noise the terrain material paints its forest patches with
 * (worldNoise.ts), so the canopy sits on the green instead of over the whole
 * plate: dense in the inland patches, thinning on the dunes, absent on bare
 * rock, steep faces and the beach, with a palm fringe just behind the
 * shoreline. Every tree stands on the exact `terrainHeightKm` surface the
 * land mesh is built from.
 *
 * VISUAL DEMONSTRATION — scenery, not land-cover data. Nothing here feeds
 * simulation, exposure or the AI layer. Pure and side-effect free, so
 * forestPlacement.test.ts can assert the forest's shape without a GPU.
 */
import { Color } from "three";
import { shoreX, WORLD_KM } from "@/propagation/world";
import { kmToScene, landDepthKm, terrainHeightKm } from "@/three/world/demoWorld";
import { CANOPY_TINTS } from "./forestMaterial";
import type { TreeSpecies } from "./treeGeometry";
import { forestDensity, smoothstep } from "./worldNoise";

/** Candidate grid spacing in km. Smaller = denser forest, more instances. */
const SPACING_KM = 1.05;
/** How far inland trees are planted, past the shoreline. */
const INLAND_REACH_KM = 120;
/** Trees are cleared this far around a placed structure, so a town block
 * never renders inside a wood. */
export const STRUCTURE_CLEARING_KM = 7;
const MAX_TREES_PER_SPECIES = 5200;

export interface Placement {
  sceneX: number;
  sceneZ: number;
  y: number;
  xKm: number;
  yKm: number;
  scale: number;
  rotY: number;
  tint: Color;
}

/** Deterministic 0-1 hash of a grid cell. */
function cellHash(ix: number, iy: number, salt: number): number {
  let h = Math.imul(ix + 0x9e37, 0x85ebca6b) ^ Math.imul(iy + 0x165667, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Slope in the same units the terrain shader uses for its bare-rock mask:
 * `1 - normal.y`, derived here from the height gradient. Matching the
 * shader's units matters — a raw gradient reads an order of magnitude
 * larger and would mask the whole forest off as "too steep".
 */
function slopeAt(xKm: number, yKm: number): number {
  const h = terrainHeightKm(xKm, yKm);
  const gx = (terrainHeightKm(xKm + 0.5, yKm) - h) / 0.5;
  const gy = (terrainHeightKm(xKm, yKm + 0.5) - h) / 0.5;
  return 1 - 1 / Math.sqrt(1 + gx * gx + gy * gy);
}

export function buildPlacements(): Record<TreeSpecies, Placement[]> {
  const out: Record<TreeSpecies, Placement[]> = { conifer: [], broadleaf: [], palm: [] };
  const columns = Math.ceil(INLAND_REACH_KM / SPACING_KM);
  const rows = Math.ceil(WORLD_KM / SPACING_KM);

  for (let iy = 0; iy < rows; iy++) {
    const baseY = iy * SPACING_KM;
    for (let ix = 0; ix < columns; ix++) {
      const jitterX = (cellHash(ix, iy, 1) - 0.5) * SPACING_KM * 0.9;
      const jitterY = (cellHash(ix, iy, 2) - 0.5) * SPACING_KM * 0.9;
      const yKm = baseY + jitterY;
      if (yKm < 0 || yKm > WORLD_KM) continue;
      const xKm = shoreX(yKm) + 1.0 + ix * SPACING_KM + jitterX;
      if (xKm > WORLD_KM) continue;

      const depth = landDepthKm(xKm, yKm);
      if (depth < 0.8) continue; // beach and below stay bare
      const height = terrainHeightKm(xKm, yKm);
      const slope = slopeAt(xKm, yKm);

      // Density: the shader's forest patches, minus the bare-rock treatment
      // it applies on steep faces and the high ridge.
      const rock = Math.max(smoothstep(0.18, 0.42, slope), smoothstep(6.5, 9.5, height));
      const fringe = smoothstep(0.8, 2.2, depth) * (1 - smoothstep(3.5, 6.5, depth));
      let density = forestDensity(xKm, yKm, depth) * (1 - rock);
      // A thin palm fringe just behind the beach, independent of the patches.
      const palmChance = fringe * 0.35 * (1 - rock);
      const roll = cellHash(ix, iy, 3);

      let species: TreeSpecies;
      if (roll < palmChance) {
        species = "palm";
      } else {
        // Scrub the inland patches a little so edges feather instead of
        // stopping on the noise threshold.
        density *= 0.55 + 0.45 * cellHash(ix, iy, 4);
        if (roll > density) continue;
        species = height > 4.6 || slope > 0.22 ? "conifer" : cellHash(ix, iy, 5) > 0.42 ? "broadleaf" : "conifer";
      }

      const [sceneX, sceneZ] = kmToScene(xKm, yKm);
      const sizeRoll = cellHash(ix, iy, 6);
      out[species].push({
        sceneX,
        sceneZ,
        // Sink the base a touch so a trunk never shows daylight under it on
        // a slope.
        y: height - 0.06,
        xKm,
        yKm,
        scale: species === "palm" ? 1.15 + sizeRoll * 0.7 : 1.05 + Math.pow(sizeRoll, 0.75) * 1.5,
        rotY: cellHash(ix, iy, 7) * Math.PI * 2,
        tint: CANOPY_TINTS[Math.floor(cellHash(ix, iy, 8) * CANOPY_TINTS.length) % CANOPY_TINTS.length],
      });
    }
  }
  // Cap by thinning the stand evenly rather than by stopping early: a hard
  // cutoff mid-sweep would leave the north half of the world bare.
  (Object.keys(out) as TreeSpecies[]).forEach((species) => {
    const list = out[species];
    if (list.length <= MAX_TREES_PER_SPECIES) return;
    const stride = list.length / MAX_TREES_PER_SPECIES;
    const thinned: Placement[] = [];
    for (let i = 0; thinned.length < MAX_TREES_PER_SPECIES && Math.floor(i * stride) < list.length; i++) {
      thinned.push(list[Math.floor(i * stride)]);
    }
    out[species] = thinned;
  });
  return out;
}
