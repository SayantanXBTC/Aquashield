import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { kmToScene } from "@/three/world/demoWorld";

interface HeadingGuideProps {
  originKm: [number, number];
  landfallKm: [number, number] | null;
  /** Where the heading line ends when it never reaches land. */
  fallbackEndKm: [number, number];
}

/**
 * VISUAL GUIDE — a dashed line from the origin pin along the heading to the
 * landfall point (or off toward the world edge when the heading misses the
 * coast), with a small marker on the shore. It restates the model's own
 * `distance_to_coast_along_heading` result; nothing is computed here.
 */
export function HeadingGuide({ originKm, landfallKm, fallbackEndKm }: HeadingGuideProps) {
  const [ox, oz] = kmToScene(originKm[0], originKm[1]);
  const end = landfallKm ?? fallbackEndKm;
  const [ex, ez] = kmToScene(end[0], end[1]);
  const points = useMemo<[number, number, number][]>(() => [[ox, 0.5, oz], [ex, 0.5, ez]], [ox, oz, ex, ez]);

  return (
    <group>
      <Line points={points} color={landfallKm ? "#9cb0c0" : "#63768a"} dashed dashSize={2.4} gapSize={1.6} transparent opacity={0.6} lineWidth={1} />
      {landfallKm ? (
        <group position={[ex, 0, ez]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
            <ringGeometry args={[1.2, 1.7, 40]} />
            <meshBasicMaterial color="#e2564c" transparent opacity={0.8} depthWrite={false} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 4, 6]} />
            <meshBasicMaterial color="#e2564c" transparent opacity={0.6} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
