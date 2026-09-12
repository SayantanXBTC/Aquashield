import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { isLand, shoreX, WORLD_KM } from "@/propagation/world";
import { kmToScene } from "@/three/world/demoWorld";
import { useGroundDrag } from "./useGroundDrag";

interface OriginPinProps {
  originKm: [number, number];
  onDrag: (xKm: number, yKm: number) => void;
  onDragEnd: () => void;
  color?: string;
  disabled?: boolean;
}

/** Keep the pin at least this far offshore when dropped on land. */
const SHORE_MARGIN_KM = 1.5;

/**
 * VISUAL DEMONSTRATION MARKER — the hazard's starting origin, draggable
 * anywhere on the water (a drop on land snaps back to just offshore).
 */
export function OriginPin({ originKm, onDrag, onDragEnd, color = "#5fd8e4", disabled = false }: OriginPinProps) {
  const ringRef = useRef<Mesh>(null);
  const clamp = useCallback((xRaw: number, yRaw: number): [number, number] => {
    let x = Math.max(0.5, Math.min(WORLD_KM - 0.5, xRaw));
    const y = Math.max(0.5, Math.min(WORLD_KM - 0.5, yRaw));
    if (isLand(x, y)) x = Math.max(0.5, shoreX(y) - SHORE_MARGIN_KM);
    return [x, y];
  }, []);
  const { handlers, hovered, dragging } = useGroundDrag({ onDrag, onDragEnd, clamp, disabled });
  const [sx, sz] = kmToScene(originKm[0], originKm[1]);

  useFrame(({ clock }) => {
    const ring = ringRef.current;
    if (!ring) return;
    const t = (clock.elapsedTime % 2.4) / 2.4;
    ring.scale.setScalar(1 + t * 2.6);
    const material = ring.material;
    if (!Array.isArray(material) && "opacity" in material) material.opacity = (1 - t) * (dragging ? 0.9 : 0.55);
  });

  const tone = dragging ? "#ffffff" : color;
  return (
    <group position={[sx, 0, sz]}>
      <mesh position={[0, 3, 0]} {...handlers}>
        <cylinderGeometry args={[3.2, 3.2, 8, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 6, 6]} />
        <meshBasicMaterial color={tone} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 6.6, 0]}>
        <sphereGeometry args={[0.9, 18, 18]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={hovered || dragging ? 1.4 : 0.8} roughness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial color={tone} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
        <ringGeometry args={[1.7, 2.1, 48]} />
        <meshBasicMaterial color={tone} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}
