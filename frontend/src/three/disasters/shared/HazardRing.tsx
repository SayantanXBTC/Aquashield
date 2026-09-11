interface HazardRingProps {
  position: [number, number, number];
  radius: number;
  color: string;
  thickness?: number;
}

/** A thin ring outline — the shared visual language for "a front is
 * propagating here" (tsunami wave front, cyclone wind-field edge). */
export function HazardRing({ position, radius, color, thickness = 0.6 }: HazardRingProps) {
  if (radius <= 0) return null;
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.max(0.1, radius - thickness), radius, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}
