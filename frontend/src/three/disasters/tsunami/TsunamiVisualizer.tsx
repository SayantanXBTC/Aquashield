import { useRef } from "react";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { HAZARD_KIND_TSUNAMI, hazardChannel } from "@/three/hazard/hazardChannel";
import { SceneLabel } from "@/three/overlays/SceneLabel";
import { kmToScene, kmToSceneUnits } from "@/three/world/demoWorld";
import { headingToSceneRad, useHazardFrame, writeCommonChannel } from "../shared/useHazardFrame";
import type { DisasterVisualizerProps } from "../types";

/** Visual crest height per metre of wave height — a rendering convenience
 * (a 10 m wave at 1:1 would be invisible at a 300 km scene scale). */
const CREST_SCENE_UNITS_PER_M = 0.42;
/** Angular width of the front arc: ±40° around the heading, matching the
 * water shader's headingMask. */
const ARC_HALF_ANGLE = (40 * Math.PI) / 180;

/**
 * VISUAL DEMONSTRATION — tsunami. The raised crest itself lives in the water
 * shader (hazard kind 1); this component drives its uniforms and adds a
 * sharp arc line at the front plus the wave-height label so the front's
 * position and heading read instantly even from directly above.
 */
export function TsunamiVisualizer({ getSnapshot }: DisasterVisualizerProps) {
  const arcRef = useRef<Group>(null);
  const arcMeshRef = useRef<Mesh>(null);

  const label = useHazardFrame(getSnapshot, (s) => {
    writeCommonChannel(s);
    hazardChannel.kind = HAZARD_KIND_TSUNAMI;
    const front = kmToSceneUnits(s.frontRadiusKm ?? 0);
    const totalToCoast = s.front.coastDistanceTotalKm;
    // Past the coast the shader keeps the crest at the shoreline; the arc
    // line follows the same clamp.
    const clampedFront = totalToCoast !== null ? Math.min(front, kmToSceneUnits(totalToCoast)) : front;
    hazardChannel.front = clampedFront;
    // After landfall the crest dissipates into the run-up over the model's
    // 30-minute inundation ramp.
    const ramp = s.front.arrived ? Math.min(1, s.front.minutesSinceArrival / 30) : 0;
    hazardChannel.waveHeight = (s.waveHeightM ?? 0) * CREST_SCENE_UNITS_PER_M * (1 - 0.85 * ramp);
    hazardChannel.inundationKm = s.inundationKm ?? 0;
    hazardChannel.waterLevelM = s.coastalImpactM ?? 0;

    const arc = arcRef.current;
    if (arc) {
      const [ox, oz] = kmToScene(s.params.originXKm, s.params.originYKm);
      arc.position.set(ox, 0.3 + hazardChannel.waveHeight * 0.9, oz);
      // RingGeometry lives in the XY plane; after the -PI/2 X rotation its
      // +X axis is scene +X and its +Y axis is scene -Z. thetaStart is
      // measured from +X toward +Y, so a scene heading (from +x toward +z)
      // maps to -heading.
      arc.rotation.z = -headingToSceneRad(s.params.headingDeg) - ARC_HALF_ANGLE;
      const scale = Math.max(0.01, clampedFront);
      arc.scale.setScalar(scale);
      arc.visible = clampedFront > 0.5;
      const mesh = arcMeshRef.current;
      if (mesh) {
        (mesh.material as MeshBasicMaterial).opacity = 0.35 + 0.55 * s.intensity01;
      }
    }
  });

  return (
    <group>
      <group ref={arcRef} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={arcMeshRef}>
          <ringGeometry args={[0.985, 1.0, 96, 1, 0, ARC_HALF_ANGLE * 2]} />
          <meshBasicMaterial color="#e7f6f9" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      </group>
      {label ? (
        <SceneLabel position={[label.labelPosition[0], 4.5, label.labelPosition[2]]}>{label.label}</SceneLabel>
      ) : null}
    </group>
  );
}
