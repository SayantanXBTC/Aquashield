/**
 * Restrained, physically-inspired three-light rig: a directional "sun" for
 * primary shading/shadows, a soft hemisphere light for sky/ground color
 * bounce, and a low-intensity ambient fill so shadow sides never go fully
 * black. Reused by every scene — a disaster visualizer never adds its own
 * lights.
 */
export function LightingSystem() {
  return (
    <>
      <hemisphereLight args={["#1c3a4a", "#04070a", 0.55]} />
      <directionalLight
        position={[40, 60, 20]}
        intensity={1.4}
        color="#dceaf2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <ambientLight intensity={0.18} color="#1a2c38" />
    </>
  );
}
