import { LocationMarker } from "@/three/markers/LocationMarker";
import { kmToSceneUnits, projectToScene } from "@/three/utils/geoProjection";
import { rampColor } from "@/three/utils/colorRamp";
import { HazardDisc } from "../shared/HazardDisc";
import type { DisasterVisualizerProps } from "../types";

/** Flood/flash_flood/coastal_flood — an expanding inundation disc at the
 * scenario location, colored from clear water toward murky brown as the
 * water level (Prompt 7's real `water_level_m`) rises. */
export function FloodVisualizer({ visualState, origin }: DisasterVisualizerProps) {
  const center = visualState.center ?? origin;
  const pos = projectToScene(origin, center);
  const radius = kmToSceneUnits(visualState.radiusKm);
  const color = rampColor("#1c5f66", "#7a5230", visualState.intensity01);

  return (
    <group>
      <HazardDisc position={[pos.x, 0.08, pos.z]} radius={radius} color={color} opacity={0.4} />
      <LocationMarker position={[pos.x, 0, pos.z]} label={visualState.label} color="#2bc8d4" />
    </group>
  );
}
