import { useEffect, useMemo } from "react";
import { BufferAttribute, PlaneGeometry } from "three";
import type { WorldProfile } from "@shared/types";
import { DEFAULT_SHORE, type ShoreParams } from "@/propagation/world";
import { useDiagnostics } from "../diagnostics/diagnosticStore";
import { sceneToKm, terrainHeightKm, landDepthKm, SCENE_MESH_SIZE } from "../world/demoWorld";
import { createTerrainMaterial } from "./terrainMaterial";

/**
 * VISUAL DEMONSTRATION TERRAIN — the single land plate every scenario uses:
 * solid land east of the demo shoreline, sea floor west of it. This is NOT
 * scientific terrain and NOT a DEM; the height field is
 * `terrainHeightKm` (three/world/demoWorld.ts), the same function the water
 * shader evaluates, which is what keeps the coastline watertight — water
 * cannot exist where this surface is above sea level.
 *
 * Surface colour is computed per fragment by terrainMaterial.ts (sand,
 * fields, forest and rock for the demo world; asphalt and an illustrative
 * road grid for the flat Dense Coastal Profile / Real City worlds); the
 * vertex colours here are a coarse fallback used only by the diagnostics
 * modes. No imagery, no dataset, no real street data.
 */
export function ShorelineTerrain({
  segments = 420,
  worldProfile,
  shore = DEFAULT_SHORE,
}: {
  segments?: number;
  worldProfile?: WorldProfile;
  /** The fictional demo curve by default, or a curated real city's fitted
   * curve (ADR-009) — must match WaterSurface's `shore` exactly. */
  shore?: ShoreParams;
}) {
  const flat = worldProfile === "dense_coastal" || worldProfile === "real_city";
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(SCENE_MESH_SIZE, SCENE_MESH_SIZE, segments, segments);
    const position = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);

    for (let i = 0; i < position.count; i++) {
      // Local +Y maps to world -Z after the [-PI/2, 0, 0] rotation.
      const sceneX = position.getX(i);
      const sceneZ = -position.getY(i);
      const [xKm, yKm] = sceneToKm(sceneX, sceneZ);
      const h = terrainHeightKm(xKm, yKm, flat, shore);
      const d = landDepthKm(xKm, yKm, shore);
      position.setZ(i, h);

      let r: number;
      let g: number;
      let b: number;
      if (d < 0) {
        // Sea floor: darker with depth so shallows read lighter through the water.
        const t = Math.min(1, -d / 40);
        r = 0.13 - 0.07 * t;
        g = 0.26 - 0.14 * t;
        b = 0.3 - 0.16 * t;
      } else if (d < 1.2) {
        r = 0.76; g = 0.7; b = 0.52; // wet sand
      } else if (flat) {
        // Urban worlds (Dense Coastal Profile / Real City): a neutral
        // asphalt/outskirt grey fallback — the real road grid only exists
        // in terrainMaterial.ts's fragment shader, not in this coarse mesh.
        const t = Math.min(1, (d - 1.2) / 8);
        r = 0.42 + (0.34 - 0.42) * t;
        g = 0.4 + (0.33 - 0.4) * t;
        b = 0.35 + (0.3 - 0.35) * t;
      } else if (d < 4) {
        const t = (d - 1.2) / 2.8;
        r = 0.76 + (0.42 - 0.76) * t;
        g = 0.7 + (0.58 - 0.7) * t;
        b = 0.52 + (0.34 - 0.52) * t;
      } else if (h < 4.5) {
        const t = Math.min(1, (h - 1.7) / 2.8);
        r = 0.36 + (0.25 - 0.36) * t;
        g = 0.55 + (0.44 - 0.55) * t;
        b = 0.3 + (0.24 - 0.3) * t;
      } else {
        const t = Math.min(1, (h - 4.5) / 4);
        r = 0.25 + (0.5 - 0.25) * t;
        g = 0.44 + (0.5 - 0.44) * t;
        b = 0.24 + (0.48 - 0.24) * t;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [segments, flat, shore]);

  const { enabled, terrainMode } = useDiagnostics();
  const material = useMemo(() => createTerrainMaterial(flat, shore), [flat, shore]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      {terrainMode === "normals" ? (
        <meshNormalMaterial />
      ) : terrainMode === "wireframe" ? (
        <meshBasicMaterial wireframe color="#38bdf8" />
      ) : enabled || terrainMode === "basic" ? (
        <meshBasicMaterial color="#cbd5e1" />
      ) : (
        <primitive object={material} attach="material" />
      )}
    </mesh>
  );
}
