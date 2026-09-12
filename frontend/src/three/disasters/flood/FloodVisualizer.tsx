import { useRef } from "react";
import { Group, MeshBasicMaterial, Mesh } from "three";
import { HAZARD_KIND_FLOOD, hazardChannel } from "@/three/hazard/hazardChannel";
import { SceneLabel } from "@/three/overlays/SceneLabel";
import { kmToScene, kmToSceneUnits } from "@/three/world/demoWorld";
import { useHazardFrame, writeCommonChannel } from "../shared/useHazardFrame";
import type { DisasterVisualizerProps } from "../types";

/**
 * VISUAL DEMONSTRATION — coastal flood. The surge front approaching the
 * coast is a translucent ring at the front position; once the surge
 * arrives, the water shader (hazard kind 4) extends the surface inland by
 * the model's inundation reach and lifts it with the water level, so the
 * flood climbs the terrain and recedes as the level drops.
 */
export function FloodVisualizer({ getSnapshot }: DisasterVisualizerProps) {
  const ringRef = useRef<Group>(null);
  const ringMeshRef = useRef<Mesh>(null);

  const label = useHazardFrame(getSnapshot, (s, t) => {
    writeCommonChannel(s);
    hazardChannel.kind = HAZARD_KIND_FLOOD;
    hazardChannel.inundationKm = s.inundationKm ?? 0;
    hazardChannel.waterLevelM = s.waterLevelM ?? 0;
    hazardChannel.lateralKm = 25 + s.params.spreadRadiusKm; // same limit the exposure rules use
    // Before landfall the surge is a compact swell: reuse the tsunami-style
    // front uniform at a low crest so the approaching surge is visible.
    hazardChannel.front = s.front.arrived ? 0 : kmToSceneUnits(s.front.traveledKm);
    hazardChannel.waveHeight = s.front.arrived ? 0 : 0.6 + s.params.intensity * 1.2;

    const g = ringRef.current;
    if (g) {
      const [px, pz] = kmToScene(s.front.positionXKm, s.front.positionYKm);
      g.position.set(px, 0.4, pz);
      const pulse = 1 + Math.sin(t * 2.2) * 0.06;
      g.scale.setScalar(Math.max(1, kmToSceneUnits(4 + s.params.intensity * 6)) * pulse);
      g.visible = !s.front.arrived;
      const m = ringMeshRef.current;
      if (m) (m.material as MeshBasicMaterial).opacity = 0.3 + 0.4 * s.params.intensity;
    }
  });

  return (
    <group>
      <group ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={ringMeshRef}>
          <ringGeometry args={[0.9, 1.0, 64]} />
          <meshBasicMaterial color="#8fd3e6" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
      {label ? (
        <SceneLabel position={[label.labelPosition[0], 4.5, label.labelPosition[2]]}>{label.label}</SceneLabel>
      ) : null}
    </group>
  );
}
