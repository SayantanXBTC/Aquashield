import { CommandButton } from "./CommandButton";

interface ErrorStateProps {
  title: string;
  detail?: string;
  onRetry?: () => void;
}

/** Actionable error state for any async area (simulation, timeline, 3D
 * scene init, scenario fetch) — never a silent failure. */
export function ErrorState({ title, detail, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="text-status-critical text-xs font-semibold tracking-[0.14em] uppercase">{title}</span>
      {detail ? <p className="text-ink-faint max-w-xs text-xs">{detail}</p> : null}
      {onRetry ? (
        <CommandButton tone="accent" onClick={onRetry}>
          Retry
        </CommandButton>
      ) : null}
    </div>
  );
}
