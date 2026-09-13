import type { StructureConfig } from "@shared/types";
import type { HazardSnapshot } from "@/propagation/hazards";
import type { ShoreParams } from "@/propagation/world";
import { StructureModel } from "./StructureModel";

export interface StructureLayerProps {
  structures: StructureConfig[];
  visible: boolean;
  getSnapshot: () => HazardSnapshot | null;
  onDrag: (id: string, xKm: number, yKm: number) => void;
  onDragEnd: () => void;
  locked: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Dense Coastal Profile's flat-canvas choice, threaded to every model. */
  flat?: boolean;
  /** A curated real city's fitted shoreline (architecture.md ADR-009), or
   * the fictional demo curve by default. */
  shoreParams?: ShoreParams;
}

/** Every enabled, user-placed structure (three/structures/StructureModel).
 * Disabled structures are not rendered and not assessed. */
export function StructureLayer({ structures, visible, getSnapshot, onDrag, onDragEnd, locked, selectedId, onSelect, flat, shoreParams }: StructureLayerProps) {
  if (!visible) return null;
  return (
    <group>
      {structures
        .filter((s) => s.enabled)
        .map((s) => (
          <StructureModel
            key={s.id}
            structure={s}
            getSnapshot={getSnapshot}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            locked={locked}
            selected={s.id === selectedId}
            onSelect={onSelect}
            flat={flat}
            shoreParams={shoreParams}
          />
        ))}
    </group>
  );
}
