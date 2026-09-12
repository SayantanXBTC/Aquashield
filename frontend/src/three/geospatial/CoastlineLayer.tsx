import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { projectToScene, type LatLon } from "@/three/utils/geoProjection";
import type { GeographicFeature } from "@/features/command-center/types";

interface CoastlineLayerProps {
  origin: LatLon;
  features: GeographicFeature[];
}

const COASTLINE_COLOR = "#5b8ba0";

/**
 * REAL GEOGRAPHIC DATA — renders actual Natural Earth coastline features
 * (already clipped server-side to the scenario's search radius; see
 * GET /geographic-features/nearby and
 * backend/app/repositories/geospatial_repository.py's
 * find_within_distance_clipped) as scene-space lines. Unlike every other
 * layer in this app, this geometry is not synthetic/procedural — it is a
 * real, provenance-tracked public dataset (Natural Earth, public domain).
 * Renders nothing when no feature has been ingested near the scenario,
 * rather than fabricating a coastline.
 */
export function CoastlineLayer({ origin, features }: CoastlineLayerProps) {
  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    for (const feature of features) {
      if (!feature.geometry) continue;
      const rings: number[][][] =
        feature.geometry.type === "LineString"
          ? [feature.geometry.coordinates as number[][]]
          : feature.geometry.type === "MultiLineString"
            ? (feature.geometry.coordinates as number[][][])
            : [];
      for (const ring of rings) {
        if (ring.length < 2) continue;
        result.push(
          ring.map(([lon, lat]) => {
            const { x, z } = projectToScene(origin, { latitude: lat, longitude: lon });
            return [x, 0.15, z];
          }),
        );
      }
    }
    return result;
  }, [origin, features]);

  if (lines.length === 0) return null;

  return (
    <group>
      {lines.map((points, i) => (
        <Line key={i} points={points} color={COASTLINE_COLOR} lineWidth={1.5} transparent opacity={0.85} />
      ))}
    </group>
  );
}
