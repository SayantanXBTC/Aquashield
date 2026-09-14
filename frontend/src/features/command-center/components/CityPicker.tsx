import { useState } from "react";
import { cn } from "@/lib/utils";
import { MetricTile } from "@/components/ui";
import { TOWNS } from "../towns";
import type { CityId, TownProfile } from "../types";

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

const OCEAN_PHRASE: Record<TownProfile["ocean_side"], string> = {
  east: "Bay of Bengal",
  west: "Arabian Sea",
};

function footprintExtentKm(buildings: TownProfile["buildings"]): { xKm: number; yKm: number } | null {
  if (!buildings.length) return null;
  let minX = buildings[0].xKm;
  let maxX = buildings[0].xKm;
  let minY = buildings[0].yKm;
  let maxY = buildings[0].yKm;
  for (const b of buildings) {
    if (b.xKm < minX) minX = b.xKm;
    if (b.xKm > maxX) maxX = b.xKm;
    if (b.yKm < minY) minY = b.yKm;
    if (b.yKm > maxY) maxY = b.yKm;
  }
  return { xKm: maxX - minX, yKm: maxY - minY };
}

/**
 * DECORATIVE / SCHEMATIC OUTLINE — not GIS data, not a map (CLAUDE.md §27).
 * A simplified India silhouette with pins at the five curated real cities
 * (architecture.md ADR-009). Only a city with a committed
 * shared/constants/towns/<id>.json is selectable — the rest render disabled
 * until their data exists, rather than letting a pick silently fall back to
 * the fictional world. The pin map and the stat cards drive the same
 * selection and hover state, so either surface can be used to choose.
 */
export function CityPicker({ value, onChange }: CityPickerProps) {
  const [hovered, setHovered] = useState<CityId | null>(null);

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <svg viewBox="0 0 220 300" className="mx-auto h-72 w-auto shrink-0 sm:h-80" aria-label="Curated cities, schematic positions">
          <path
            d="M70 10 L130 8 L150 40 L145 70 L165 90 L175 130 L190 140 L200 170 L180 175 L175 200 L150 210 L140 240 L120 260 L100 280 L85 265 L90 240 L70 220 L55 210 L50 180 L35 160 L40 130 L55 110 L45 90 L55 60 L50 30 Z"
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.5}
          />
          {PINS.map((pin) => {
            const available = Boolean(TOWNS[pin.id]);
            const active = value === pin.id;
            const highlighted = available && (active || hovered === pin.id);
            return (
              <g
                key={pin.id}
                role={available ? "radio" : undefined}
                aria-checked={active}
                aria-disabled={!available}
                aria-label={pin.label}
                tabIndex={available ? 0 : undefined}
                onClick={() => available && onChange(pin.id)}
                onKeyDown={(e) => {
                  if (available && (e.key === "Enter" || e.key === " ")) onChange(pin.id);
                }}
                onMouseEnter={() => available && setHovered(pin.id)}
                onMouseLeave={() => setHovered((h) => (h === pin.id ? null : h))}
                className={available ? "cursor-pointer" : "cursor-not-allowed"}
              >
                {highlighted ? <circle cx={pin.x} cy={pin.y} r={active ? 22 : 17} className="fill-accent/10" /> : null}
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={active ? 12 : 9}
                  className={cn(
                    "stroke-2 transition-all",
                    !available
                      ? "fill-white/10 stroke-white/10"
                      : active
                        ? "fill-accent-strong stroke-accent-strong"
                        : hovered === pin.id
                          ? "fill-white/70 stroke-white/70"
                          : "fill-white/35 stroke-white/35",
                  )}
                />
                {active ? <circle cx={pin.x} cy={pin.y} r={4} className="fill-void" /> : null}
                <text
                  x={pin.x}
                  y={pin.y - (active ? 19 : 15)}
                  textAnchor="middle"
                  className={cn(
                    "text-[13px] font-semibold",
                    !available ? "fill-white/25" : active ? "fill-accent-strong" : "fill-white/80",
                  )}
                >
                  {pin.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex max-h-72 flex-1 flex-col gap-2 overflow-y-auto sm:max-h-80">
          {PINS.map((pin) => {
            const town = TOWNS[pin.id];
            const available = Boolean(town);
            const active = value === pin.id;
            const highlighted = available && (active || hovered === pin.id);
            const extent = town ? footprintExtentKm(town.buildings) : null;
            return (
              <button
                key={pin.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!available}
                onClick={() => available && onChange(pin.id)}
                onMouseEnter={() => available && setHovered(pin.id)}
                onMouseLeave={() => setHovered((h) => (h === pin.id ? null : h))}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  !available
                    ? "cursor-not-allowed border-white/[0.06] bg-white/[0.015] opacity-50"
                    : active
                      ? "cursor-pointer border-accent/60 bg-accent/10"
                      : highlighted
                        ? "cursor-pointer border-white/20 bg-white/[0.06]"
                        : "cursor-pointer border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-xs font-semibold tracking-[0.06em]", !available ? "text-ink-faint" : active ? "text-accent-strong" : "text-ink")}>
                    {town?.label ?? pin.label}
                  </span>
                  {town ? <span className="text-ink-faint text-[10px] uppercase">Faces {OCEAN_PHRASE[town.ocean_side]}</span> : null}
                </div>
                {town ? (
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <MetricTile label="Buildings" value={town.buildings.length} />
                    <MetricTile label="Footprint" value={extent ? `${extent.xKm.toFixed(1)} × ${extent.yKm.toFixed(1)}` : null} unit={extent ? "km" : undefined} />
                    <MetricTile label="Coastline fit" value={town.fit_quality ? town.fit_quality.rmse_km.toFixed(2) : null} unit={town.fit_quality ? "km rmse" : undefined} />
                    <MetricTile label="Fit samples" value={town.fit_quality ? town.fit_quality.sample_count : null} />
                  </div>
                ) : (
                  <p className="text-ink-faint mt-1 text-[11px] leading-snug">No committed data yet — unavailable in Real City mode.</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-ink-faint mt-3 text-center text-[10px] leading-snug">
        Real coastline &amp; building geometry, simplified physics — not an operational forecast. Greyed cities have no data yet.
      </p>
    </div>
  );
}
