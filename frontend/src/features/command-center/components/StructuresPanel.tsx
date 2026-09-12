import { useEffect, useState } from "react";
import { Building2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import type { HazardSnapshot } from "@/propagation/hazards";
import { cn } from "@/lib/utils";
import { STRUCTURE_LABELS } from "../hooks/useScenarioSession";
import type { StructureConfig, StructureImpact, StructureStatus, StructureType } from "../types";
import { HudPanel } from "./HudPanel";

interface StructuresPanelProps {
  structures: StructureConfig[];
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (type: StructureType) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  getSnapshot: () => HazardSnapshot | null;
  locked: boolean;
}

const TYPES = Object.keys(STRUCTURE_LABELS) as StructureType[];
const STATUS_TEXT: Record<StructureStatus, string> = { clear: "Clear", at_risk: "At risk", impacted: "Impacted", severe: "Severe" };
const STATUS_CLASS: Record<StructureStatus, string> = {
  clear: "text-status-ok",
  at_risk: "text-severity-moderate",
  impacted: "text-severity-high",
  severe: "text-status-critical",
};

/**
 * User-placed structures: add by type, drag them on the terrain, toggle
 * each one (a disabled structure is neither drawn nor assessed), rename,
 * remove. Live status per structure from the same snapshot the scene reads
 * (the mirrored exposure rules — src/propagation/structures.ts).
 *
 * The panel carries the caveat for the 3D view's structural response: the
 * models lean and fail as the exposure band rises, and that is an
 * illustration of the band, never a damage or casualty estimate.
 */
export function StructuresPanel({ structures, visible, onVisibleChange, selectedId, onSelect, onAdd, onRemove, onToggle, onRename, getSnapshot, locked }: StructuresPanelProps) {
  const [impacts, setImpacts] = useState<Map<string, StructureImpact>>(new Map());
  const [addType, setAddType] = useState<StructureType>("building");

  useEffect(() => {
    const id = window.setInterval(() => {
      const snap = getSnapshot();
      setImpacts(new Map((snap?.impacts ?? []).map((i) => [i.structure_id, i])));
    }, 250);
    return () => window.clearInterval(id);
  }, [getSnapshot]);

  const affected = structures.filter((s) => s.enabled && (impacts.get(s.id)?.exposure ?? 0) >= 0.05).length;

  return (
    <HudPanel
      id="structures"
      title="Structures"
      icon={<Building2 className="h-3.5 w-3.5" />}
      aside={
        <span className="flex items-center gap-2">
          {structures.length ? (
            <span className={cn("font-mono text-[10px]", affected ? "text-status-warning" : "text-ink-faint")}>
              {affected}/{structures.filter((s) => s.enabled).length} affected
            </span>
          ) : null}
          <span
            role="button"
            tabIndex={0}
            aria-label={visible ? "Hide structures" : "Show structures"}
            onClick={(e) => {
              e.stopPropagation();
              onVisibleChange(!visible);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onVisibleChange(!visible);
              }
            }}
            className="text-ink-faint hover:text-ink cursor-pointer"
          >
            {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </span>
        </span>
      }
      bodyClassName="flex flex-col gap-2.5 p-2"
    >
      <div className="flex items-center gap-1.5">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value as StructureType)}
          disabled={locked}
          aria-label="Structure type"
          className="text-ink h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/5 px-2 text-xs outline-none focus:border-accent/40"
        >
          {TYPES.map((t) => (
            <option key={t} value={t} className="bg-abyss">
              {STRUCTURE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={locked || structures.length >= 50}
          onClick={() => onAdd(addType)}
          className="border-accent-soft bg-accent/12 text-accent-strong hover:bg-accent/20 inline-flex h-8 cursor-pointer items-center gap-1 rounded-[var(--radius-control)] border px-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {structures.length === 0 ? (
        <p className="text-ink-faint px-1 text-[11px] leading-relaxed">Add a structure, then drag it on the land or the coast. Ports and lighthouses snap to the shoreline.</p>
      ) : (
        <ul className="flex max-h-[30vh] flex-col gap-0.5 overflow-y-auto">
          {structures.map((s) => {
            const impact = impacts.get(s.id);
            const status: StructureStatus = s.enabled ? (impact?.status ?? "clear") : "clear";
            const active = s.id === selectedId;
            return (
              <li
                key={s.id}
                className={cn("group flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 transition-colors", active ? "bg-accent/12" : "hover:bg-white/[0.04]", !s.enabled && "opacity-55")}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.enabled}
                  aria-label={`${s.enabled ? "Disable" : "Enable"} ${s.name}`}
                  disabled={locked}
                  onClick={() => onToggle(s.id)}
                  className={cn("relative h-4 w-8 shrink-0 cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed", s.enabled ? "border-accent-soft bg-accent/35" : "border-hairline-strong bg-surface-raised")}
                >
                  <span className={cn("absolute top-[2px] h-[10px] w-[10px] rounded-full transition-all", s.enabled ? "left-[18px] bg-accent-strong" : "left-[2px] bg-ink-faint")} />
                </button>
                <input
                  value={s.name}
                  onChange={(e) => onRename(s.id, e.target.value)}
                  onFocus={() => onSelect(s.id)}
                  disabled={locked}
                  aria-label="Structure name"
                  className="text-ink min-w-0 flex-1 truncate bg-transparent text-xs outline-none focus:text-accent-strong"
                />
                <span className="text-ink-faint shrink-0 text-[10px]">{STRUCTURE_LABELS[s.type]}</span>
                <span className={cn("w-14 shrink-0 text-right text-[10px] font-semibold tracking-[0.08em] uppercase", STATUS_CLASS[status])}>
                  {s.enabled ? STATUS_TEXT[status] : "off"}
                </span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onRemove(s.id)}
                  aria-label={`Remove ${s.name}`}
                  className="text-ink-faint hover:text-status-critical hidden h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] group-hover:flex disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* The 3D models lean and come apart as the exposure band rises. That is
          a rendering of the band, not an outcome — say so where the operator
          reads the statuses, not only in the code (CLAUDE.md §25). */}
      <p className="text-ink-faint mt-2 text-[10px] leading-relaxed">
        Structural response in the 3D view illustrates the exposure band only. AQUASHIELD has no damage model — it is not a
        prediction of damage, collapse or casualties.
      </p>
    </HudPanel>
  );
}
