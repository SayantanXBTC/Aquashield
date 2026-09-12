import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import type { StructureConfig, StructureImpact, StructureStatus } from "@shared/types";
import type { HazardKind, HazardSnapshot } from "@/propagation/hazards";
import { shoreX, WORLD_KM } from "@/propagation/world";
import { SceneLabel } from "@/three/overlays/SceneLabel";
import { hazardChannel } from "@/three/hazard/hazardChannel";
import { kmToScene } from "@/three/world/demoWorld";
import { useGroundDrag } from "@/three/markers/useGroundDrag";
import { createDamageState, updateDamageState, type DamageState } from "./collapse";
import { STRUCTURE_MODELS } from "./models";
import { applyDamage, COASTAL_TYPES, createPalette, disposePalette, footprintGround, hash01, shoreAlignedRotationY, STATUS_COLOR } from "./support";

interface StructureModelProps {
  structure: StructureConfig;
  getSnapshot: () => HazardSnapshot | null;
  onDrag: (id: string, xKm: number, yKm: number) => void;
  onDragEnd: () => void;
  locked: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

const STRUCTURE_VISUAL_SCALE = 2;
/** Half-extent of a drawn structure on the ground, in km — models are
 * authored at a ~3 km footprint and drawn at STRUCTURE_VISUAL_SCALE. */
const FOOTPRINT_RADIUS_KM = 3.4;
const STATUS_LABEL: Record<StructureStatus, string> = { clear: "clear", at_risk: "at risk", impacted: "impacted", severe: "severe" };

/**
 * VISUAL DEMONSTRATION — one user-placed structure: a procedural model
 * (three/structures/models) seated on the terrain surface, a foundation that
 * closes the gap on sloping ground, a status ring, a drag hit target and a
 * label.
 *
 * Each frame it reads its own entry from the snapshot's `impacts` (the
 * mirrored exposure rules) and draws that exposure: colours tint, a cyclone
 * shakes it, and inside the `severe` band the model leans and fails
 * progressively (three/structures/collapse.ts). That failure is an
 * ILLUSTRATION OF THE EXPOSURE BAND, not a damage prediction — AQUASHIELD has
 * no damage model — and it is reversible, so scrubbing the timeline back
 * stands the structure up again. Nothing here computes exposure.
 */
export function StructureModel({ structure, getSnapshot, onDrag, onDragEnd, locked, selected, onSelect }: StructureModelProps) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const rubbleRef = useRef<Group>(null);
  const [status, setStatus] = useState<StructureStatus>("clear");
  const lastLabelAt = useRef(0);
  const palette = useMemo(() => createPalette(structure.type, structure.id), [structure.type, structure.id]);
  useEffect(() => () => disposePalette(palette), [palette]);
  // One mutable state object per structure, read by the model's own pieces.
  // Mutable (not React state) because it updates every frame.
  const damage = useMemo<DamageState>(() => createDamageState(), []);

  const coastal = COASTAL_TYPES.has(structure.type);
  const clamp = useCallback(
    (xRaw: number, yRaw: number): [number, number] => {
      const y = Math.max(2, Math.min(WORLD_KM - 2, yRaw));
      const shore = shoreX(y);
      if (coastal) return [shore + 0.6, y]; // snaps to the shoreline
      return [Math.max(shore + 1.2, Math.min(WORLD_KM - 2, xRaw)), y];
    },
    [coastal],
  );
  const { handlers, hovered, dragging } = useGroundDrag({
    onDrag: (x, y) => onDrag(structure.id, x, y),
    onDragEnd,
    clamp,
    disabled: locked,
  });

  const [sx, sz] = kmToScene(structure.x_km, structure.y_km);
  // Seat the model on the highest ground under its footprint and let the
  // foundation reach down to the lowest — so it never floats and never sinks.
  const { baseY, reliefY } = useMemo(
    () => footprintGround(structure.x_km, structure.y_km, FOOTPRINT_RADIUS_KM),
    [structure.x_km, structure.y_km],
  );
  const foundationDepth = reliefY + 0.9;
  const rotationY = coastal ? shoreAlignedRotationY(structure.y_km) : 0;
  const Model = STRUCTURE_MODELS[structure.type];
  // Stagger label heights so neighbouring callouts don't stack on one line.
  const labelLift = (parseInt(structure.id.slice(-2), 36) % 4) * 1.4;

  const rubble = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: (hash01(structure.id, i * 13 + 1) - 0.5) * 5.2,
        z: (hash01(structure.id, i * 29 + 7) - 0.5) * 4.6,
        w: 0.6 + hash01(structure.id, i * 7 + 3) * 1.5,
        d: 0.5 + hash01(structure.id, i * 11 + 5) * 1.3,
        h: 0.18 + hash01(structure.id, i * 17 + 9) * 0.4,
        r: hash01(structure.id, i * 19 + 2) * Math.PI,
      })),
    [structure.id],
  );
  const rubbleMaterial = useMemo(() => new MeshStandardMaterial({ color: "#6a6157", roughness: 1, metalness: 0 }), []);
  useEffect(() => () => rubbleMaterial.dispose(), [rubbleMaterial]);

  useFrame(({ clock }, delta) => {
    const snapshot = getSnapshot();
    const impact: StructureImpact | undefined = snapshot?.impacts?.find((i) => i.structure_id === structure.id);
    const exposure = impact?.exposure ?? 0;
    const kind: HazardKind | null = snapshot?.kind ?? null;
    applyDamage(palette, exposure, kind);
    // The hazard's scene-space heading, expressed in this model's own frame
    // (coastal models are rotated to the shoreline), so pieces fall downstream.
    updateDamageState(damage, exposure, kind, delta, clock.elapsedTime, hazardChannel.headingRad - rotationY);

    const g = groupRef.current;
    if (g) {
      // Cyclone: wind-battered shake proportional to exposure. The model's
      // own pieces add their lean and failure on top (collapse.ts).
      if (kind === "cyclone" && exposure > 0.05) {
        const t = clock.elapsedTime * 22;
        g.rotation.x = Math.sin(t) * 0.012 * exposure;
        g.rotation.z = Math.cos(t * 1.3) * 0.012 * exposure;
      } else {
        g.rotation.x = 0;
        g.rotation.z = 0;
      }
    }
    const debris = rubbleRef.current;
    if (debris) {
      // Debris only appears where pieces have actually come down.
      const s = Math.max(0.001, damage.collapse);
      debris.visible = damage.collapse > 0.02;
      debris.scale.set(s, Math.min(1, s * 1.6), s);
    }
    const ring = ringRef.current;
    if (ring) {
      const m = ring.material as MeshBasicMaterial;
      const next = impact?.status ?? "clear";
      m.color.set(dragging ? "#ffffff" : STATUS_COLOR[next]);
      m.opacity = 0.45 + exposure * 0.4 + (hovered || selected ? 0.25 : 0);
      ring.scale.setScalar(1 + (exposure > 0.05 ? Math.sin(clock.elapsedTime * 3) * 0.05 * exposure : 0));
      if (clock.elapsedTime - lastLabelAt.current > 0.3) {
        lastLabelAt.current = clock.elapsedTime;
        setStatus((prev) => (prev === next ? prev : next));
      }
    }
  });

  return (
    <group position={[sx, baseY, sz]} rotation={[0, rotationY, 0]}>
      {/* Hit target for drag/select. */}
      <mesh
        position={[0, 2.4, 0]}
        {...handlers}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(structure.id);
        }}
      >
        <cylinderGeometry args={[4.6, 4.6, 6, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Foundation: reaches from the base down past the lowest ground under
          the footprint, so the model meets the terrain on every side. */}
      <mesh position={[0, -foundationDepth / 2 + 0.04, 0]} material={rubbleMaterial} receiveShadow>
        <cylinderGeometry args={[4.5, 4.7, foundationDepth, 24]} />
      </mesh>

      {/* Models are authored at ~3 km footprints; drawn at 2x so they read
          from the framing camera distance (a documented visual scale). */}
      <group ref={groupRef} scale={STRUCTURE_VISUAL_SCALE}>
        <Model seed={structure.id} palette={palette} damage={damage} />
      </group>

      {/* Debris field — drawn only as far as the failure illustration goes. */}
      <group ref={rubbleRef} visible={false}>
        {rubble.map((r, i) => (
          <mesh key={i} position={[r.x, r.h / 2 + 0.05, r.z]} rotation={[0, r.r, 0]} material={rubbleMaterial} castShadow receiveShadow>
            <boxGeometry args={[r.w, r.h, r.d]} />
          </mesh>
        ))}
      </group>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[4.4, 4.8, 48]} />
        <meshBasicMaterial color={STATUS_COLOR.clear} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {status !== "clear" || selected || hovered || dragging ? (
        <SceneLabel position={[0, 6.5 + labelLift, 0]} tone={status === "clear" ? "muted" : "primary"}>
          <span style={{ color: STATUS_COLOR[status] }}>{structure.name}</span>
          {status !== "clear" ? <span className="text-ink-faint"> · {STATUS_LABEL[status]}</span> : null}
        </SceneLabel>
      ) : null}
    </group>
  );
}
