const UNAVAILABLE = "—";

interface DataReadoutProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}

/** A single label/value technical readout. Never fabricates a value — a
 * missing value renders the explicit "—" placeholder, never a guessed
 * number (Prompt 8 "No fake data"). */
export function DataReadout({ label, value, unit }: DataReadoutProps) {
  const display = value === null || value === undefined || value === "" ? UNAVAILABLE : value;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-ink-faint text-[10px] tracking-[0.12em] uppercase">{label}</span>
      <span className="text-ink font-mono text-sm">
        {display}
        {display !== UNAVAILABLE && unit ? <span className="text-ink-faint ml-1 text-xs">{unit}</span> : null}
      </span>
    </div>
  );
}
