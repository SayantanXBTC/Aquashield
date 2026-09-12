import { SectionLabel } from "@/components/ui";
import { formatRunOptionLabel, formatRunTimestamp } from "../utils/runFormatting";
import type { SimulationRun } from "../types";

interface RunSelectorProps {
  runs: SimulationRun[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
}

/** Prompt 10.1: lets a user see and explicitly switch between a scenario's
 * available simulation runs — the auto-selection in useCommandCenterSession
 * (backend/app/services/run_selection.py's priority) only ever picks a
 * *default*; a FAILED/CANCELLED run, or any older completed run, is still
 * reachable here by explicit choice. Follows the same native-`<select>`
 * pattern as ScenarioContextPanel's scenario picker rather than inventing a
 * new control. Real per-run status + frame_count only — never a fabricated
 * count (see runFormatting.ts). */
export function RunSelector({ runs, selectedRunId, onSelectRun }: RunSelectorProps) {
  if (runs.length === 0) return null;

  return (
    <label className="flex flex-col gap-1.5">
      <SectionLabel>Run</SectionLabel>
      <select
        value={selectedRunId ?? ""}
        onChange={(event) => onSelectRun(event.target.value)}
        className="bg-surface-raised border-hairline-strong text-ink focus-visible:ring-accent-strong rounded-[var(--radius-control)] border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Simulation run"
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {formatRunOptionLabel(run)} ({formatRunTimestamp(run)})
          </option>
        ))}
      </select>
    </label>
  );
}
