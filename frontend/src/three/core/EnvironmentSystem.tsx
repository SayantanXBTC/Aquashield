import { Sky } from "@react-three/drei";

/**
 * Atmosphere without a network-fetched HDRI: drei's `Sky` is a procedural
 * Preetham sky dome (geometry + shader, no texture download), tuned low and
 * desaturated for a moody dusk horizon rather than a colorful sunset — this
 * is what gives the scene an actual horizon line and sense of scale instead
 * of a flat black void (Prompt 8.1 "Camera": "visible horizon/depth").
 * `fogExp2` still fades distant water/terrain into that horizon color so
 * the two blend instead of the sky dome clipping in behind hard-edged
 * geometry. Entirely synthetic atmosphere — not a claim about real weather
 * or lighting conditions at any location.
 */
export function EnvironmentSystem() {
  return (
    <>
      <Sky
        distance={700}
        sunPosition={[60, 6, -90]}
        turbidity={9}
        rayleigh={1.4}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />
      <fogExp2 attach="fog" args={["#0a1620", 0.0075]} />
    </>
  );
}
