import { CommandButton, CommandPanel, DataReadout, EmptyState, ErrorState, SectionLabel, StatusIndicator } from "@/components/ui";
import type { StatusTone } from "@/components/ui";
import type { SimulationRunDetail, SimulationStatus, TimelineFrame } from "../types";

const RUN_STATUS_TONE: Record<SimulationStatus, StatusTone> = {
  pending: "offline",
  running: "loading",
  completed: "ok",
  failed: "critical",
  cancelled: "offline",
};

interface SimulationStatusPanelProps {
  runDetail: SimulationRunDetail | null;
  runStatus: "idle" | "loading" | "error";
  runError: string | null;
  executing: boolean;
  onExecute: () => void;
  creatingRun: boolean;
  onCreateRun: () => void;
  hasRuns: boolean;
  frames: TimelineFrame[];
  timelineStatus: "idle" | "loading" | "error";
  timelineError: string | null;
  frameIndex: number;
  onFrameIndexChange: (index: number) => void;
  currentFrameLabel: string | null;
}

export function SimulationStatusPanel({
  runDetail,
  runStatus,
  runError,
  executing,
  onExecute,
  creatingRun,
  onCreateRun,
  hasRuns,
  frames,
  timelineStatus,
  timelineError,
  frameIndex,
  onFrameIndexChange,
  currentFrameLabel,
}: SimulationStatusPanelProps) {
  const frame = frames[frameIndex] ?? null;

  return (
    <CommandPanel
      title="Simulation"
      action={runDetail ? <StatusIndicator tone={RUN_STATUS_TONE[runDetail.status]} label={runDetail.status} /> : undefined}
    >
      <div className="flex flex-col gap-4">
        {runStatus === "error" ? <ErrorState title="Simulation run unavailable" detail={runError ?? undefined} /> : null}

        {!hasRuns ? (
          <EmptyState title="No simulation run exists" detail="Create one to execute this scenario's current version." />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <CommandButton onClick={onCreateRun} disabled={creatingRun}>
            {creatingRun ? "Creating…" : "New run"}
          </CommandButton>
          <CommandButton
            tone="accent"
            onClick={onExecute}
            disabled={!runDetail || runDetail.status !== "pending" || executing}
          >
            {executing ? "Executing…" : "Execute"}
          </CommandButton>
        </div>

        {runDetail ? (
          <div className="grid grid-cols-2 gap-3">
            <DataReadout label="Model" value={runDetail.model_identifier} />
            <DataReadout
              label="Duration"
              value={runDetail.duration_seconds != null ? runDetail.duration_seconds.toFixed(3) : undefined}
              unit="s"
            />
          </div>
        ) : null}

        {timelineStatus === "error" ? (
          <ErrorState title="Timeline unavailable" detail={timelineError ?? undefined} />
        ) : timelineStatus === "loading" ? (
          <p className="text-ink-faint text-xs">Loading timeline…</p>
        ) : frames.length > 0 && frame ? (
          <div className="border-hairline flex flex-col gap-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <DataReadout label="Frame" value={`${frameIndex + 1} / ${frames.length}`} />
              <DataReadout label="Timestep" value={frame.timestep} />
            </div>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={frameIndex}
              onChange={(event) => onFrameIndexChange(Number(event.target.value))}
              aria-label="Timeline frame"
              className="accent-accent w-full"
            />
            {currentFrameLabel ? <p className="text-ink-soft font-mono text-xs">{currentFrameLabel}</p> : null}
          </div>
        ) : runDetail?.status === "completed" ? (
          <div className="border-hairline flex flex-col gap-1 border-t pt-3">
            <SectionLabel>Simulation timeline</SectionLabel>
            <EmptyState
              title="Awaiting playback data"
              detail="This run completed without timeline frames. Timeline playback and scrubbing arrive in a future phase."
            />
          </div>
        ) : null}
      </div>
    </CommandPanel>
  );
}
