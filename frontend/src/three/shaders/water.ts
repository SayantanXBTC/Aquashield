/**
 * Stylized water shader: vertex-displaced swell (large directional waves
 * plus a higher-frequency chop layer for surface texture) and a
 * fragment shader combining true view-dependent fresnel with a directional
 * sun-glint specular highlight, so the surface reads as reflective/moving
 * rather than a flat tinted plane. Not a physical ocean simulation — a
 * visual treatment, same spirit as the rest of Prompt 8's "AAA visual
 * demonstration, not scientific data" world.
 *
 * Prompt 8.1 correction: the previous version only had two low-frequency
 * swell waves and a fresnel term keyed off a fixed local-space axis
 * (correct only for a perfectly overhead camera) with no specular response
 * to the scene's own directional light — it read as flat and static from
 * the corrected, lower-angle camera. This version adds real view/light
 * vectors (via `vWorldPosition`) and a fine chop layer for movement detail.
 */
export const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    vec3 pos = position;
    float wave1 = sin(pos.x * 0.18 + uTime * 0.6) * uAmplitude;
    float wave2 = sin(pos.y * 0.26 + uTime * 0.4) * uAmplitude * 0.6;
    float chop = sin((pos.x + pos.y) * 0.9 + uTime * 1.7) * uAmplitude * 0.12;
    float elevation = wave1 + wave2 + chop;
    pos.z += elevation;
    vElevation = elevation;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const waterFragmentShader = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSunDirection;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vElevation;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0), 3.0);

    vec3 base = mix(uDeepColor, uShallowColor, clamp(vElevation * 2.0 + 0.5, 0.0, 1.0));
    vec3 color = mix(base, uShallowColor, fresnel * 0.45);

    vec3 halfDir = normalize(uSunDirection + viewDir);
    float glint = pow(max(dot(vNormal, halfDir), 0.0), 120.0);
    color += vec3(0.9, 0.96, 1.0) * glint * 0.8;

    gl_FragColor = vec4(color, 1.0);
  }
`;
