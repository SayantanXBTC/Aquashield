import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

/**
 * Verifies the React -> React Three Fiber -> Three.js import/render
 * pipeline. Not an AQUASHIELD scene — replaced once real visualization
 * work starts (see frontend/src/three/README.md).
 */
export function BootstrapCanvas() {
  return (
    <Canvas camera={{ position: [3, 3, 3] }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
