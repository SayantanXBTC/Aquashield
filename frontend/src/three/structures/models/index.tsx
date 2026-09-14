import { useMemo, useRef, type JSX, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import type { StructureType } from "@shared/types";
import { applyPieceFailure, pieceFailure, type DamageState } from "../collapse";
import { hash01, type StructurePalette } from "../support";

export interface ModelProps {
  seed: string;
  palette: StructurePalette;
  /** The structure's current illustrative structural state, updated every
   * frame by StructureModel. Mutable on purpose — it is read in useFrame. */
  damage: DamageState;
}

interface FailingPieceProps {
  seed: string;
  index: number;
  damage: DamageState;
  /** Where the piece stands, in the model's local space. It pivots about
   * this point, so a toppling piece hinges at its foot, not its middle. */
  position: [number, number, number];
  /** The piece's height, so taller pieces settle further when they fail. */
  height: number;
  children: ReactNode;
}

/**
 * One structurally independent piece of a model.
 *
 * As the exposure band rises the piece leans, then (inside the `severe` band
 * only) topples and settles on its own deterministic delay, so a structure
 * comes apart piece by piece instead of switching between two states.
 *
 * ILLUSTRATION, NOT PREDICTION — see three/structures/collapse.ts for why
 * this is a drawing of the exposure band and not a damage model, and why it
 * has to stay reversible when the timeline is scrubbed backwards.
 */
export function FailingPiece({ seed, index, damage, position, height, children }: FailingPieceProps) {
  const ref = useRef<Group>(null);
  const failure = useMemo(() => pieceFailure(seed, index), [seed, index]);
  useFrame(() => {
    if (ref.current) applyPieceFailure(ref.current, failure, damage, height);
  });
  return (
    <group position={position}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

/** A block of towers with varied heights and lit windows. ~3 km footprint. */
export function BuildingCluster({ seed, palette, damage }: ModelProps) {
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
        <FailingPiece key={i} seed={seed} index={i} damage={damage} position={[b.x, 0, b.z]} height={b.h}>
          <mesh position={[0, b.h / 2, 0]} material={palette.wall} castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
          </mesh>
          <mesh position={[0, b.h + 0.03, 0]} material={palette.roof}>
            <boxGeometry args={[b.w * 1.02, 0.06, b.d * 1.02]} />
          </mesh>
        </FailingPiece>
      ))}
      {/* Ground plaza */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[3.6, 3.2]} />
      </mesh>
    </group>
  );
}

export function Hospital({ seed, palette, damage }: ModelProps) {
  return (
    <group>
      <FailingPiece seed={seed} index={0} damage={damage} position={[0, 0, 0]} height={0.9}>
        <mesh position={[0, 0.45, 0]} material={palette.wall} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.9, 1.6]} />
        </mesh>
      </FailingPiece>
      <FailingPiece seed={seed} index={1} damage={damage} position={[-0.6, 0, 0]} height={2.2}>
        <mesh position={[0, 1.25, 0]} material={palette.wall} castShadow>
          <boxGeometry args={[1.1, 1.6, 1.1]} />
        </mesh>
        {/* Red cross on the tower */}
        <mesh position={[0, 2.12, 0]} material={palette.accent}>
          <boxGeometry args={[0.7, 0.12, 0.14]} />
        </mesh>
        <mesh position={[0, 2.12, 0]} material={palette.accent}>
          <boxGeometry args={[0.14, 0.12, 0.7]} />
        </mesh>
      </FailingPiece>
      <FailingPiece seed={seed} index={2} damage={damage} position={[0.9, 0, 0.1]} height={1.0}>
        <mesh position={[0, 0.95, 0]} material={palette.roof}>
          <boxGeometry args={[0.9, 0.06, 0.9]} />
        </mesh>
        {/* Helipad */}
        <mesh position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.36, 32]} />
          <meshStandardMaterial color="#f2f2f2" roughness={0.9} />
        </mesh>
      </FailingPiece>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[3.2, 2.4]} />
      </mesh>
    </group>
  );
}

/** Quay along the coast (local +X), pier reaching out to sea (local -Z),
 * two cranes, container stacks, a moored ship. */
export function Port({ seed, palette, damage }: ModelProps) {
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
      {[-1.6, -0.2].map((x, i) => (
        <FailingPiece key={x} seed={seed} index={i} damage={damage} position={[x, 0, -0.35]} height={1.9}>
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
        </FailingPiece>
      ))}
      {containers.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} castShadow>
          <boxGeometry args={[0.36, 0.2, 0.26]} />
          <meshStandardMaterial color={c.c} roughness={0.7} />
        </mesh>
      ))}
      {/* Warehouse */}
      <FailingPiece seed={seed} index={2} damage={damage} position={[1.4, 0, 0.75]} height={0.5}>
        <mesh position={[0, 0.45, 0]} material={palette.wall} castShadow>
          <boxGeometry args={[1.4, 0.5, 0.7]} />
        </mesh>
      </FailingPiece>
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

export function PowerPlant({ seed, palette, damage }: ModelProps) {
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
      {[-1.1, 0.2].map((x, i) => (
        <FailingPiece key={x} seed={seed} index={i} damage={damage} position={[x, 0, -0.6]} height={2.4}>
          <mesh material={palette.wall} castShadow>
            <latheGeometry args={[towerPoints.map(([r, y]) => ({ x: r, y }) as never), 32]} />
          </mesh>
        </FailingPiece>
      ))}
      <FailingPiece seed={seed} index={2} damage={damage} position={[1.2, 0, 0.4]} height={1.1}>
        <mesh position={[0, 0.55, 0]} material={palette.wall} castShadow>
          <boxGeometry args={[1.8, 1.1, 1.3]} />
        </mesh>
      </FailingPiece>
      <FailingPiece seed={seed} index={3} damage={damage} position={[1.9, 0, 0.9]} height={3.2}>
        <mesh position={[0, 1.6, 0]} material={palette.metal} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 3.2, 12]} />
        </mesh>
        <mesh position={[0, 3.15, 0]} material={palette.accent}>
          <cylinderGeometry args={[0.1, 0.1, 0.14, 12]} />
        </mesh>
      </FailingPiece>
      {/* Switchyard */}
      {[0, 1, 2].map((i) => (
        <FailingPiece key={i} seed={seed} index={4 + i} damage={damage} position={[-0.9 + i * 0.6, 0, 0.9]} height={0.7}>
          <mesh position={[0, 0.35, 0]} material={palette.metal}>
            <boxGeometry args={[0.08, 0.7, 0.08]} />
          </mesh>
        </FailingPiece>
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <planeGeometry args={[4.2, 3]} />
      </mesh>
    </group>
  );
}

export function Lighthouse({ seed, palette, damage }: ModelProps) {
  return (
    <group>
      <FailingPiece seed={seed} index={0} damage={damage} position={[0, 0, 0]} height={2.45}>
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
      </FailingPiece>
      <FailingPiece seed={seed} index={1} damage={damage} position={[0.45, 0, 0.3]} height={0.4}>
        <mesh position={[0, 0.2, 0]} material={palette.wall} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.5]} />
        </mesh>
      </FailingPiece>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={palette.roof} receiveShadow>
        <circleGeometry args={[0.9, 24]} />
      </mesh>
    </group>
  );
}

export function FuelTerminal({ seed, palette, damage }: ModelProps) {
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const r = 0.36 + hash01(seed, i) * 0.14;
        return (
          <FailingPiece key={i} seed={seed} index={i} damage={damage} position={[-1.2 + (i % 3) * 1.15, 0, -0.5 + Math.floor(i / 3) * 1.1]} height={r * 1.8}>
            <mesh position={[0, r * 0.9, 0]} material={palette.wall} castShadow>
              <cylinderGeometry args={[r, r, r * 1.8, 24]} />
            </mesh>
          </FailingPiece>
        );
      })}
      {/* Pipe rack */}
      <mesh position={[0, 0.3, 1.25]} material={palette.metal}>
        <boxGeometry args={[3.6, 0.06, 0.06]} />
      </mesh>
      <mesh position={[0, 0.42, 1.25]} material={palette.accent}>
        <boxGeometry args={[3.6, 0.06, 0.06]} />
      </mesh>
      <FailingPiece seed={seed} index={6} damage={damage} position={[1.7, 0, 0.9]} height={0.5}>
        <mesh position={[0, 0.3, 0]} material={palette.wall} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.5]} />
        </mesh>
      </FailingPiece>
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
