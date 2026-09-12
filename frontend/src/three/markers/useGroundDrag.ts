import { useCallback, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { sceneToKm } from "@/three/world/demoWorld";

const DRAG_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();

interface GroundDragOptions {
  /** Live position (world km) on every pointer move. */
  onDrag: (xKm: number, yKm: number) => void;
  /** Drop — the moment to persist. */
  onDragEnd: () => void;
  /** Constrain a raw pointer position (world km) to where this object may live. */
  clamp: (xKm: number, yKm: number) => [number, number];
  disabled?: boolean;
}

/**
 * Shared click-and-drag-on-the-ground behaviour for the origin pin and the
 * structures: pointer capture on the hit mesh, raycast onto the y=0 plane,
 * convert to world km, clamp, and suspend OrbitControls for the drag. The
 * returned `handlers` spread onto the invisible hit mesh.
 */
export function useGroundDrag({ onDrag, onDragEnd, clamp, disabled = false }: GroundDragOptions) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const getState = useThree((state) => state.get);
  useCursor(hovered && !disabled, dragging ? "grabbing" : "grab");

  const setControlsEnabled = useCallback(
    (enabled: boolean) => {
      const controls = getState().controls as OrbitControlsImpl | null;
      if (controls) controls.enabled = enabled;
    },
    [getState],
  );

  const handlers = {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      if (disabled) return;
      event.stopPropagation();
      (event.target as Element).setPointerCapture(event.pointerId);
      setControlsEnabled(false);
      setDragging(true);
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      if (!dragging) return;
      event.stopPropagation();
      if (!event.ray.intersectPlane(DRAG_PLANE, hit)) return;
      const [x, y] = clamp(...sceneToKm(hit.x, hit.z));
      onDrag(x, y);
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      if (!dragging) return;
      event.stopPropagation();
      (event.target as Element).releasePointerCapture(event.pointerId);
      setControlsEnabled(true);
      setDragging(false);
      onDragEnd();
    },
    onPointerOver: () => setHovered(true),
    onPointerOut: () => setHovered(false),
  };

  return { handlers, hovered, dragging };
}
