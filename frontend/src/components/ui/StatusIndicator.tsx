export type StatusTone = "ok" | "warning" | "critical" | "offline" | "loading";

const TONE_COLOR: Record<StatusTone, string> = {
  ok: "bg-status-ok",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  offline: "bg-status-offline",
  loading: "bg-accent",
};

const TONE_TEXT: Record<StatusTone, string> = {
  ok: "text-status-ok",
  warning: "text-status-warning",
  critical: "text-status-critical",
  offline: "text-ink-faint",
  loading: "text-accent-strong",
};

interface StatusIndicatorProps {
  tone: StatusTone;
  label: string;
}

/** A status dot + label — used for backend reachability, simulation run
 * status, and scenario lifecycle state. The label always carries the real
 * meaning; the dot is redundant reinforcement, never the sole signal. */
export function StatusIndicator({ tone, label }: StatusIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase ${TONE_TEXT[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${TONE_COLOR[tone]} ${tone === "loading" ? "motion-safe:animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
