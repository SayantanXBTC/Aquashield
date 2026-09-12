import { SlidersHorizontal } from "lucide-react";
import type { HazardKind } from "@/propagation/hazards";
import type { PropagationParams } from "@/propagation/kinematics";
import { HudPanel } from "./HudPanel";
import { ParamSlider } from "./ParamSlider";

interface ParameterPanelProps {
  kind: HazardKind | null;
  params: PropagationParams | null;
  durationHours: number;
  coastDistanceKm: number | null;
  locked: boolean;
  onChange: (update: Partial<PropagationParams>) => void;
  onCommit: () => void;
  onDurationChange: (hours: number) => void;
}

/** Slider ranges per hazard kind — UI bounds only; the backend accepts
 * anything within PropagationConfig's wider limits. */
const SPEED_RANGE: Record<HazardKind, { min: number; max: number; step: number }> = {
  tsunami: { min: 100, max: 900, step: 10 },
  cyclone: { min: 5, max: 60, step: 1 },
  oil_spill: { min: 0.5, max: 12, step: 0.1 },
  coastal_flood: { min: 5, max: 120, step: 1 },
};
const SPREAD_MAX: Record<HazardKind, number> = { tsunami: 40, cyclone: 150, oil_spill: 60, coastal_flood: 40 };
const SPREAD_LABEL: Record<HazardKind, string> = {
  tsunami: "Run-up reach",
  cyclone: "Wind-field radius",
  oil_spill: "Spread radius",
  coastal_flood: "Inundation reach",
};
const DISPERSION_LABEL: Record<HazardKind, string> = {
  tsunami: "Dispersion",
  cyclone: "Inland decay",
  oil_spill: "Dispersion rate",
  coastal_flood: "Recession rate",
};

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 90) return `${minutes.toFixed(0)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

/**
 * Inline propagation controls. Every slider edits the live preview
 * instantly and autosaves on release. "Arrival" is the same quantity as
 * speed seen from the other side (distance to coast along the heading ÷
 * speed), so moving it rewrites speed — one parameter, two handles.
 */
export function ParameterPanel({ kind, params, durationHours, coastDistanceKm, locked, onChange, onCommit, onDurationChange }: ParameterPanelProps) {
  const speedRange = kind ? SPEED_RANGE[kind] : { min: 1, max: 100, step: 1 };
  const arrivalMinutes = params && coastDistanceKm !== null && coastDistanceKm > 0 ? (coastDistanceKm / params.speedKmh) * 60 : null;
  const arrivalMin = coastDistanceKm ? Math.max(1, Math.ceil((coastDistanceKm / speedRange.max) * 60)) : 1;
  const arrivalMax = coastDistanceKm ? Math.max(arrivalMin + 1, Math.floor((coastDistanceKm / speedRange.min) * 60)) : 600;

  return (
    <HudPanel
      id="params"
      title="Parameters"
      icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
      aside={locked ? <span className="text-status-warning text-[10px] tracking-[0.14em] uppercase">Replay · locked</span> : null}
      bodyClassName="flex flex-col gap-3.5"
    >
      {!params || !kind ? (
        <p className="text-ink-faint text-xs">Select or create a test to tune it.</p>
      ) : (
        <>
          <ParamSlider
            label="Heading"
            value={params.headingDeg}
            min={0}
            max={359}
            step={1}
            unit="°"
            format={(v) => `${v.toFixed(0)}`}
            disabled={locked}
            onChange={(v) => onChange({ headingDeg: v })}
            onCommit={onCommit}
            hint={coastDistanceKm === null ? "This heading never reaches the coast" : undefined}
          />
          <ParamSlider
            label="Speed"
            value={params.speedKmh}
            min={speedRange.min}
            max={speedRange.max}
            step={speedRange.step}
            unit="km/h"
            disabled={locked}
            onChange={(v) => onChange({ speedKmh: v })}
            onCommit={onCommit}
          />
          <ParamSlider
            label="Arrival at coast"
            value={arrivalMinutes ?? arrivalMin}
            min={arrivalMin}
            max={arrivalMax}
            step={1}
            format={formatMinutes}
            disabled={locked || arrivalMinutes === null}
            onChange={(minutes) => {
              if (!coastDistanceKm) return;
              const speed = coastDistanceKm / (Math.max(1, minutes) / 60);
              onChange({ speedKmh: Math.max(speedRange.min, Math.min(speedRange.max, speed)) });
            }}
            onCommit={onCommit}
          />
          <ParamSlider
            label="Intensity"
            value={params.intensity}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            disabled={locked}
            onChange={(v) => onChange({ intensity: v })}
            onCommit={onCommit}
          />
          <ParamSlider
            label={SPREAD_LABEL[kind]}
            value={params.spreadRadiusKm}
            min={0}
            max={SPREAD_MAX[kind]}
            step={0.5}
            unit="km"
            disabled={locked}
            onChange={(v) => onChange({ spreadRadiusKm: v })}
            onCommit={onCommit}
          />
          <ParamSlider
            label={DISPERSION_LABEL[kind]}
            value={params.dispersionRate}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            disabled={locked}
            onChange={(v) => onChange({ dispersionRate: v })}
            onCommit={onCommit}
          />
          <ParamSlider
            label="Duration"
            value={durationHours}
            min={0.5}
            max={48}
            step={0.5}
            unit="h"
            disabled={locked}
            onChange={onDurationChange}
            onCommit={() => undefined}
          />
          <p className="text-ink-faint text-[10px] leading-relaxed">Drag the origin pin on the water to move the start point.</p>
        </>
      )}
    </HudPanel>
  );
}
