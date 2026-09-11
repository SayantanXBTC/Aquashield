import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "./PerformanceMonitor";

interface AquaCanvasProps {
  children: ReactNode;
}

/**
 * The one `<Canvas>` in the application. Device-pixel-ratio is clamped to
 * [1, 2] (a 3x/4x phone DPR would otherwise render far more pixels than
 * the visual payoff justifies — Prompt 8 "Performance"); `frameloop`
 * stays "always" since the water shader and hazard rotations animate
 * continuously, but every other perf knob (shadow map size, instancing,
 * geometry segment counts) is decided by the systems inside, not here.
 *
 * Camera start pose (Prompt 8.1 correction): a low, wide establishing shot
 * — camera height is small relative to its horizontal distance from the
 * scenario origin, so the scene reads as a low-angle survey over a large
 * body of water with visible horizon/atmosphere, not a steep top-down look
 * at a single object. A narrower fov than a typical 50-60 keeps distant
 * geometry from looking fisheye-distorted.
 */
export function AquaCanvas({ children }: AquaCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [92, 30, 118], fov: 38, near: 0.5, far: 900 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      {children}
      <PerformanceMonitor />
    </Canvas>
  );
}
