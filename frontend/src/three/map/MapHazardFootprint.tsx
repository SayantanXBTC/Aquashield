/**
 * VISUAL DEMONSTRATION — the hazard's advancing water, drawn on the sea
 * surface for the "real_map" profile only.
 *
 * Every other profile renders a tsunami's crest inside the WATER SHADER
 * (three/water/waterMaterial.ts, hazard kind 1). This profile has no water
 * mesh at all — the basemap supplies the sea — so that crest has nowhere to
 * live. This is the stand-in: a wedge sweeping out from the origin along the
 * heading, with a bright crest band at its leading edge and ripples trailing
 * behind it.
 *
 * It is a RENDERING CONVENIENCE, not a physical field. The swept radius is
 * the model's own `front.traveledKm` and the brightness follows its
 * `intensity01`; the ripples are decoration with no quantity behind them.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Group, ShaderMaterial } from "three";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { headingToSceneRad } from "@/three/disasters/shared/useHazardFrame";
import { kmToScene } from "@/three/world/demoWorld";

/** Matches the water shader's headingMask: ±40° around the heading. */
const ARC_HALF_ANGLE = (40 * Math.PI) / 180;

/** Per-kind tint, the same colours the existing visualizers use. */
const KIND_COLOR: Record<HazardKind, string> = {
  tsunami: "#22d3ee",
  cyclone: "#a78bfa",
  oil_spill: "#f59e0b",
  coastal_flood: "#38bdf8",
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * `vUv` runs 0..1 across the circle's bounding square, so the radius is the
 * distance from its centre. The crest rides at r = 1 (the swept edge) and
 * the body fades back toward the origin.
 */
const FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uArrived;
  uniform vec3 uColor;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    // Body: strongest just behind the front, fading to nothing at the origin.
    float body = smoothstep(0.0, 0.55, r) * 0.42;

    // Crest: a bright band pinned to the leading edge.
    float crest = smoothstep(0.90, 0.995, r) * (1.0 - smoothstep(0.995, 1.0, r));

    // Ripples trailing the crest. Decoration — no quantity behind it.
    float ripple = 0.5 + 0.5 * sin(r * 42.0 - uTime * 5.0);
    float ripples = ripple * smoothstep(0.25, 1.0, r) * 0.16;

    // On arrival the whole sheet pulses once per second.
    float pulse = mix(1.0, 1.08 + 0.12 * sin(uTime * 6.28318), uArrived);

    float alpha = (body + ripples + crest * 1.4) * (0.35 + 0.65 * uIntensity) * pulse;
    vec3 color = mix(uColor, vec3(1.0), crest * 0.65);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
  }
`;

export interface MapHazardFootprintProps {
  originKm: [number, number];
  kind: HazardKind | null;
  getSnapshot: () => HazardSnapshot | null;
}

export function MapHazardFootprint({ originKm, kind, getSnapshot }: MapHazardFootprintProps) {
  const spinRef = useRef<Group>(null);
  const scaleRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const [sceneX, sceneZ] = useMemo(() => kmToScene(originKm[0], originKm[1]), [originKm]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.5 },
      uArrived: { value: 0 },
      uColor: { value: new Color(KIND_COLOR[kind ?? "tsunami"]) },
    }),
    [kind],
  );

  useFrame((state) => {
    const snapshot = getSnapshot();
    if (!snapshot || !spinRef.current || !scaleRef.current) return;
    // Scene units are kilometres, so the travelled distance is the radius.
    const radius = Math.max(0.001, snapshot.front.traveledKm);
    scaleRef.current.scale.setScalar(radius);
    spinRef.current.rotation.y = headingToSceneRad(snapshot.params.headingDeg);
    const material = materialRef.current;
    if (material) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uIntensity.value = snapshot.intensity01;
      material.uniforms.uArrived.value = snapshot.front.arrived ? 1 : 0;
    }
  });

  if (!kind) return null;

  return (
    // Lifted a metre off the sea so it never z-fights the basemap.
    <group ref={spinRef} position={[sceneX, 0.001, sceneZ]}>
      <group ref={scaleRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 96, -ARC_HALF_ANGLE, ARC_HALF_ANGLE * 2]} />
          <shaderMaterial
            ref={materialRef}
            vertexShader={VERTEX}
            fragmentShader={FRAGMENT}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
