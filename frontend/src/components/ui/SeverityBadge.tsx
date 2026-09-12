export type SeverityBand = "low" | "moderate" | "high" | "critical";

const BAND_CLASS: Record<SeverityBand, string> = {
  low: "border-status-ok/50 text-status-ok bg-status-ok/10",
  moderate: "border-severity-moderate/50 text-severity-moderate bg-severity-moderate/10",
  high: "border-severity-high/50 text-severity-high bg-severity-high/10",
  critical: "border-status-critical/60 text-status-critical bg-status-critical/12",
};

const BAND_LABEL: Record<SeverityBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

/** AQUASHIELD's own documented UI severity band (backend/app/services/
 * impact_severity.py) — not an official hazard scale, and never rendered
 * for a band the backend didn't actually return. The written label, not the
 * color, is what carries the meaning. */
export function SeverityBadge({ band }: { band: SeverityBand }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-control)] border px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase ${BAND_CLASS[band]}`}
    >
      {BAND_LABEL[band]}
    </span>
  );
}

export function isSeverityBand(value: unknown): value is SeverityBand {
  return value === "low" || value === "moderate" || value === "high" || value === "critical";
}
