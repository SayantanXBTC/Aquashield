import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { DiagnosticTracker } from "../diagnostics/DiagnosticTracker";

interface AquaCanvasProps {
  children: ReactNode;
}

/**
 * The one `<Canvas>` in the application.
 *
 * Device-pixel-ratio is clamped to [1, 2] (a 3x/4x phone DPR would render
 * far more pixels than the visual payoff justifies — Prompt 8
 * "Performance"); `frameloop` stays "always" since the water shader and
 * hazard rotations animate continuously; every other perf knob (shadow map
 * size, instancing, geometry segment counts) is decided by the systems
 * inside, not here.
 *
 * Prompt 11: ACES filmic tone mapping with a slightly lifted exposure, and
 * an explicit sRGB output colour space. The water shader's specular and
 * glitter terms deliberately exceed 1.0 — without a tone-mapping curve those
 * highlights clip to flat white patches instead of rolling off, which is a
 * large part of why the previous surface read as plastic.
 *
 * The camera's initial pose is only a first frame: CameraController
 * re-composes onto the hazard as soon as a focal point is known, so this
 * value is a sensible establishing shot rather than the scene's real
 * framing.
 */
export function AquaCanvas({ children }: AquaCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows="soft"
      camera={{ position: [-160, 120, 170], fov: 42, near: 0.5, far: 3000 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.9;
        gl.outputColorSpace = SRGBColorSpace;
      }}
    >
      {children}
      <PerformanceMonitor />
      <DiagnosticTracker />
    </Canvas>
  );
}
