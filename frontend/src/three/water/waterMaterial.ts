import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import { Color, Vector2, Vector3 } from "three";
import { waterFragmentShader, waterVertexShader } from "../shaders/water";

/**
 * VISUAL DEMONSTRATION — the ocean material's palette, sun direction and
 * hazard-overlay uniforms. See three/shaders/water.ts for the full "this is
 * a rendering treatment, not a hydrodynamic simulation" note.
 *
 * SUN_DIRECTION must stay in agreement with LightingSystem's directional
 * light position (see core/LightingSystem.tsx).
 */
const SUN_DIRECTION = new Vector3(-48, 58, 30).normalize();

export const WaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uAmplitude: 1.0,
    uDeepColor: new Color("#052538"),
    uShallowColor: new Color("#227a96"),
    uFoamColor: new Color("#dceaf2"),
    uSkyColor: new Color("#5d92b3"),
    uHorizonColor: new Color("#8fa9ba"),
    uSunDirection: SUN_DIRECTION,
    uSunColor: new Color("#fff2df"),
    // Hazard overlay (three/hazard/hazardChannel.ts) — copied in every frame.
    uHazardKind: 0,
    uHazardOrigin: new Vector2(0, 0),
    uHazardPos: new Vector2(0, 0),
    uHazardRadius: 0,
    uHazardFront: 0,
    uHazardIntensity: 0,
    uHazardHeading: 0,
    uInundationKm: 0,
    uWaterLevelM: 0,
    uWaveHeight: 0,
    uHazardLateralKm: 0,
    // Dense Coastal Profile's flat-canvas rendering choice (CLAUDE.md §27) —
    // must agree with ShorelineTerrain's terrainHeightKm(flat) so the
    // shoreline stays watertight in either mode.
    uFlatTerrain: 0,
  },
  waterVertexShader,
  waterFragmentShader,
);

extend({ WaterMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    waterMaterial: ThreeElement<typeof WaterMaterial>;
  }
}
