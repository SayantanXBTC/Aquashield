export type StatusTone = "ok" | "warning" | "critical" | "offline" | "loading";

const TONE_COLOR: Record<StatusTone, string> = {
  ok: "bg-status-ok",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  offline: "bg-status-offline",
  loading: "bg-accent",
};

interface StatusIndicatorProps {
  tone: StatusTone;
  label: string;
}

/** A status dot + label — used for backend reachability, simulation run
 * status, and scenario lifecycle state. The dot's color is the only thing
 * that changes; the label always carries the real meaning for a11y. */
export function StatusIndicator({ tone, label }: StatusIndicatorProps) {
  return (
    <span className="text-ink-soft inline-flex items-center gap-2 text-xs">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${TONE_COLOR[tone]} ${tone === "loading" ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
