import { cn } from "@/lib/utils";
import { TOWNS } from "../towns";
import type { CityId } from "../types";

interface CityPickerProps {
  value: CityId | null;
  onChange: (id: CityId) => void;
}

/** Schematic pin positions in the outline's own coordinate space — a fixed,
 * hand-placed UI layout, never computed from real lat/lon at runtime
 * (architecture.md ADR-009: real geodata only ever enters the repo via
 * scripts/build_town_data.py, never the running app). */
const PINS: { id: CityId; label: string; x: number; y: number }[] = [
  { id: "mumbai", label: "Mumbai", x: 62, y: 158 },
  { id: "kochi", label: "Kochi", x: 92, y: 268 },
  { id: "chennai", label: "Chennai", x: 148, y: 236 },
  { id: "visakhapatnam", label: "Visakhapatnam", x: 168, y: 180 },
  { id: "puri", label: "Puri", x: 186, y: 148 },
];

/**
 * DECORATIVE / SCHEMATIC OUTLINE — not GIS data, not a map (CLAUDE.md §27).
 * A simplified India silhouette with pins at the five curated real cities
 * (architecture.md ADR-009). Only a city with a committed
 * shared/constants/towns/<id>.json is selectable — the rest render disabled
 * until their data exists, rather than letting a pick silently fall back to
 * the fictional world.
 */
export function CityPicker({ value, onChange }: CityPickerProps) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <svg viewBox="0 0 220 300" className="mx-auto h-40 w-auto" aria-hidden="true">
        <path
          d="M70 10 L130 8 L150 40 L145 70 L165 90 L175 130 L190 140 L200 170 L180 175 L175 200 L150 210 L140 240 L120 260 L100 280 L85 265 L90 240 L70 220 L55 210 L50 180 L35 160 L40 130 L55 110 L45 90 L55 60 L50 30 Z"
          fill="rgba(255,255,255,0.06)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1.5}
        />
        {PINS.map((pin) => {
          const available = Boolean(TOWNS[pin.id]);
          const active = value === pin.id;
          return (
            <g
              key={pin.id}
              role={available ? "radio" : undefined}
              aria-checked={active}
              aria-disabled={!available}
              tabIndex={available ? 0 : undefined}
              onClick={() => available && onChange(pin.id)}
              onKeyDown={(e) => {
                if (available && (e.key === "Enter" || e.key === " ")) onChange(pin.id);
              }}
              className={available ? "cursor-pointer" : "cursor-not-allowed"}
            >
              <circle
                cx={pin.x}
                cy={pin.y}
                r={active ? 7 : 5}
                className={cn(
                  "transition-all",
                  !available ? "fill-white/10" : active ? "fill-accent-strong" : "fill-white/40 hover:fill-white/70",
                )}
              />
              <text x={pin.x} y={pin.y - 11} textAnchor="middle" className={cn("text-[9px]", available ? "fill-white/70" : "fill-white/25")}>
                {pin.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-ink-faint mt-1 text-center text-[10px] leading-snug">
        Real coastline &amp; building geometry, simplified physics — not an operational forecast. Greyed pins have no data yet.
      </p>
    </div>
  );
}
