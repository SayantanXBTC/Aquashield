import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, MeshStandardMaterial, Matrix4, Quaternion, Vector3 } from "three";
import type { StructureConfig } from "@shared/types";
import {
  hazardChannel,
  HAZARD_KIND_CYCLONE,
  HAZARD_KIND_FLOOD,
  HAZARD_KIND_NONE,
  HAZARD_KIND_TSUNAMI,
} from "@/three/hazard/hazardChannel";
import { applyForestShader, forestUniforms, type ForestUniforms } from "./forestMaterial";
import { buildPlacements, STRUCTURE_CLEARING_KM, type Placement } from "./forestPlacement";
import { buildTreeGeometry, type TreeSpecies } from "./treeGeometry";

/**
 * VISUAL DEMONSTRATION VEGETATION — the forest that covers the demo land
 * plate.
 *
 * Trees are planted by the same procedural noise the terrain material uses to
 * paint its forest patches (three/vegetation/worldNoise.ts), so the canopy
 * sits on the green rather than over the whole plate: dense in the inland
 * patches, thinning on the dunes, absent on bare rock, steep faces and the
 * beach, with a palm fringe just behind the shoreline. Every tree stands on
 * the exact `terrainHeightKm` surface the land mesh is built from.
 *
 * This is scenery. It is not land-cover data, not a canopy model, and nothing
 * about it feeds simulation, exposure or the AI layer. Like every other
 * object in this world it is drawn far larger than life so it reads from the
 * mission-control camera.
 *
 * Rendering: three InstancedMesh pairs (trunks + canopies, one pair per
 * species) — six draw calls for the whole forest. Sway and the hazard's
 * effect on the canopy live in the vertex shader (forestMaterial.ts), so the
 * per-frame cost on the CPU is writing a handful of uniforms.
 */

interface SpeciesStandProps {
  species: TreeSpecies;
  placements: Placement[];
  clearings: { xKm: number; yKm: number }[];
  uniforms: ForestUniforms;
}

function SpeciesStand({ species, placements, clearings, uniforms }: SpeciesStandProps) {
  const trunkRef = useRef<InstancedMesh>(null);
  const canopyRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => buildTreeGeometry(species), [species]);
  const materials = useMemo(() => {
    const trunk = applyForestShader(new MeshStandardMaterial({ color: "#4a3a2b", roughness: 0.95, metalness: 0 }), uniforms, "trunk");
    const canopy = applyForestShader(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, metalness: 0, flatShading: true }), uniforms, "canopy");
    return { trunk, canopy };
  }, [uniforms]);

  useEffect(
    () => () => {
      geometry.trunk.dispose();
      geometry.canopy.dispose();
      materials.trunk.dispose();
      materials.canopy.dispose();
    },
    [geometry, materials],
  );

  // Write the instance transforms. Re-runs when a structure moves, so the
  // clearing around it follows — a cleared tree is scaled to zero rather than
  // removed, which keeps the instance count (and the buffers) stable.
  useEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);

    placements.forEach((p, i) => {
      const cleared = clearings.some((c) => Math.hypot(c.xKm - p.xKm, c.yKm - p.yKm) < STRUCTURE_CLEARING_KM);
      position.set(p.sceneX, p.y, p.sceneZ);
      quaternion.setFromAxisAngle(up, p.rotY);
      scale.setScalar(cleared ? 0 : p.scale);
      matrix.compose(position, quaternion, scale);
      trunk.setMatrixAt(i, matrix);
      canopy.setMatrixAt(i, matrix);
      canopy.setColorAt(i, p.tint);
    });
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
    trunk.computeBoundingSphere();
    canopy.computeBoundingSphere();
  }, [placements, clearings]);

  if (!placements.length) return null;
  return (
    <group>
      <instancedMesh ref={trunkRef} args={[geometry.trunk, materials.trunk, placements.length]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={canopyRef} args={[geometry.canopy, materials.canopy, placements.length]} receiveShadow frustumCulled={false} />
    </group>
  );
}

export interface ForestLayerProps {
  /** Placed structures — the forest opens a clearing around each. */
  structures?: StructureConfig[];
}

export function ForestLayer({ structures }: ForestLayerProps) {
  const placements = useMemo(() => buildPlacements(), []);
  const uniforms = forestUniforms;

  const clearings = useMemo(
    () => (structures ?? []).filter((s) => s.enabled !== false).map((s) => ({ xKm: s.x_km, yKm: s.y_km })),
    [structures],
  );

  // Sway and the canopy's hazard response are uniform writes only — the
  // geometry never leaves the GPU. Values come from the hazard channel the
  // active visualizer publishes; nothing is computed here.
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    const h = hazardChannel;
    const dirX = Math.cos(h.headingRad);
    const dirZ = Math.sin(h.headingRad);
    uniforms.uWindDir.value[0] = dirX;
    uniforms.uWindDir.value[1] = dirZ;
    // Scene +z is south, so the km-space direction flips z.
    uniforms.uHazardDirKm.value[0] = dirX;
    uniforms.uHazardDirKm.value[1] = -dirZ;

    if (h.kind === HAZARD_KIND_NONE) {
      uniforms.uWind.value += (0.06 - uniforms.uWind.value) * 0.05;
      uniforms.uInundationKm.value = 0;
      uniforms.uLateralKm.value = 0;
      return;
    }
    const [ox, oy] = [h.originX, h.originZ];
    uniforms.uHazardOriginKm.value[0] = ox + 150;
    uniforms.uHazardOriginKm.value[1] = -oy + 150;

    // A cyclone's wind field is the only thing that really moves the canopy;
    // everything else keeps the ambient breeze.
    const target = h.kind === HAZARD_KIND_CYCLONE ? 0.12 + 0.88 * h.intensity : 0.06 + 0.12 * h.intensity;
    uniforms.uWind.value += (target - uniforms.uWind.value) * 0.06;
    const inundates = h.kind === HAZARD_KIND_TSUNAMI || h.kind === HAZARD_KIND_FLOOD;
    uniforms.uInundationKm.value = inundates ? h.inundationKm : 0;
    uniforms.uLateralKm.value = inundates ? Math.max(h.lateralKm, 5) : 0;
  });

  return (
    <group>
      <SpeciesStand species="conifer" placements={placements.conifer} clearings={clearings} uniforms={uniforms} />
      <SpeciesStand species="broadleaf" placements={placements.broadleaf} clearings={clearings} uniforms={uniforms} />
      <SpeciesStand species="palm" placements={placements.palm} clearings={clearings} uniforms={uniforms} />
    </group>
  );
}
