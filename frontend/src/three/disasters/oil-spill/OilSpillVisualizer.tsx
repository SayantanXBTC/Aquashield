import { LocationMarker } from "@/three/markers/LocationMarker";
import { InstancedDrift } from "@/three/particles/InstancedDrift";
import { kmToSceneUnits, projectToScene } from "@/three/utils/geoProjection";
import type { DisasterVisualizerProps } from "../types";

/** Oil spill/chemical_pollution — a drifting particle slick around the
 * real, moving plume center (Prompt 7's `hazard_state.center`), particle
 * count scaling with concentration so a heavier spill visibly reads as
 * denser, not just wider. */
export function OilSpillVisualizer({ visualState, origin }: DisasterVisualizerProps) {
  const center = visualState.center ?? origin;
  const pos = projectToScene(origin, center);
  const radius = Math.max(1, kmToSceneUnits(visualState.radiusKm));
  const count = Math.round(70 + visualState.intensity01 * 220);

  return (
    <group>
      <InstancedDrift center={[pos.x, 0.06, pos.z]} radius={radius} count={count} color="#0d0f10" />
      <LocationMarker position={[pos.x, 0, pos.z]} label={visualState.label} color="#8a6a3a" />
    </group>
  );
}
