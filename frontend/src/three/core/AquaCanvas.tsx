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
 */
export function AquaCanvas({ children }: AquaCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [55, 42, 55], fov: 42, near: 0.1, far: 800 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      {children}
      <PerformanceMonitor />
    </Canvas>
  );
}
