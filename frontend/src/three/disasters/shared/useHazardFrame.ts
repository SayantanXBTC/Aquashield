import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { HazardSnapshot } from "@/propagation/hazards";
import { kmToScene, kmToSceneUnits } from "@/three/world/demoWorld";
import { hazardChannel } from "@/three/hazard/hazardChannel";

/** Scene-space heading angle (radians from +x toward +z) for a compass
 * heading (0 = north/+y km = -z scene, 90 = east/+x). */
export function headingToSceneRad(headingDeg: number): number {
  const rad = (headingDeg * Math.PI) / 180;
  // km direction (sin h, cos h) -> scene (sin h, -cos h)
  return Math.atan2(-Math.cos(rad), Math.sin(rad));
}

/** Writes the disaster-agnostic part of the hazard channel from a snapshot;
 * each visualizer then sets its own kind-specific fields. */
export function writeCommonChannel(snapshot: HazardSnapshot): void {
  const [ox, oz] = kmToScene(snapshot.params.originXKm, snapshot.params.originYKm);
  const [px, pz] = kmToScene(snapshot.front.positionXKm, snapshot.front.positionYKm);
  hazardChannel.originX = ox;
  hazardChannel.originZ = oz;
  hazardChannel.posX = px;
  hazardChannel.posZ = pz;
  hazardChannel.radius = kmToSceneUnits(snapshot.radiusKm);
  hazardChannel.intensity = snapshot.intensity01;
  hazardChannel.headingRad = headingToSceneRad(snapshot.params.headingDeg);
}

/**
 * Runs `onFrame` every frame with the latest snapshot, and exposes a
 * throttled (4 Hz) React copy of the label/position for the one thing that
 * genuinely needs React — the HTML scene label.
 */
export function useHazardFrame(
  getSnapshot: () => HazardSnapshot | null,
  onFrame: (snapshot: HazardSnapshot, elapsedSeconds: number) => void,
): { label: string; labelPosition: [number, number, number] } | null {
  const [labelState, setLabelState] = useState<{ label: string; labelPosition: [number, number, number] } | null>(null);
  const lastLabelAt = useRef(0);

  useFrame(({ clock }) => {
    const snapshot = getSnapshot();
    if (!snapshot) return;
    onFrame(snapshot, clock.elapsedTime);
    if (clock.elapsedTime - lastLabelAt.current > 0.25) {
      lastLabelAt.current = clock.elapsedTime;
      const [px, pz] = kmToScene(snapshot.front.positionXKm, snapshot.front.positionYKm);
      setLabelState((prev) =>
        prev && prev.label === snapshot.label && Math.abs(prev.labelPosition[0] - px) < 0.05 && Math.abs(prev.labelPosition[2] - pz) < 0.05
          ? prev
          : { label: snapshot.label, labelPosition: [px, 0, pz] },
      );
    }
  });

  return labelState;
}
