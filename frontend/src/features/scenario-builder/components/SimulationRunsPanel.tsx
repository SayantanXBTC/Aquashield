import { useState } from "react";
import { ApiError, scenarioApi } from "../api/scenarioApi";
import type { SimulationRun } from "../types";
import { StatusBadge } from "./StatusBadge";

interface SimulationRunsPanelProps {
  scenarioId: string;
  runs: SimulationRun[];
  onRunCreated: () => void;
}

/** Creates run METADATA only — the simulation engine doesn't exist yet
 * (§16/§32). No result is ever faked here. */
export function SimulationRunsPanel({ scenarioId, runs, onRunCreated }: SimulationRunsPanelProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRun() {
    setCreating(true);
    setError(null);
    try {
      await scenarioApi.createRun(scenarioId);
      onRunCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create simulation run.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleCreateRun}
        disabled={creating}
        className="self-start rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {creating ? "Creating..." : "Create Simulation Run"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {runs.length === 0 ? (
        <p className="text-sm text-slate-500">No simulation runs yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li
              key={run.id}
              className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-900/50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{run.id}</span>
                <StatusBadge status={run.status} kind="run" />
              </div>
              <p className="text-xs text-slate-500">
                {run.created_at ? new Date(run.created_at).toLocaleString() : ""}
              </p>
              <p className="text-sm text-amber-400">
                Simulation run created; simulation engine not yet executed.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
