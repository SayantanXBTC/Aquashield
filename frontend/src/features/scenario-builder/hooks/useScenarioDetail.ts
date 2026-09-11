import { useCallback, useEffect, useState } from "react";
import { ApiError, scenarioApi } from "../api/scenarioApi";
import type { ScenarioDetail, ScenarioVersion, SimulationRun } from "../types";

interface UseScenarioDetailResult {
  scenario: ScenarioDetail | null;
  versions: ScenarioVersion[];
  runs: SimulationRun[];
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  refetch: () => void;
}

export function useScenarioDetail(scenarioId: string | null): UseScenarioDetailResult {
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [versions, setVersions] = useState<ScenarioVersion[]>([]);
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [status, setStatus] = useState<UseScenarioDetailResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    // Resetting to the empty/idle state when scenarioId is cleared, and
    // setting "loading" before the fetch starts, are the standard
    // data-fetching effect pattern (react.dev/learn/you-might-not-need-an-effect's
    // own fetch example does the same) — react-hooks/set-state-in-effect
    // flags it anyway; there's no external-system subscription to defer to here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!scenarioId) {
      setScenario(null);
      setVersions([]);
      setRuns([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    Promise.all([
      scenarioApi.getScenario(scenarioId),
      scenarioApi.getVersions(scenarioId),
      scenarioApi.getRuns(scenarioId),
    ])
      .then(([scenarioResult, versionsResult, runsResult]) => {
        if (cancelled) return;
        setScenario(scenarioResult);
        setVersions(versionsResult);
        setRuns(runsResult);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load scenario.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioId, reloadToken]);

  return { scenario, versions, runs, status, error, refetch };
}
