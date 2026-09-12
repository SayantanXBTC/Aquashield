import type { ReactNode } from "react";

const UNAVAILABLE = "—";

interface MetricTileProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  icon?: ReactNode;
  tone?: "default" | "accent" | "warning" | "critical";
}

/**
 * A headline figure in the impact/hazard readout strip — bigger than a
 * DataReadout, same honesty contract: a missing value renders the explicit
 * "—" placeholder and never an invented number (CLAUDE.md §27).
 */
export function MetricTile({ label, value, unit, icon, tone = "default" }: MetricTileProps) {
  const missing = value === null || value === undefined || value === "";
  const display = missing ? UNAVAILABLE : value;
  const valueTone = missing
    ? "text-ink-faint"
    : tone === "critical"
      ? "text-status-critical"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "accent"
          ? "text-accent-strong"
          : "text-ink";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-ink-faint flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className={`font-mono text-lg leading-none font-medium ${valueTone}`}>
        {display}
        {!missing && unit ? <span className="text-ink-faint ml-1 text-xs">{unit}</span> : null}
      </span>
    </div>
  );
}
