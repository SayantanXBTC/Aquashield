import { LocationMarker } from "@/three/markers/LocationMarker";
import { kmToSceneUnits, projectToScene } from "@/three/utils/geoProjection";
import { rampColor } from "@/three/utils/colorRamp";
import { HazardDisc } from "../shared/HazardDisc";
import type { DisasterVisualizerProps } from "../types";

/** Search & rescue — a growing search-area disc around the real, drifting
 * probable position (Prompt 7's `hazard_state.probable_center`); color
 * shifts from confident green toward uncertain amber as the model's own
 * `confidence` value falls. */
export function SearchRescueVisualizer({ visualState, origin }: DisasterVisualizerProps) {
  const center = visualState.center ?? origin;
  const pos = projectToScene(origin, center);
  const radius = kmToSceneUnits(visualState.radiusKm);
  const color = rampColor("#3fbf8a", "#d99a3d", visualState.intensity01);

  return (
    <group>
      <HazardDisc position={[pos.x, 0.09, pos.z]} radius={radius} color={color} opacity={0.22} />
      <LocationMarker position={[pos.x, 0, pos.z]} label={visualState.label} color={color} />
    </group>
  );
}
