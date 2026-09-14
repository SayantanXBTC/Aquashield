import { MeshStandardMaterial, Vector3, type WebGLProgramParametersWithUniforms } from "three";
import { DEFAULT_SHORE, type ShoreParams } from "@/propagation/world";
import { DEMO_WORLD_GLSL, shoreUniformDefaults } from "../world/demoWorld";

/**
 * VISUAL DEMONSTRATION — the land plate's surface. A MeshStandardMaterial
 * whose diffuse colour is computed per fragment from world position and
 * slope (injected via onBeforeCompile), so the terrain reads as wet sand,
 * dunes, grassland with mottled fields, forest patches and bare rock on the
 * steep faces — instead of one vertex-colour ramp. Purely procedural, no
 * dataset, no claim about land cover anywhere.
 *
 * `shore` (the fictional demo curve by default, or a curated real city's
 * fitted curve, ADR-009) must be set here even though the colour logic
 * below never calls `terrainHeightKm` directly — it calls `landDepthKm`,
 * which reads the same `shoreX()` GLSL uniforms, so an unset shore would
 * silently break coastal colouring for every scene, not just real cities.
 */
export function createTerrainMaterial(flat = false, shore: ShoreParams = DEFAULT_SHORE): MeshStandardMaterial {
  const shoreUniforms = shoreUniformDefaults(shore);
  const material = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0.02 });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uFlatTerrain = { value: flat ? 1 : 0 };
    shader.uniforms.uShoreBase = { value: shoreUniforms.uShoreBase };
    shader.uniforms.uShoreAmp = { value: new Vector3(...shoreUniforms.uShoreAmp) };
    shader.uniforms.uShoreFreq = { value: new Vector3(...shoreUniforms.uShoreFreq) };
    shader.uniforms.uShorePhase = { value: new Vector3(...shoreUniforms.uShorePhase) };
    shader.uniforms.uLandSign = { value: shoreUniforms.uLandSign };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTerrainWorld;
        varying float vTerrainSlope;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        // Object-space +Z is world up for the [-PI/2,0,0]-rotated plane.
        vTerrainSlope = 1.0 - clamp(normal.z, 0.0, 1.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTerrainWorld;
        varying float vTerrainSlope;
        ${DEMO_WORLD_GLSL}
        float thash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float tnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(thash(i), thash(i + vec2(1,0)), u.x), mix(thash(i + vec2(0,1)), thash(i + vec2(1,1)), u.x), u.y);
        }
        float tfbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * tnoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return v; }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec2 km = sceneToKm(vTerrainWorld.xz);
          float depth = landDepthKm(km.x, km.y);
          float height = vTerrainWorld.y;
          float slope = vTerrainSlope;
          float macro = tfbm(km * 0.06);
          float fine = tfbm(km * 0.9);
          float micro = tnoise(km * 6.0);

          vec3 seabed   = vec3(0.10, 0.19, 0.20);
          vec3 wetSand  = vec3(0.52, 0.47, 0.36);
          vec3 drySand  = vec3(0.80, 0.73, 0.55);
          vec3 grass    = vec3(0.30, 0.46, 0.22);
          vec3 meadow   = vec3(0.45, 0.55, 0.26);
          vec3 forest   = vec3(0.13, 0.28, 0.14);
          vec3 soil     = vec3(0.36, 0.28, 0.18);
          vec3 rock     = vec3(0.42, 0.40, 0.37);
          vec3 rockHigh = vec3(0.60, 0.58, 0.55);

          vec3 c;
          if (depth < 0.0) {
            c = mix(seabed, wetSand, smoothstep(-6.0, 0.0, depth)) * (0.85 + 0.3 * fine);
          } else {
            float beach = 1.0 - smoothstep(0.6, 2.4, depth);
            vec3 sand = mix(drySand, wetSand, (1.0 - smoothstep(0.0, 0.9, depth)) * 0.8) * (0.9 + 0.2 * micro);
            vec3 field = mix(grass, meadow, smoothstep(0.35, 0.7, macro)) * (0.85 + 0.3 * fine);
            float forestMask = smoothstep(0.55, 0.72, tfbm(km * 0.11 + 4.2)) * smoothstep(2.5, 6.0, depth);
            field = mix(field, forest * (0.85 + 0.3 * micro), forestMask);
            float soilMask = smoothstep(0.66, 0.8, tfbm(km * 0.35 + 9.1)) * (1.0 - forestMask);
            field = mix(field, soil, soilMask * 0.7);
            c = mix(field, sand, beach);
            // Bare rock on steep faces and on the high ridge.
            float rockMask = max(smoothstep(0.18, 0.42, slope), smoothstep(6.5, 9.5, height));
            vec3 rockCol = mix(rock, rockHigh, smoothstep(7.0, 11.0, height)) * (0.85 + 0.3 * fine);
            c = mix(c, rockCol, rockMask);
          }
          diffuseColor.rgb *= c;
        }`,
      );
  };
  return material;
}
