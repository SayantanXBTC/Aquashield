import { useRef } from "react";
import { DoubleSide, Group, ShaderMaterial } from "three";
import { HAZARD_KIND_CYCLONE, hazardChannel } from "@/three/hazard/hazardChannel";
import { SceneLabel } from "@/three/overlays/SceneLabel";
import { kmToScene, kmToSceneUnits } from "@/three/world/demoWorld";
import { useHazardFrame, writeCommonChannel } from "../shared/useHazardFrame";
import type { DisasterVisualizerProps } from "../types";

/**
 * VISUAL DEMONSTRATION — cyclone. A flat spiral wind-field disc above the
 * surface (custom shader: three logarithmic arms rotating about the eye,
 * fading to the field edge, with a clear eye) that moves with the model's
 * centre; the water shader (hazard kind 3) boosts chop and foam underneath.
 * Spin rate scales with intensity — a rendering convenience, not a wind
 * speed claim (the label carries the real number).
 */
const SPIRAL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SPIRAL_FRAG = /* glsl */ `
  uniform float uSpin;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;           // 0 at eye, 1 at field edge
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x);
    float arms = sin(ang * 3.0 - log(max(r, 0.02)) * 5.5 + uSpin);
    float band = smoothstep(0.15, 0.75, arms);
    float eye = smoothstep(0.04, 0.16, r);
    float wall = 1.0 - smoothstep(0.16, 0.38, r);
    float fade = 1.0 - smoothstep(0.55, 1.0, r);
    float a = (band * fade * 0.55 + wall * 0.45) * eye * (0.45 + 0.55 * uIntensity);
    vec3 col = mix(vec3(0.72, 0.8, 0.86), vec3(0.95, 0.97, 1.0), wall);
    gl_FragColor = vec4(col, a * 0.75);
  }
`;

export function CycloneVisualizer({ getSnapshot }: DisasterVisualizerProps) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);

  const label = useHazardFrame(getSnapshot, (s, t) => {
    writeCommonChannel(s);
    hazardChannel.kind = HAZARD_KIND_CYCLONE;
    const g = groupRef.current;
    if (g) {
      const [px, pz] = kmToScene(s.front.positionXKm, s.front.positionYKm);
      g.position.set(px, 11, pz); // above the highest terrain so the field reads over land too
      g.scale.setScalar(Math.max(0.5, kmToSceneUnits(s.radiusKm)));
    }
    // Counter-clockwise spin (northern-hemisphere convention), faster with intensity.
    const material = materialRef.current;
    if (material) {
      material.uniforms.uSpin.value = t * (0.8 + s.intensity01 * 2.2);
      material.uniforms.uIntensity.value = s.intensity01;
    }
  });

  return (
    <group>
      <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[2, 2, 1, 1]} />
          <shaderMaterial
            ref={materialRef}
            uniforms={{ uSpin: { value: 0 }, uIntensity: { value: 0 } }}
            vertexShader={SPIRAL_VERT}
            fragmentShader={SPIRAL_FRAG}
            transparent
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
        {/* Eye stem so the centre reads from a low camera angle too. */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.12, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      </group>
      {label ? (
        <SceneLabel position={[label.labelPosition[0], 9, label.labelPosition[2]]}>{label.label}</SceneLabel>
      ) : null}
    </group>
  );
}
