import { useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import { HAZARD_KIND_OIL, hazardChannel } from "@/three/hazard/hazardChannel";
import { SceneLabel } from "@/three/overlays/SceneLabel";
import { kmToScene, kmToSceneUnits } from "@/three/world/demoWorld";
import { useHazardFrame, writeCommonChannel } from "../shared/useHazardFrame";
import type { DisasterVisualizerProps } from "../types";

const PARTICLE_COUNT = 260;
const dummy = new Object3D();

/**
 * VISUAL DEMONSTRATION — oil spill. The surface discolouration (dark slick
 * body, yellow-brown iridescent rim, flattened swell) is in the water
 * shader (hazard kind 2). This component drives those uniforms and adds a
 * GPU-instanced field of drifting tar patches inside the slick, denser
 * toward the centre and thinning as concentration falls — one draw call
 * regardless of count (CLAUDE.md §8).
 */
export function OilSpillVisualizer({ getSnapshot }: DisasterVisualizerProps) {
  const meshRef = useRef<InstancedMesh>(null);

  // Deterministic per-particle placement in the unit disc.
  const offsets = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 * 7.3;
      const dist = Math.sqrt(((i * 9973) % 997) / 997);
      points.push([Math.cos(angle) * dist, Math.sin(angle) * dist, 0.12 + ((i * 31) % 7) * 0.03]);
    }
    return points;
  }, []);

  const label = useHazardFrame(getSnapshot, (s, t) => {
    writeCommonChannel(s);
    hazardChannel.kind = HAZARD_KIND_OIL;
    const mesh = meshRef.current;
    if (!mesh) return;
    const [px, pz] = kmToScene(s.front.positionXKm, s.front.positionYKm);
    const radius = Math.max(0.3, kmToSceneUnits(s.radiusKm));
    const visible = Math.round(PARTICLE_COUNT * (0.25 + 0.75 * s.intensity01));
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const [ox, oz, size] = offsets[i];
      const drift = t * 0.02;
      const bob = Math.sin(t * 0.7 + i) * 0.05;
      dummy.position.set(px + (ox * radius) + Math.sin(drift + i) * 0.4, 0.22 + bob, pz + oz * radius + Math.cos(drift * 1.3 + i) * 0.4);
      dummy.rotation.set(-Math.PI / 2, 0, i);
      dummy.scale.setScalar(i < visible ? size * (0.6 + radius * 0.05) : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
        <circleGeometry args={[1, 7]} />
        <meshStandardMaterial color="#0b0a08" roughness={0.35} metalness={0.2} />
      </instancedMesh>
      {label ? (
        <SceneLabel position={[label.labelPosition[0], 4, label.labelPosition[2]]}>{label.label}</SceneLabel>
      ) : null}
    </group>
  );
}
