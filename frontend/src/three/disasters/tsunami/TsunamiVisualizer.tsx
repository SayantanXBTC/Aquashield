import { Line } from "@react-three/drei";
import { LocationMarker } from "@/three/markers/LocationMarker";
import { kmToSceneUnits, projectToScene } from "@/three/utils/geoProjection";
import { rampColor } from "@/three/utils/colorRamp";
import { HazardRing } from "../shared/HazardRing";
import type { DisasterVisualizerProps } from "../types";

/** Tsunami — a propagating wave-front ring centered on the scenario's
 * coastal location, plus (when the model reports one) a marker at the
 * distant source connected by a dashed line, so the propagation direction
 * reads clearly even without a real bathymetry-aware wave path. */
export function TsunamiVisualizer({ visualState, origin }: DisasterVisualizerProps) {
  const pos = projectToScene(origin, origin);
  const radius = kmToSceneUnits(visualState.radiusKm);
  const color = rampColor("#2bc8d4", "#e7edf3", visualState.intensity01);
  const sourcePos = visualState.secondaryCenter ? projectToScene(origin, visualState.secondaryCenter) : null;

  return (
    <group>
      <HazardRing position={[pos.x, 0.1, pos.z]} radius={radius} color={color} thickness={1.4} />
      <LocationMarker position={[pos.x, 0, pos.z]} label={visualState.label} color={color} />
      {sourcePos ? (
        <>
          <LocationMarker position={[sourcePos.x, 0, sourcePos.z]} label="Source" color="#d9564d" pulse={false} />
          <Line
            points={[
              [sourcePos.x, 0.3, sourcePos.z],
              [pos.x, 0.3, pos.z],
            ]}
            color="#3a4a56"
            dashed
            dashSize={1.2}
            gapSize={0.7}
            transparent
            opacity={0.55}
          />
        </>
      ) : null}
    </group>
  );
}
