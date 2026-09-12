import { CheckCircle2, Disc, RadioTower } from "lucide-react";
import { CommandButton, StatusIndicator } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AsyncStatus } from "../hooks/useScenarioSession";
import type { SimulationRun, SimulationStatus } from "../types";
import { HudPanel } from "./HudPanel";

interface RunsPanelProps {
  runs: SimulationRun[];
  recording: boolean;
  error: string | null;
  replayRunId: string | null;
  replayStatus: AsyncStatus;
  canRecord: boolean;
  onRecord: () => void;
  onReplay: (id: string) => void;
  onExitReplay: () => void;
  /** Real, measured outcome of the run that was just computed — never a
   * fabricated progress figure, only reported once the backend has
   * actually returned it. */
  lastRecordedRun: { frameCount: number; durationMs: number } | null;
}

const TONE: Record<SimulationStatus, "ok" | "warning" | "critical" | "offline" | "loading"> = {
  pending: "offline",
  running: "loading",
  completed: "ok",
  failed: "critical",
  cancelled: "offline",
};

function when(run: SimulationRun): string {
  if (!run.created_at) return `#${run.id.slice(0, 8)}`;
  const d = new Date(run.created_at);
  return Number.isNaN(d.getTime()) ? `#${run.id.slice(0, 8)}` : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Recorded runs: "Record run" creates and executes a backend SimulationRun
 * against the current parameters (the authoritative, deterministic record
 * — simulation/), and any completed run can be replayed frame-by-frame.
 * Replay locks the parameters; leaving it returns to the live preview.
 */
export function RunsPanel({
  runs,
  recording,
  error,
  replayRunId,
  replayStatus,
  canRecord,
  onRecord,
  onReplay,
  onExitReplay,
  lastRecordedRun,
}: RunsPanelProps) {
  return (
    <HudPanel
      id="runs"
      title="Recorded runs"
      icon={<Disc className="h-3.5 w-3.5" />}
      defaultCollapsed
      aside={runs.length ? <span className="text-ink-faint font-mono text-[10px]">{runs.length}</span> : null}
      bodyClassName="flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-2">
        <CommandButton tone="accent" disabled={!canRecord || recording} onClick={onRecord} className="flex-1">
          <RadioTower className={cn("h-3.5 w-3.5", recording && "motion-safe:animate-pulse")} />
          {recording ? "Computing run…" : "Record run"}
        </CommandButton>
        {replayRunId ? (
          <CommandButton onClick={onExitReplay}>Back to live</CommandButton>
        ) : null}
      </div>
      {recording ? (
        <div aria-hidden="true" className="border-hairline bg-abyss-2 relative h-[3px] w-full overflow-hidden rounded-full border">
          <span className="bg-accent absolute inset-y-0 left-0 w-1/3 motion-safe:animate-pulse" />
        </div>
      ) : null}
      {!recording && lastRecordedRun ? (
        <p role="status" className="text-status-ok flex items-center gap-1.5 text-[11px]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Run recorded — {lastRecordedRun.frameCount} frame{lastRecordedRun.frameCount === 1 ? "" : "s"} computed in{" "}
          {lastRecordedRun.durationMs} ms
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-status-critical text-[11px]">
          {error}
        </p>
      ) : null}
      {runs.length === 0 ? (
        <p className="text-ink-faint text-[11px]">No recorded runs for this test.</p>
      ) : (
        <ul className="flex max-h-[26vh] flex-col gap-0.5 overflow-y-auto">
          {runs.map((run) => {
            const active = run.id === replayRunId;
            const playable = run.status === "completed" && (run.frame_count ?? 0) > 0;
            return (
              <li key={run.id}>
                <button
                  type="button"
                  disabled={!playable}
                  onClick={() => onReplay(run.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    active ? "bg-status-warning/12" : "hover:bg-white/[0.05]",
                  )}
                >
                  <StatusIndicator tone={TONE[run.status]} label={run.status} />
                  <span className="text-ink-faint ml-auto font-mono text-[10px]">
                    {run.frame_count != null ? `${run.frame_count} fr · ` : ""}
                    {when(run)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {replayRunId && replayStatus === "loading" ? <p className="text-ink-faint text-[11px]">Loading recorded timeline…</p> : null}
    </HudPanel>
  );
}
