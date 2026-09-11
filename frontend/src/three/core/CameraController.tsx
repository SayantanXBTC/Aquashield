import { OrbitControls } from "@react-three/drei";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * A restrained mission-control camera: orbit with damping, clamped
 * distance/polar angle so the user can't flip under the terrain or zoom
 * into the geometry. Damping (inertia) is disabled under
 * prefers-reduced-motion so the camera stops exactly where released
 * instead of drifting.
 */
export function CameraController() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <OrbitControls
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={45}
      maxDistance={230}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.47}
      target={[0, 4, 0]}
    />
  );
}
