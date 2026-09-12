import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface CameraControllerProps {
  /** Scene-space point the shot is composed around. */
  focus?: [number, number, number];
  /** Scene-units radius the frame should comfortably contain. */
  frameRadius?: number;
  /** Play the post-login warp entrance: start far out and high, dolly in
   * to the framing over ~2 s. Fires `onEntranceComplete` once. */
  entrance?: boolean;
  onEntranceComplete?: () => void;
}

const ELEVATION_RAD = (36 * Math.PI) / 180;
const AZIMUTH_RAD = (252 * Math.PI) / 180;
const MIN_DISTANCE = 30;
const MAX_DISTANCE = 520;
const FRAME_PADDING = 1.35;
const ENTRANCE_SECONDS = 2.1;

const scratchTarget = new Vector3();
const scratchPosition = new Vector3();

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Mission-control camera. Re-frames (an exponential slew) whenever the
 * focal point or hazard radius changes; any manual input cancels the slew
 * until the next focus change. The `entrance` mode is the second half of
 * the post-login warp (features/landing/WarpTransition.tsx does the first
 * half in 2D): the camera starts far above the world and dollies in on an
 * ease-out curve, and the HUD is revealed when it lands.
 */
export function CameraController({
  focus = [0, 0, 0],
  frameRadius = 60,
  entrance = false,
  onEntranceComplete,
}: CameraControllerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const desiredTarget = useRef(new Vector3(0, 0, 0));
  const desiredPosition = useRef(new Vector3());
  const slewing = useRef(false);
  const entranceState = useRef<{ from: Vector3; fromTarget: Vector3; elapsed: number } | null>(null);
  const entranceDone = useRef(onEntranceComplete);
  useEffect(() => {
    entranceDone.current = onEntranceComplete;
  }, [onEntranceComplete]);

  const [focusX, focusY, focusZ] = focus;

  useEffect(() => {
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 40;
    const halfFov = (fov * Math.PI) / 360;
    const fitDistance = (Math.max(frameRadius, 6) * FRAME_PADDING) / Math.tan(halfFov);
    const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, fitDistance));

    desiredTarget.current.set(focusX, focusY, focusZ);
    desiredPosition.current.set(
      focusX + Math.cos(ELEVATION_RAD) * Math.sin(AZIMUTH_RAD) * distance,
      focusY + Math.sin(ELEVATION_RAD) * distance,
      focusZ + Math.cos(ELEVATION_RAD) * Math.cos(AZIMUTH_RAD) * distance,
    );

    if (reducedMotion) {
      camera.position.copy(desiredPosition.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(desiredTarget.current);
        controlsRef.current.update();
      }
      slewing.current = false;
      entranceState.current = null;
      return;
    }
    slewing.current = true;
  }, [camera, focusX, focusY, focusZ, frameRadius, reducedMotion]);

  // Entrance: park the camera far out along the same bearing, then let the
  // frame loop below dolly it in.
  useEffect(() => {
    if (!entrance || reducedMotion) {
      if (entrance && reducedMotion) entranceDone.current?.();
      return;
    }
    const from = desiredPosition.current.clone();
    from.sub(desiredTarget.current).multiplyScalar(4.6).add(desiredTarget.current);
    from.y += 260;
    camera.position.copy(from);
    entranceState.current = { from, fromTarget: desiredTarget.current.clone().add(new Vector3(0, 40, 0)), elapsed: 0 };
    slewing.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per entrance request
  }, [entrance, reducedMotion]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cancel = () => {
      slewing.current = false;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const ent = entranceState.current;
    if (ent) {
      ent.elapsed += delta;
      const t = Math.min(1, ent.elapsed / ENTRANCE_SECONDS);
      const e = easeOutQuint(t);
      camera.position.lerpVectors(ent.from, desiredPosition.current, e);
      controls.target.lerpVectors(ent.fromTarget, desiredTarget.current, e);
      controls.update();
      if (t >= 1) {
        entranceState.current = null;
        entranceDone.current?.();
      }
      return;
    }

    if (!slewing.current) return;
    const alpha = 1 - Math.exp(-delta * 3.2);
    scratchTarget.copy(controls.target).lerp(desiredTarget.current, alpha);
    scratchPosition.copy(camera.position).lerp(desiredPosition.current, alpha);
    controls.target.copy(scratchTarget);
    camera.position.copy(scratchPosition);
    controls.update();
    if (controls.target.distanceTo(desiredTarget.current) < 0.05 && camera.position.distanceTo(desiredPosition.current) < 0.05) {
      slewing.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      enablePan
      panSpeed={0.6}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.47}
    />
  );
}
