import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
import { projectToScene, type LatLon } from "@/three/utils/geoProjection";
import type { ExposureResult } from "@/features/command-center/types";

interface InfrastructureMarkersProps {
  origin: LatLon;
  assets: ExposureResult[];
  /** Infrastructure toggle shows every asset in the current exposure result
   * set as a neutral marker; the Exposure toggle recolors/filters them by
   * status. Both can be on at once. */
  showAll: boolean;
  showExposureColor: boolean;
}

const dummy = new Object3D();
const NEUTRAL_COLOR = new Color("#7fa8b8");
const WITHIN_COLOR = new Color("#ff5a5f");
const NEARBY_COLOR = new Color("#ffb020");

/**
 * VISUAL DEMONSTRATION LAYER — real backend exposure data (asset id/name/
 * type/criticality/status/centroid), rendered as simple markers; not a GIS-
 * accurate infrastructure map. One InstancedMesh draw call regardless of
 * asset count (CLAUDE.md §8/§27 — never one React component per asset).
 * Renders nothing (returns null) when there is nothing to show, rather than
 * ever fabricating a marker.
 */
export function InfrastructureMarkers({
  origin,
  assets,
  showAll,
  showExposureColor,
}: InfrastructureMarkersProps) {
  const meshRef = useRef<InstancedMesh>(null);

  const visible = useMemo(() => {
    if (!showAll && !showExposureColor) return [];
    if (showExposureColor && !showAll) {
      return assets.filter((a) => a.status === "within_hazard_footprint" || a.status === "potentially_exposed");
    }
    return assets;
  }, [assets, showAll, showExposureColor]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    visible.forEach((asset, i) => {
      const { x, z } = projectToScene(origin, { latitude: asset.latitude, longitude: asset.longitude });
      dummy.position.set(x, 0.8, z);
      dummy.scale.setScalar(0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const color = !showExposureColor
        ? NEUTRAL_COLOR
        : asset.status === "within_hazard_footprint"
          ? WITHIN_COLOR
          : asset.status === "potentially_exposed"
            ? NEARBY_COLOR
            : NEUTRAL_COLOR;
      mesh.setColorAt(i, color);
    });
    mesh.count = visible.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [visible, origin, showExposureColor]);

  if (visible.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(visible.length, 1)]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} />
    </instancedMesh>
  );
}
