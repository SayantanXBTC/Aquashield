/**
 * VISUAL DEMONSTRATION — the hazard's swept footprint, drawn on the sea
 * surface for the "real_map" profile only.
 *
 * Every other profile renders a tsunami's crest inside the WATER SHADER
 * (three/water/waterMaterial.ts, hazard kind 1). This profile has no water
 * mesh at all — the basemap supplies the sea — so that crest has nowhere to
 * live and the hazard reads as nothing but a marker. This is the stand-in:
 * a flat wedge sweeping out from the origin along the heading, its radius
 * the distance the front has actually travelled.
 *
 * It is a RENDERING CONVENIENCE, not a physical field. The radius is the
 * model's own `front.traveledKm` and the opacity follows its `intensity01`;
 * nothing here computes physics or invents a quantity.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, MeshBasicMaterial } from "three";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { headingToSceneRad } from "@/three/disasters/shared/useHazardFrame";
import { kmToScene } from "@/three/world/demoWorld";

/** Matches the water shader's headingMask: ±40° around the heading. */
const ARC_HALF_ANGLE = (40 * Math.PI) / 180;

/** Per-kind tint, the same colours the existing visualizers use. */
const KIND_COLOR: Record<HazardKind, string> = {
  tsunami: "#22d3ee",
  cyclone: "#a78bfa",
  oil_spill: "#f59e0b",
  coastal_flood: "#38bdf8",
};

export interface MapHazardFootprintProps {
  originKm: [number, number];
  kind: HazardKind | null;
  getSnapshot: () => HazardSnapshot | null;
}

export function MapHazardFootprint({ originKm, kind, getSnapshot }: MapHazardFootprintProps) {
  const spinRef = useRef<Group>(null);
  const scaleRef = useRef<Group>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const [sceneX, sceneZ] = useMemo(() => kmToScene(originKm[0], originKm[1]), [originKm]);

  useFrame(() => {
    const snapshot = getSnapshot();
    if (!snapshot || !spinRef.current || !scaleRef.current) return;
    // Scene units are kilometres, so the travelled distance is the radius.
    const radius = Math.max(0.001, snapshot.front.traveledKm);
    scaleRef.current.scale.setScalar(radius);
    spinRef.current.rotation.y = headingToSceneRad(snapshot.params.headingDeg);
    if (materialRef.current) materialRef.current.opacity = 0.12 + 0.3 * snapshot.intensity01;
  });

  if (!kind) return null;

  return (
    // Lifted a metre off the sea so it never z-fights the basemap.
    <group ref={spinRef} position={[sceneX, 0.001, sceneZ]}>
      <group ref={scaleRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 72, -ARC_HALF_ANGLE, ARC_HALF_ANGLE * 2]} />
          <meshBasicMaterial ref={materialRef} color={KIND_COLOR[kind]} transparent opacity={0.2} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
