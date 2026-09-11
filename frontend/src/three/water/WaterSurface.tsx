import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, ShaderMaterial } from "three";
import "./waterMaterial";

interface WaterSurfaceProps {
  size?: number;
}

/** The AQUASHIELD ocean base every scene sits on — a shader-displaced plane,
 * not a static flat color (Prompt 8: avoid "a blue plane with some cubes on
 * it"). Geometry stays coarse (64 segments) since the displacement is
 * subtle and the surface is viewed from a distance — no benefit to a denser
 * mesh here. */
export function WaterSurface({ size = 400 }: WaterSurfaceProps) {
  const materialRef = useRef<ShaderMaterial>(null);
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shaderMaterial uniforms are untyped
    (material as any).uTime += delta;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size, 64, 64]} />
      <waterMaterial ref={materialRef} attach="material" />
    </mesh>
  );
}
