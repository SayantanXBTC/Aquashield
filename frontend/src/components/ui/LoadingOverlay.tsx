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
      className="bg-void fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 px-6"
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-ink text-[11px] font-semibold tracking-[0.34em] uppercase">Initializing AQUASHIELD</p>
        {/* Indeterminate sweep — a moving band on a fixed track, never a
            percentage-width bar, because there is no measured progress. */}
        <div className="border-hairline bg-abyss-2 relative h-[3px] w-56 overflow-hidden rounded-full border">
          <span
            aria-hidden="true"
            className="bg-accent absolute inset-y-0 w-1/3 motion-safe:animate-[loading-sweep_1.3s_ease-in-out_infinite]"
          />
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {stages.map((stage, index) => {
          const isDone = activeStage !== undefined && index < activeStage;
          const isActive = index === activeStage;
          return (
            <li
              key={stage}
              className={`flex items-center gap-2.5 text-[11px] tracking-[0.12em] uppercase ${
                isDone ? "text-status-ok" : isActive ? "text-accent-strong" : "text-ink-faint"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1 w-1 rounded-full ${
                  isDone ? "bg-status-ok" : isActive ? "bg-accent-strong" : "bg-ink-faint"
                }`}
              />
              {stage}
            </li>
          );
        })}
      </ul>

      <style>{`@keyframes loading-sweep { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}
