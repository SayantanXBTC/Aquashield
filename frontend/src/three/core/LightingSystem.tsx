/**
 * VISUAL DEMONSTRATION LIGHTING — a restrained three-light rig: a
 * directional "sun" for primary shading/shadows, a soft hemisphere light for
 * sky/ground colour bounce, and a low ambient fill so shadow sides never go
 * fully black. Reused by every scene — a disaster visualizer never adds its
 * own lights. This is a look, not a claim about real illumination or time of
 * day at any location.
 *
 * The sun's position must stay in agreement with `SUN_DIRECTION` in
 * three/water/waterMaterial.ts (-48, 58, 30) — the water shader computes its
 * own specular from that vector, so if the two drift apart the sun glint
 * appears somewhere the terrain shadows say the sun isn't. The shadow camera
 * is sized to the terrain plate (320 units) rather than left at a default
 * that would either miss geometry or waste depth-map resolution.
 */
export function LightingSystem() {
  return (
    <>
      <hemisphereLight args={["#8fb6d0", "#2b3a30", 0.32]} />
      <directionalLight
        position={[-48, 58, 30]}
        intensity={1.15}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={900}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
      />
      <ambientLight intensity={0.12} color="#3a5266" />
    </>
  );
}
