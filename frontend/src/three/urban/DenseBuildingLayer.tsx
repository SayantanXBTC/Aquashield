import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { StructureConfig } from "@shared/types";
import type { HazardSnapshot } from "@/propagation/hazards";
import { exposureFor, geometryFromSnapshot, statusFor } from "@/propagation/structures";
import { STATUS_COLOR } from "@/three/structures/support";
import { buildBuildingPlacements, BUILDING_CLEARING_KM, type BuildingClass, type Placement } from "./buildingPlacement";

/**
 * VISUAL DEMONSTRATION — the Dense Coastal Profile's generic building field:
 * a fictional, procedurally generated town silhouette, never a real place
 * and never real building footprints (three/urban/buildingPlacement.ts).
 *
 * Rendering: one InstancedMesh per building class (three draw calls). Each
 * instance's colour tints Clear -> Amber -> Red as the hazard reaches it,
 * using the exact same exposureFor()/statusFor() functions and STATUS_COLOR
 * palette that named structures use (propagation/structures.ts,
 * three/structures/support.ts) — no second exposure model. Recomputed on a
 * throttled interval (not every frame) since this can be thousands of
 * instances; geometry/transforms are written once and never move.
 */

const RECOMPUTE_INTERVAL_S = 0.15;
const CLASS_FOOTPRINT: Record<BuildingClass, number> = { low: 1.4, mid: 1.8, highrise: 2.1 };

interface ClassStandProps {
  cls: BuildingClass;
  placements: Placement[];
  getSnapshot: () => HazardSnapshot | null;
}

function ClassStand({ cls, placements, getSnapshot }: ClassStandProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const elapsed = useRef(0);
  const colorRef = useRef(new Color());

  const geometry = useMemo(() => {
    const footprint = CLASS_FOOTPRINT[cls];
    const geo = new BoxGeometry(footprint, 1, footprint);
    geo.translate(0, 0.5, 0); // local base at y=0, so scale.y == height
    return geo;
  }, [cls]);
  const material = useMemo(() => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0.05 }), []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  // Transforms are static (buildings never move) — written once.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    const clear = new Color(STATUS_COLOR.clear);

    placements.forEach((p, i) => {
      position.set(p.sceneX, p.y, p.sceneZ);
      quaternion.setFromAxisAngle(up, p.rotY);
      scale.set(1, p.scale, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, clear);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);

  // Exposure tint — real exposure math, throttled so thousands of instances
  // don't recolour every animation frame.
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < RECOMPUTE_INTERVAL_S) return;
    elapsed.current = 0;
    const mesh = meshRef.current;
    const snapshot = getSnapshot();
    if (!mesh || !snapshot || !placements.length) return;
    const geom = geometryFromSnapshot(snapshot);
    const color = colorRef.current;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const [, exposure] = exposureFor(geom, p.xKm, p.yKm);
      color.set(STATUS_COLOR[statusFor(exposure)]);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (!placements.length) return null;
  return <instancedMesh ref={meshRef} args={[geometry, material, placements.length]} receiveShadow castShadow frustumCulled={false} />;
}

export interface DenseBuildingLayerProps {
  /** Placed named structures — no generic building renders inside
   * BUILDING_CLEARING_KM of one. */
  structures?: StructureConfig[];
  getSnapshot: () => HazardSnapshot | null;
}

export function DenseBuildingLayer({ structures, getSnapshot }: DenseBuildingLayerProps) {
  const clearings = useMemo(
    () => (structures ?? []).filter((s) => s.enabled !== false).map((s) => ({ xKm: s.x_km, yKm: s.y_km })),
    [structures],
  );
  const placements = useMemo(() => buildBuildingPlacements(clearings), [clearings]);

  return (
    <group>
      <ClassStand cls="low" placements={placements.low} getSnapshot={getSnapshot} />
      <ClassStand cls="mid" placements={placements.mid} getSnapshot={getSnapshot} />
      <ClassStand cls="highrise" placements={placements.highrise} getSnapshot={getSnapshot} />
    </group>
  );
}

export { BUILDING_CLEARING_KM };
