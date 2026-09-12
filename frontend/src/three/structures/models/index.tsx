import { useMemo, type JSX } from "react";
import type { StructureType } from "@shared/types";
import { hash01, type StructurePalette } from "../support";

export interface ModelProps {
  seed: string;
  palette: StructurePalette;
}

/** A block of towers with varied heights and lit windows. ~3 km footprint. */
export function BuildingCluster({ seed, palette }: ModelProps) {
  const count = 11;
  const layout = useMemo(() => {
    const items: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let i = 0; i < count; i++) {
      const r = hash01(seed, i * 7 + 1);
      const gx = (i % 4) - 1.5;
      const gz = Math.floor(i / 4) - 1;
      items.push({ x: gx * 0.75 + (r - 0.5) * 0.25, z: gz * 0.8 + (hash01(seed, i * 3) - 0.5) * 0.25, w: 0.45 + r * 0.25, d: 0.45 + hash01(seed, i * 5) * 0.25, h: 0.6 + Math.pow(hash01(seed, i * 11), 1.6) * 3.2 });
    }
    return items;
  }, [seed]);
  return (
    <group>
      {layout.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} material={palette.wall} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
        </mesh>
      ))}
      {layout.map((b, i) => (
        <mesh key={`r${i}`} position={[b.x, b.h + 0.03, b.z]} material={palette.roof}>
          <boxGeometry args={[b.w * 1.02, 0.06, b.d * 1.02]} />
        </mesh>
      ))}
      {/* Ground plaza */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[3.6, 3.2]} />
      </mesh>
    </group>
  );
}

export function Hospital({ palette }: ModelProps) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} material={palette.wall} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.9, 1.6]} />
      </mesh>
      <mesh position={[-0.6, 1.25, 0]} material={palette.wall} castShadow>
        <boxGeometry args={[1.1, 1.6, 1.1]} />
      </mesh>
      <mesh position={[0.9, 0.95, 0.1]} material={palette.roof}>
        <boxGeometry args={[0.9, 0.06, 0.9]} />
      </mesh>
      {/* Red cross on the tower */}
      <mesh position={[-0.6, 2.12, 0]} material={palette.accent}>
        <boxGeometry args={[0.7, 0.12, 0.14]} />
      </mesh>
      <mesh position={[-0.6, 2.12, 0]} material={palette.accent}>
        <boxGeometry args={[0.14, 0.12, 0.7]} />
      </mesh>
      {/* Helipad */}
      <mesh position={[0.9, 0.99, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.36, 32]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[3.2, 2.4]} />
      </mesh>
    </group>
  );
}

/** Quay along the coast (local +X), pier reaching out to sea (local -Z),
 * two cranes, container stacks, a moored ship. */
export function Port({ seed, palette }: ModelProps) {
  const containers = useMemo(() => {
    const items: { x: number; z: number; y: number; c: string }[] = [];
    const colors = ["#c0392b", "#2e86c1", "#27ae60", "#f39c12", "#7f8c8d"];
    for (let i = 0; i < 26; i++) {
      const r = hash01(seed, i * 13);
      items.push({ x: -1.6 + (i % 9) * 0.4, z: 0.55 + Math.floor((i % 18) / 9) * 0.32, y: 0.11 + (i >= 18 ? 0.22 : 0), c: colors[Math.floor(r * colors.length)] });
    }
    return items;
  }, [seed]);
  return (
    <group>
      {/* Quay slab */}
      <mesh position={[0, 0.1, 0.4]} material={palette.roof} receiveShadow>
        <boxGeometry args={[4.4, 0.2, 1.6]} />
      </mesh>
      {/* Pier into the water */}
      <mesh position={[0.6, 0.08, -1.3]} material={palette.roof} receiveShadow>
        <boxGeometry args={[0.5, 0.16, 2.4]} />
      </mesh>
      {[-1.6, -0.2].map((x) => (
        <group key={x} position={[x, 0, -0.35]}>
          {[-0.28, 0.28].map((z) => (
            <mesh key={z} position={[0, 0.9, z]} material={palette.metal}>
              <boxGeometry args={[0.12, 1.8, 0.12]} />
            </mesh>
          ))}
          <mesh position={[0, 1.85, 0]} material={palette.accent}>
            <boxGeometry args={[0.2, 0.18, 0.9]} />
          </mesh>
          <mesh position={[0, 1.9, -0.9]} rotation={[0.35, 0, 0]} material={palette.accent}>
            <boxGeometry args={[0.14, 0.14, 1.9]} />
          </mesh>
        </group>
      ))}
      {containers.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} castShadow>
          <boxGeometry args={[0.36, 0.2, 0.26]} />
          <meshStandardMaterial color={c.c} roughness={0.7} />
        </mesh>
      ))}
      {/* Warehouse */}
      <mesh position={[1.4, 0.45, 0.75]} material={palette.wall} castShadow>
        <boxGeometry args={[1.4, 0.5, 0.7]} />
      </mesh>
      {/* Moored ship */}
      <group position={[-0.5, 0, -0.85]}>
        <mesh position={[0, 0.12, 0]} material={palette.metal}>
          <boxGeometry args={[2.2, 0.3, 0.5]} />
        </mesh>
        <mesh position={[0.7, 0.5, 0]} material={palette.wall}>
          <boxGeometry args={[0.45, 0.5, 0.42]} />
        </mesh>
      </group>
    </group>
  );
}

export function PowerPlant({ palette }: ModelProps) {
  const towerPoints = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = 0.55 - 0.32 * Math.sin(t * Math.PI * 0.85) + 0.08 * t;
      pts.push([r, t * 2.4]);
    }
    return pts;
  }, []);
  return (
    <group>
      {[-1.1, 0.2].map((x) => (
        <mesh key={x} position={[x, 0, -0.6]} material={palette.wall} castShadow>
          <latheGeometry args={[towerPoints.map(([r, y]) => ({ x: r, y }) as never), 32]} />
        </mesh>
      ))}
      <mesh position={[1.2, 0.55, 0.4]} material={palette.wall} castShadow>
        <boxGeometry args={[1.8, 1.1, 1.3]} />
      </mesh>
      <mesh position={[1.9, 1.6, 0.9]} material={palette.metal} castShadow>
        <cylinderGeometry args={[0.08, 0.11, 3.2, 12]} />
      </mesh>
      <mesh position={[1.9, 3.15, 0.9]} material={palette.accent}>
        <cylinderGeometry args={[0.1, 0.1, 0.14, 12]} />
      </mesh>
      {/* Switchyard */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.9 + i * 0.6, 0.35, 0.9]} material={palette.metal}>
          <boxGeometry args={[0.08, 0.7, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[4.2, 3]} />
      </mesh>
    </group>
  );
}

export function Lighthouse({ palette }: ModelProps) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} material={palette.wall} castShadow>
        <cylinderGeometry args={[0.26, 0.4, 1.8, 20]} />
      </mesh>
      {[0.55, 1.15].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={palette.accent}>
          <cylinderGeometry args={[0.36 - y * 0.06, 0.38 - y * 0.06, 0.22, 20]} />
        </mesh>
      ))}
      <mesh position={[0, 2.0, 0]} material={palette.glass}>
        <cylinderGeometry args={[0.24, 0.24, 0.36, 16]} />
      </mesh>
      <mesh position={[0, 2.3, 0]} material={palette.accent}>
        <coneGeometry args={[0.32, 0.28, 16]} />
      </mesh>
      <mesh position={[0.45, 0.2, 0.3]} material={palette.wall} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.5]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <circleGeometry args={[0.9, 24]} />
      </mesh>
    </group>
  );
}

export function FuelTerminal({ seed, palette }: ModelProps) {
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const r = 0.36 + hash01(seed, i) * 0.14;
        return (
          <mesh key={i} position={[-1.2 + (i % 3) * 1.15, r * 0.9, -0.5 + Math.floor(i / 3) * 1.1]} material={palette.wall} castShadow>
            <cylinderGeometry args={[r, r, r * 1.8, 24]} />
          </mesh>
        );
      })}
      {/* Pipe rack */}
      <mesh position={[0, 0.3, 1.25]} material={palette.metal}>
        <boxGeometry args={[3.6, 0.06, 0.06]} />
      </mesh>
      <mesh position={[0, 0.42, 1.25]} material={palette.accent}>
        <boxGeometry args={[3.6, 0.06, 0.06]} />
      </mesh>
      <mesh position={[1.7, 0.3, 0.9]} material={palette.wall} castShadow>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
      </mesh>
      <mesh position={[0, 0.02, 0.3]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[4.2, 3]} />
      </mesh>
    </group>
  );
}

export const STRUCTURE_MODELS: Record<StructureType, (props: ModelProps) => JSX.Element> = {
  building: BuildingCluster,
  hospital: Hospital,
  port: Port,
  power_plant: PowerPlant,
  lighthouse: Lighthouse,
  fuel_terminal: FuelTerminal,
};
