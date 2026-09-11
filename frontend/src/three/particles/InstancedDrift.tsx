import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";

interface InstancedDriftProps {
  /** Local-space center the particle field is built around. */
  center: [number, number, number];
  /** Spread radius, in scene units — drives how far particles scatter. */
  radius: number;
  count?: number;
  color?: string;
}

const dummy = new Object3D();

/**
 * A reusable GPU-instanced particle cluster for drift-style hazards (oil
 * spill slick, search & rescue debris field) — one InstancedMesh draw call
 * regardless of particle count, never one React component per particle
 * (CLAUDE.md §8/architecture.md §15).
 */
export function InstancedDrift({ center, radius, count = 220, color = "#12181c" }: InstancedDriftProps) {
  const meshRef = useRef<InstancedMesh>(null);

  // Deterministic per-particle offsets — stable across re-renders, only
  // recomputed when the particle count actually changes.
  const offsets = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.5;
      const dist = Math.sqrt((i * 9973) % 997 / 997);
      points.push([Math.cos(angle) * dist, 0, Math.sin(angle) * dist]);
    }
    return points;
  }, [count]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < offsets.length; i++) {
      const [ox, , oz] = offsets[i];
      const bob = Math.sin(t * 0.8 + i) * 0.08;
      dummy.position.set(center[0] + ox * radius, center[1] + bob, center[2] + oz * radius);
      dummy.scale.setScalar(0.18 + (i % 5) * 0.04);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <circleGeometry args={[1, 8]} />
      <meshStandardMaterial color={color} roughness={1} />
    </instancedMesh>
  );
}
