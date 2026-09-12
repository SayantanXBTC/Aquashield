import { CommandButton } from "./CommandButton";
import { IconAlert } from "./icons";

interface ErrorStateProps {
  title: string;
  detail?: string;
  onRetry?: () => void;
}

/** Actionable error state for any async area (simulation, timeline, 3D
 * scene init, scenario fetch) — never a silent failure. Icon + text + a
 * recovery path, not a red word on its own. */
export function ErrorState({ title, detail, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-status-critical/40 bg-status-critical/8 flex flex-col gap-2 rounded-[var(--radius-control)] border px-3 py-3"
    >
      <span className="text-status-critical flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] uppercase">
        <IconAlert size={14} />
        {title}
      </span>
      {detail ? <p className="text-ink-soft text-[11px] leading-relaxed">{detail}</p> : null}
      {onRetry ? (
        <div>
          <CommandButton size="sm" onClick={onRetry}>
            Retry
          </CommandButton>
        </div>
      ) : null}
    </div>
  );
}
