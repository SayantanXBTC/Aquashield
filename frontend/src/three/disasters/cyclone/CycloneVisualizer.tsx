import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { LocationMarker } from "@/three/markers/LocationMarker";
import { kmToSceneUnits, projectToScene } from "@/three/utils/geoProjection";
import { rampColor } from "@/three/utils/colorRamp";
import { HazardRing } from "../shared/HazardRing";
import type { DisasterVisualizerProps } from "../types";

const RING_FRACTIONS = [0.4, 0.68, 1];

/** Cyclone/storm_surge — concentric wind-field rings rotating around the
 * storm's real, moving center (Prompt 7's `hazard_state.center`), spin
 * speed driven by wind intensity. */
export function CycloneVisualizer({ visualState, origin }: DisasterVisualizerProps) {
  const center = visualState.center ?? origin;
  const pos = projectToScene(origin, center);
  const radius = kmToSceneUnits(visualState.radiusKm);
  const color = rampColor("#5b6b7a", "#e7edf3", visualState.intensity01);
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * (0.3 + visualState.intensity01 * 1.3);
  });

  return (
    <group position={[pos.x, 0.2, pos.z]}>
      <group ref={groupRef}>
        {RING_FRACTIONS.map((fraction) => (
          <HazardRing key={fraction} position={[0, 0, 0]} radius={radius * fraction} color={color} thickness={0.5} />
        ))}
      </group>
      <LocationMarker position={[0, -0.2, 0]} label={visualState.label} color={color} />
    </group>
  );
}
