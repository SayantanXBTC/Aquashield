/**
 * Procedural tree geometry for the forest layer.
 *
 * VISUAL DEMONSTRATION — like every other object in this world, trees are
 * drawn far larger than life: a "tree" here is ~0.9-1.8 scene units (≈ km)
 * tall, the same exaggeration that lets a 3 km town block read from the
 * mission-control camera. These are not real trees, not a species map and
 * not a canopy dataset.
 *
 * Each species returns two geometries that share one instance matrix array:
 * trunks (one flat brown material) and canopies (per-instance tinted). They
 * are split so instance colour varies the foliage without staining the wood.
 */
import { BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type TreeSpecies = "conifer" | "broadleaf" | "palm";

export interface TreeGeometry {
  trunk: BufferGeometry;
  canopy: BufferGeometry;
}

function place(geo: BufferGeometry, x: number, y: number, z: number, scale = 1, rotY = 0): BufferGeometry {
  const m = new Matrix4().makeRotationY(rotY);
  m.scale(new Vector3(scale, scale, scale));
  m.setPosition(x, y, z);
  geo.applyMatrix4(m);
  return geo;
}

/** Tall, narrow, three stacked skirts — reads as a spruce/fir stand. */
function conifer(): TreeGeometry {
  const trunk = place(new CylinderGeometry(0.035, 0.055, 0.55, 5), 0, 0.275, 0);
  const canopy = mergeGeometries([
    place(new ConeGeometry(0.3, 0.62, 7), 0, 0.62, 0),
    place(new ConeGeometry(0.23, 0.52, 7), 0, 0.95, 0),
    place(new ConeGeometry(0.14, 0.4, 7), 0, 1.24, 0),
  ])!;
  return { trunk, canopy };
}

/** Rounded, slightly lopsided crown — a broadleaf/mixed stand. */
function broadleaf(): TreeGeometry {
  const trunk = mergeGeometries([
    place(new CylinderGeometry(0.04, 0.07, 0.6, 5), 0, 0.3, 0),
    place(new CylinderGeometry(0.02, 0.03, 0.32, 4), 0.08, 0.62, 0.03, 1, 0.6),
  ])!;
  const canopy = mergeGeometries([
    place(new IcosahedronGeometry(0.33, 0), 0, 0.86, 0),
    place(new IcosahedronGeometry(0.22, 0), 0.16, 0.72, 0.1, 1, 1.1),
    place(new IcosahedronGeometry(0.19, 0), -0.14, 0.78, -0.09, 1, 2.2),
  ])!;
  return { trunk, canopy };
}

/** Bare leaning stem with a fan of fronds — the coastal fringe. */
function palm(): TreeGeometry {
  const trunk = place(new CylinderGeometry(0.03, 0.055, 0.95, 5), 0, 0.475, 0);
  trunk.rotateZ(0.12);
  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const frond = new ConeGeometry(0.075, 0.46, 4);
    frond.rotateX(Math.PI / 2.1);
    frond.rotateY((i / 6) * Math.PI * 2);
    frond.translate(Math.cos((i / 6) * Math.PI * 2) * 0.16, 0.93, Math.sin((i / 6) * Math.PI * 2) * 0.16);
    fronds.push(frond);
  }
  return { trunk, canopy: mergeGeometries(fronds)! };
}

const BUILDERS: Record<TreeSpecies, () => TreeGeometry> = { conifer, broadleaf, palm };

export function buildTreeGeometry(species: TreeSpecies): TreeGeometry {
  return BUILDERS[species]();
}
