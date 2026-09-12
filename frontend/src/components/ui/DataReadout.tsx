const UNAVAILABLE = "—";

interface DataReadoutProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  /** Right-align the value — used inside a two-column key/value row. */
  align?: "left" | "right";
}

/** A single label/value technical readout. Never fabricates a value — a
 * missing value renders the explicit "—" placeholder, never a guessed
 * number (Prompt 8 "No fake data"). */
export function DataReadout({ label, value, unit, align = "left" }: DataReadoutProps) {
  const missing = value === null || value === undefined || value === "";
  const display = missing ? UNAVAILABLE : value;
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${align === "right" ? "items-end" : ""}`}>
      <span className="text-ink-faint truncate text-[10px] tracking-[0.12em] uppercase">{label}</span>
      <span className={`truncate font-mono text-xs ${missing ? "text-ink-faint" : "text-ink"}`}>
        {display}
        {!missing && unit ? <span className="text-ink-faint ml-1">{unit}</span> : null}
      </span>
    </div>
  );
}
