import { useState } from "react";
import { DISASTER_TYPES, DISASTER_TYPE_LABELS } from "../disasterFieldSpecs";
import { useScenarios } from "../hooks/useScenarios";
import { ApiError, scenarioApi } from "../api/scenarioApi";
import type { DisasterType, ScenarioStatus } from "../types";
import { StatusBadge } from "./StatusBadge";

interface ScenarioListPageProps {
  onCreateNew: () => void;
  onView: (scenarioId: string) => void;
}

const STATUS_OPTIONS: ScenarioStatus[] = ["draft", "ready", "archived"];

export function ScenarioListPage({ onCreateNew, onView }: ScenarioListPageProps) {
  const [disasterType, setDisasterType] = useState<DisasterType | "">("");
  const [status, setStatus] = useState<ScenarioStatus | "">("");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { scenarios, total, status: loadStatus, error, refetch } = useScenarios({
    disasterType: disasterType || undefined,
    status: status || undefined,
    search: search || undefined,
    sortBy: "updated_at",
    sortDir: "desc",
  });

  async function handleDuplicate(scenarioId: string) {
    setActionError(null);
    try {
      await scenarioApi.duplicateScenario(scenarioId);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to duplicate scenario.");
    }
  }

  async function handleArchive(scenarioId: string) {
    setActionError(null);
    try {
      await scenarioApi.archiveScenario(scenarioId);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to archive scenario.");
    }
  }

  async function handleCreateRun(scenarioId: string) {
    setActionError(null);
    try {
      await scenarioApi.createRun(scenarioId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to create simulation run.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100">Scenarios</h2>
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          New Scenario
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Disaster type
          <select
            value={disasterType}
            onChange={(e) => setDisasterType(e.target.value as DisasterType | "")}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All</option>
            {DISASTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {DISASTER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ScenarioStatus | "")}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scenario name..."
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
      </div>

      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      {loadStatus === "loading" && <p className="text-sm text-slate-400">Loading scenarios...</p>}
      {loadStatus === "error" && <p className="text-sm text-red-400">{error}</p>}
      {loadStatus === "success" && scenarios.length === 0 && (
        <p className="text-sm text-slate-500">No scenarios match these filters yet.</p>
      )}

      {scenarios.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Disaster type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className="border-b border-slate-900">
                  <td className="py-2 pr-4 text-slate-100">{scenario.name}</td>
                  <td className="py-2 pr-4 text-slate-400">{DISASTER_TYPE_LABELS[scenario.disaster_type]}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={scenario.status} />
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {scenario.current_version_number != null ? `v${scenario.current_version_number}` : "—"}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{scenario.location_name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-500">{new Date(scenario.updated_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onView(scenario.id)}
                        className="text-sky-400 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(scenario.id)}
                        className="text-sky-400 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateRun(scenario.id)}
                        className="text-sky-400 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        Create Run
                      </button>
                      {scenario.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => handleArchive(scenario.id)}
                          className="text-red-400 hover:underline focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Showing {scenarios.length} of {total}
          </p>
        </div>
      )}
    </div>
  );
}
