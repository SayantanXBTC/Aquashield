import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import type { WorldProfile } from "@shared/types";
import "./waterMaterial";
import { useDiagnostics } from "../diagnostics/diagnosticStore";
import { hazardChannel } from "../hazard/hazardChannel";
import { SCENE_MESH_SIZE } from "../world/demoWorld";

interface WaterSurfaceProps {
  /** Visual swell scale — a RENDERING choice, never a reported sea state. */
  amplitude?: number;
  /** Dense Coastal Profile's flat-canvas choice — must agree with
   * ShorelineTerrain's `flat` so the shoreline stays watertight. */
  worldProfile?: WorldProfile;
}

type WaterUniforms = ShaderMaterial & {
  uTime: number;
  uHazardKind: number;
  uHazardOrigin: { set: (x: number, y: number) => void };
  uHazardPos: { set: (x: number, y: number) => void };
  uHazardRadius: number;
  uHazardFront: number;
  uHazardIntensity: number;
  uHazardHeading: number;
  uInundationKm: number;
  uWaterLevelM: number;
  uWaveHeight: number;
  uHazardLateralKm: number;
  uFlatTerrain: number;
};

/**
 * VISUAL DEMONSTRATION — the ocean every scene sits on. Not bathymetry, not
 * a sea-state product; see three/shaders/water.ts.
 *
 * The plane covers three times the demo world (900 units, fading into the
 * horizon) — the fragment shader discards it wherever the terrain surface
 * is above the water, so a single plane and a single terrain mesh produce a
 * watertight shoreline without any geometry cutting. 480 segments so
 * Gerstner crests and the tsunami front resolve at the camera distances
 * CameraController allows.
 */
export function WaterSurface({ amplitude = 0.6, worldProfile }: WaterSurfaceProps) {
  const materialRef = useRef<WaterUniforms>(null);
  const { enabled } = useDiagnostics();
  const flat = worldProfile === "dense_coastal";

  useFrame((_, delta) => {
    const m = materialRef.current;
    if (!m) return;
    m.uTime += delta;
    const h = hazardChannel;
    m.uHazardKind = h.kind;
    m.uHazardOrigin.set(h.originX, h.originZ);
    m.uHazardPos.set(h.posX, h.posZ);
    m.uHazardRadius = h.radius;
    m.uHazardFront = h.front;
    m.uHazardIntensity = h.intensity;
    m.uHazardHeading = h.headingRad;
    m.uInundationKm = h.inundationKm;
    m.uWaterLevelM = h.waterLevelM;
    m.uWaveHeight = h.waveHeight;
    m.uHazardLateralKm = h.lateralKm;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
      <planeGeometry args={[SCENE_MESH_SIZE, SCENE_MESH_SIZE, 480, 480]} />
      {enabled ? (
        <meshBasicMaterial color="#0284c7" />
      ) : (
        <waterMaterial ref={materialRef} attach="material" uAmplitude={amplitude} uFlatTerrain={flat ? 1 : 0} transparent depthWrite />
      )}
    </mesh>
  );
}
