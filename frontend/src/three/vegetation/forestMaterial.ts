/**
 * The forest's shared shader behaviour: wind sway, and the hazard's effect on
 * the canopy.
 *
 * VISUAL DEMONSTRATION. Two things happen here and neither is a physical
 * model:
 *
 *  - **Wind sway.** Every instance bends about its own base, phase-offset by
 *    its world position, with the amplitude driven by `uWind` — which the
 *    layer raises when a cyclone's wind field is over the scene. It is
 *    animation, not a wind simulation, and no number from it reaches the
 *    simulation or the AI layer.
 *  - **Inundated canopy.** Trees standing inside the hazard's current
 *    inland reach are pushed downwind and desaturated toward a wet, silted
 *    green. This is the same illustrative treatment the structures get: it
 *    shows WHERE the deterministic hazard currently extends, never that a
 *    tree was destroyed.
 *
 * The shore function comes from DEMO_WORLD_GLSL, so the canopy's waterline
 * agrees with the terrain and the water surface exactly.
 */
import { Color, MeshStandardMaterial, Vector3, type WebGLProgramParametersWithUniforms } from "three";
import { DEMO_WORLD_GLSL, shoreUniformDefaults } from "../world/demoWorld";

// The forest only ever renders over the fictional demo world (it's
// suppressed under Dense Coastal Profile / real-city profiles, three/core/
// SceneRoot.tsx), so its shore uniforms are always the fictional defaults —
// still required, though: landDepthKm() below reads the same shoreX()
// uniforms as the water/terrain materials, and an unset uniform would break
// the inundation waterline for every scene.
const SHORE_DEFAULTS = shoreUniformDefaults();

export interface ForestUniforms {
  uTime: { value: number };
  /** 0-1 wind strength; drives sway amplitude and gust rate. */
  uWind: { value: number };
  /** Scene-space wind/heading direction (unit), the way the hazard travels. */
  uWindDir: { value: [number, number] };
  /** How far inland (km) the hazard currently reaches past the shore. */
  uInundationKm: { value: number };
  /** Half-width (km) of the affected coast stretch, about the hazard line. */
  uLateralKm: { value: number };
  /** Hazard centre line in world km (origin) + heading, for the lateral test. */
  uHazardOriginKm: { value: [number, number] };
  uHazardDirKm: { value: [number, number] };
}

function createForestUniforms(): ForestUniforms {
  return {
    uTime: { value: 0 },
    uWind: { value: 0 },
    uWindDir: { value: [1, 0] },
    uInundationKm: { value: 0 },
    uLateralKm: { value: 0 },
    uHazardOriginKm: { value: [0, 0] },
    uHazardDirKm: { value: [1, 0] },
  };
}

/**
 * One shared uniform block for the whole forest — module-level and mutable,
 * exactly like `three/hazard/hazardChannel.ts`, because it is written every
 * frame by the layer and read by six materials. There is one Canvas and one
 * world in this app (CLAUDE.md §27), so one forest.
 */
export const forestUniforms: ForestUniforms = createForestUniforms();

const SWAY_GLSL = /* glsl */ `
  // Bend the instance about its base. Object-space y is height, so the
  // quadratic falloff keeps trunks planted and moves crowns the most.
  float swayHeight = clamp(transformed.y / 1.2, 0.0, 1.0);
  vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float phase = instPos.x * 0.7 + instPos.z * 0.9;
  float gust = 0.55 + 0.45 * sin(uTime * 0.23 + phase * 0.05);
  float wave = sin(uTime * (1.1 + uWind * 2.2) + phase) * 0.6
             + sin(uTime * (2.3 + uWind * 3.1) + phase * 1.7) * 0.25;
  float amp = (0.035 + 0.55 * uWind * gust) * swayHeight * swayHeight;
  transformed.xz += uWindDir * (wave * amp);

  // Inside the hazard's current inland reach the canopy is laid over
  // downwind — an illustration of extent, never a claim of damage.
  vec2 kmPos = sceneToKm(instPos.xz);
  float inlandKm = landDepthKm(kmPos.x, kmPos.y);
  vec2 rel = kmPos - uHazardOriginKm;
  float lateralKm = abs(rel.x * uHazardDirKm.y - rel.y * uHazardDirKm.x);
  float reached = step(0.0, inlandKm) * step(inlandKm, uInundationKm)
                * (uLateralKm <= 0.0 ? 0.0 : 1.0 - smoothstep(uLateralKm * 0.75, uLateralKm, lateralKm));
  vSubmerged = reached;
  transformed.xz += uWindDir * (reached * 0.42 * swayHeight * swayHeight);
  transformed.y -= reached * 0.12 * swayHeight;
`;

/** Adds sway + inundation response to a material. `canopy` also desaturates
 * the foliage where the hazard currently reaches. */
export function applyForestShader(material: MeshStandardMaterial, uniforms: ForestUniforms, part: "trunk" | "canopy"): MeshStandardMaterial {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uFlatTerrain = { value: 0 };
    shader.uniforms.uShoreBase = { value: SHORE_DEFAULTS.uShoreBase };
    shader.uniforms.uShoreAmp = { value: new Vector3(...SHORE_DEFAULTS.uShoreAmp) };
    shader.uniforms.uShoreFreq = { value: new Vector3(...SHORE_DEFAULTS.uShoreFreq) };
    shader.uniforms.uShorePhase = { value: new Vector3(...SHORE_DEFAULTS.uShorePhase) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform vec2 uWindDir;
        uniform float uInundationKm;
        uniform float uLateralKm;
        uniform vec2 uHazardOriginKm;
        uniform vec2 uHazardDirKm;
        varying float vSubmerged;
        ${DEMO_WORLD_GLSL}`,
      )
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${SWAY_GLSL}`);

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying float vSubmerged;`,
    );
    if (part === "canopy") {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.66, 0.5), vSubmerged);`,
      );
    }
  };
  material.customProgramCacheKey = () => `forest-${part}`;
  return material;
}

/** Foliage tints the instance colours are sampled from — a mixed stand, not
 * a species map. */
export const CANOPY_TINTS: Color[] = [
  new Color("#2f5d2a"),
  new Color("#3a6b2f"),
  new Color("#27512a"),
  new Color("#456f31"),
  new Color("#1f4524"),
  new Color("#547a35"),
];
