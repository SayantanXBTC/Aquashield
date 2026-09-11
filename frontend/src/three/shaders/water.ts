/**
 * Minimal stylized water shader: vertex-displaced swell (two sine waves at
 * different frequency/direction) + a fresnel-ish rim term in the fragment
 * shader for a glassy, cinematic surface. Not a physical ocean simulation —
 * a visual treatment, same spirit as the rest of Prompt 8's "AAA visual
 * demonstration, not scientific data" world.
 */
export const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  varying vec3 vNormal;
  varying float vElevation;

  void main() {
    vec3 pos = position;
    float wave1 = sin(pos.x * 0.18 + uTime * 0.6) * uAmplitude;
    float wave2 = sin(pos.y * 0.26 + uTime * 0.4) * uAmplitude * 0.6;
    float elevation = wave1 + wave2;
    pos.z += elevation;
    vElevation = elevation;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const waterFragmentShader = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  varying vec3 vNormal;
  varying float vElevation;

  void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
    vec3 base = mix(uDeepColor, uShallowColor, clamp(vElevation * 2.0 + 0.5, 0.0, 1.0));
    vec3 color = mix(base, uShallowColor, fresnel * 0.35);
    gl_FragColor = vec4(color, 1.0);
  }
`;
