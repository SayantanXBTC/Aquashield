interface LoadingOverlayProps {
  /** Ordered system checklist, e.g. ["Environment", "Simulation", "Visualization"].
   * These reflect real module load order, not a fabricated progress percentage —
   * Prompt 8 explicitly forbids showing an invented "73%". */
  stages: string[];
  /** Index of the stage currently loading, if known. Omit for a purely
   * indeterminate state. */
  activeStage?: number;
}

/** The AQUASHIELD-branded loading experience shown while a lazy-loaded
 * chunk (the command center, the 3D scene) is fetched/initialized. No
 * fabricated percentage — an indeterminate sweep plus a real stage list. */
export function LoadingOverlay({ stages, activeStage }: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-void fixed inset-0 z-50 flex flex-col items-center justify-center gap-8"
    >
      <div className="border-hairline-strong relative h-10 w-10 overflow-hidden rounded-full border">
        <div className="motion-safe:animate-[spin_1.4s_linear_infinite] absolute inset-0">
          <div className="bg-accent absolute top-0 left-1/2 h-1/2 w-[2px] -translate-x-1/2 opacity-90" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-ink text-xs font-semibold tracking-[0.3em] uppercase">Initializing AQUASHIELD</p>
        <ul className="flex flex-col gap-1.5">
          {stages.map((stage, index) => {
            const isDone = activeStage !== undefined && index < activeStage;
            const isActive = index === activeStage;
            return (
              <li
                key={stage}
                className={`flex items-center gap-2 text-[11px] tracking-[0.08em] uppercase ${
                  isDone ? "text-status-ok" : isActive ? "text-accent-strong" : "text-ink-faint"
                }`}
              >
                <span aria-hidden="true" className="font-mono">
                  {isDone ? "✓" : "·"}
                </span>
                {stage}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
