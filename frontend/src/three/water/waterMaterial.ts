import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import { Color, Vector2, Vector3 } from "three";
import { waterFragmentShader, waterVertexShader } from "../shaders/water";
import { shoreUniformDefaults } from "../world/demoWorld";
import { LAND_FIELD_DUMMY_TEXTURE, landFieldUniformDefaults } from "../world/landField";

/**
 * VISUAL DEMONSTRATION — the ocean material's palette, sun direction and
 * hazard-overlay uniforms. See three/shaders/water.ts for the full "this is
 * a rendering treatment, not a hydrodynamic simulation" note.
 *
 * SUN_DIRECTION must stay in agreement with LightingSystem's directional
 * light position (see core/LightingSystem.tsx).
 */
const SUN_DIRECTION = new Vector3(-48, 58, 30).normalize();
const SHORE_DEFAULTS = shoreUniformDefaults();
const LAND_FIELD_DEFAULTS = landFieldUniformDefaults();

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
    // The shoreline's shape as a runtime uniform — the fictional demo curve
    // by default, or a curated real city's fitted curve (ADR-009). Must
    // match ShorelineTerrain's `shore` prop exactly, or the shoreline stops
    // being watertight.
    uShoreBase: SHORE_DEFAULTS.uShoreBase,
    uShoreAmp: new Vector3(...SHORE_DEFAULTS.uShoreAmp),
    uShoreFreq: new Vector3(...SHORE_DEFAULTS.uShoreFreq),
    uShorePhase: new Vector3(...SHORE_DEFAULTS.uShorePhase),
    uLandSign: SHORE_DEFAULTS.uLandSign,
    // The curated real city's rasterised coast field (ADR-009,
    // three/world/landField.ts) — disabled defaults here; WaterSurface sets
    // the real values (and texture) per scene.
    uLandFieldEnabled: LAND_FIELD_DEFAULTS.uLandFieldEnabled,
    uLandFieldOrigin: new Vector2(...LAND_FIELD_DEFAULTS.uLandFieldOrigin),
    uLandFieldSizeKm: LAND_FIELD_DEFAULTS.uLandFieldSizeKm,
    uLandFieldResolution: LAND_FIELD_DEFAULTS.uLandFieldResolution,
    uLandFieldTex: LAND_FIELD_DUMMY_TEXTURE,
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
