interface HazardDiscProps {
  position: [number, number, number];
  radius: number;
  color: string;
  opacity?: number;
}

/** A flat translucent disc sitting just above the water — the shared visual
 * language for "an area is affected here" (flood inundation, search area).
 * Reused rather than reimplemented per disaster visualizer. */
export function HazardDisc({ position, radius, color, opacity = 0.35 }: HazardDiscProps) {
  if (radius <= 0) return null;
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
