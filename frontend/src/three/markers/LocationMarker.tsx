import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { SceneLabel } from "../overlays/SceneLabel";

interface LocationMarkerProps {
  position: [number, number, number];
  label?: string;
  color?: string;
  pulse?: boolean;
}

/** A beacon marker for the scenario's location or a hazard's current
 * center — a small emissive core plus an expanding pulse ring so it reads
 * clearly against both water and terrain. */
export function LocationMarker({ position, label, color = "#2bc8d4", pulse = true }: LocationMarkerProps) {
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulse || !ringRef.current) return;
    const t = (clock.elapsedTime % 2) / 2;
    ringRef.current.scale.setScalar(1 + t * 2.2);
    const material = ringRef.current.material;
    if (!Array.isArray(material) && "opacity" in material) {
      material.opacity = 1 - t;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
      {pulse ? (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1, 1.3, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ) : null}
      {label ? <SceneLabel position={[0, 2.4, 0]}>{label}</SceneLabel> : null}
    </group>
  );
}
