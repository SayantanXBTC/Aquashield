import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { projectToScene, type LatLon } from "@/three/utils/geoProjection";
import type { HazardFootprint } from "@/features/command-center/types";

interface HazardFootprintLayerProps {
  origin: LatLon;
  footprint: HazardFootprint | null;
}

const OUTLINE_COLOR = "#ff5a5f";
const MARKER_Y = 0.6;

/**
 * VISUAL DEMONSTRATION LAYER — renders whatever geometry type
 * simulation/core/hazard_footprint.py actually produced (Point or Polygon)
 * as a scene-space outline/marker. This never computes hazard geometry
 * itself; `footprint.geometry` is already the backend's repackaged
 * hazard_state/affected_area (see three/adapters/simulationVisualAdapter.ts
 * for the equivalent convention on the per-disaster visualizers). Renders
 * nothing when there is no geometry at this frame, rather than fabricating
 * a placeholder shape.
 */
export function HazardFootprintLayer({ origin, footprint }: HazardFootprintLayerProps) {
  const polygonPoints = useMemo((): [number, number, number][] | null => {
    if (!footprint?.geometry || footprint.geometry.type !== "Polygon") return null;
    const ring = (footprint.geometry.coordinates as number[][][])[0];
    if (!ring || ring.length < 2) return null;
    return ring.map(([lon, lat]) => {
      const { x, z } = projectToScene(origin, { latitude: lat, longitude: lon });
      return [x, MARKER_Y, z];
    });
  }, [origin, footprint]);

  if (!footprint?.geometry) return null;

  if (footprint.geometry.type === "Point") {
    const [lon, lat] = footprint.geometry.coordinates as number[];
    const { x, z } = projectToScene(origin, { latitude: lat, longitude: lon });
    return (
      <mesh position={[x, MARKER_Y, z]}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial color={OUTLINE_COLOR} transparent opacity={0.8} />
      </mesh>
    );
  }

  if (polygonPoints && polygonPoints.length >= 2) {
    return <Line points={polygonPoints} color={OUTLINE_COLOR} lineWidth={2} />;
  }

  return null;
}
