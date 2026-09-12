import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { SceneLabel } from "../overlays/SceneLabel";

interface LocationMarkerProps {
  position: [number, number, number];
  label?: string;
  color?: string;
  pulse?: boolean;
  /** Scene-units height of the marker stem. Scales with how far the camera
   * sits back so a marker stays visible without becoming a tower. */
  height?: number;
}

/**
 * VISUAL DEMONSTRATION MARKER — a beacon for the scenario's location or a
 * hazard's current centre. A thin stem from the ground plane, a small
 * emissive head, and (optionally) an expanding ground ring, so it reads
 * clearly against both water and terrain without glowing like a lamp.
 */
export function LocationMarker({
  position,
  label,
  color = "#22b8cf",
  pulse = true,
  height = 6,
}: LocationMarkerProps) {
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulse || !ringRef.current) return;
    const t = (clock.elapsedTime % 2.4) / 2.4;
    ringRef.current.scale.setScalar(1 + t * 3.4);
    const material = ringRef.current.material;
    if (!Array.isArray(material) && "opacity" in material) {
      material.opacity = (1 - t) * 0.7;
    }
  });

  return (
    <group position={position}>
      {/* Stem — anchors the head to the ground so the marker doesn't read as
          floating at an ambiguous altitude. */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.09, 0.09, height, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, height, 0]}>
        <sphereGeometry args={[0.7, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.35} />
      </mesh>
      {/* Ground anchor dot — always readable from directly above. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <circleGeometry args={[0.8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {pulse ? (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
          <ringGeometry args={[1.6, 2.0, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ) : null}
      {label ? <SceneLabel position={[0, height + 1.6, 0]}>{label}</SceneLabel> : null}
    </group>
  );
}
