import { startTransition, useCallback, useEffect, useState } from "react";
import { scenarioApi } from "@/features/scenario-builder/api/scenarioApi";
import { simulationApi } from "../api/simulationApi";
import type {
  ScenarioDetail,
  ScenarioListItem,
  SimulationRun,
  SimulationRunDetail,
  TimelineFrame,
} from "../types";

type AsyncStatus = "idle" | "loading" | "error";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Orchestrates the real Prompt 7 data flow this feature exists to prove out:
 *
 *   Scenario -> SimulationRun -> Simulation API -> Timeline Frames -> frontend state
 *
 * Every value here comes from an actual backend response — nothing is
 * fabricated to make the UI look alive. Prompt 9 will extend this into full
 * playback/scrubbing; this hook is the foundation it builds on, not a
 * throwaway prototype.
 */
export function useCommandCenterSession() {
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [scenariosStatus, setScenariosStatus] = useState<AsyncStatus>("loading");
  const [scenariosError, setScenariosError] = useState<string | null>(null);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioDetail, setScenarioDetail] = useState<ScenarioDetail | null>(null);
  const [scenarioStatus, setScenarioStatus] = useState<AsyncStatus>("idle");
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<SimulationRunDetail | null>(null);
  const [runStatus, setRunStatus] = useState<AsyncStatus>("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);

  const [frames, setFrames] = useState<TimelineFrame[]>([]);
  const [timelineStatus, setTimelineStatus] = useState<AsyncStatus>("idle");
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  const loadScenarios = useCallback(async () => {
    // Marked non-urgent (startTransition) rather than a bare synchronous
    // setState: this can run at the top of a useEffect body (the mount
    // effect below), and React's effect rules flag an un-deferred setState
    // there as a cascading-render risk. See docs/development/
    // command-center.md "Known limitations" for why every status reset in
    // this hook follows the same pattern.
    startTransition(() => {
      setScenariosStatus("loading");
      setScenariosError(null);
    });
    try {
      const page = await scenarioApi.getScenarios({ status: "ready", limit: 50, sortBy: "updated_at" });
      setScenarios(page.items);
      setScenariosStatus("idle");
      setSelectedScenarioId((current) => current ?? page.items[0]?.id ?? null);
    } catch (err) {
      setScenariosStatus("error");
      setScenariosError(errorMessage(err, "Failed to load scenarios"));
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadScenarios();
    });
  }, [loadScenarios]);

  useEffect(() => {
    if (!selectedScenarioId) return;
    let cancelled = false;
    startTransition(() => {
      setScenarioStatus("loading");
      setScenarioError(null);
      setRunDetail(null);
      setFrames([]);
      setFrameIndex(0);
    });

    (async () => {
      try {
        const [detail, runList] = await Promise.all([
          scenarioApi.getScenario(selectedScenarioId),
          scenarioApi.getRuns(selectedScenarioId),
        ]);
        if (cancelled) return;
        setScenarioDetail(detail);
        setRuns(runList);
        setScenarioStatus("idle");
        setSelectedRunId(runList[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        setScenarioStatus("error");
        setScenarioError(errorMessage(err, "Failed to load scenario"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedScenarioId]);

  useEffect(() => {
    if (!selectedRunId) {
      startTransition(() => setRunDetail(null));
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setRunStatus("loading");
      setRunError(null);
    });

    (async () => {
      try {
        const detail = await simulationApi.getRun(selectedRunId);
        if (cancelled) return;
        setRunDetail(detail);
        setRunStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setRunStatus("error");
        setRunError(errorMessage(err, "Failed to load simulation run"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    if (!runDetail || runDetail.status !== "completed") {
      startTransition(() => setFrames([]));
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setTimelineStatus("loading");
      setTimelineError(null);
    });

    (async () => {
      try {
        const response = await simulationApi.getTimeline(runDetail.id);
        if (cancelled) return;
        setFrames(response.frames);
        setFrameIndex(0);
        setTimelineStatus("idle");
      } catch (err) {
        if (cancelled) return;
        setTimelineStatus("error");
        setTimelineError(errorMessage(err, "Failed to load timeline"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runDetail]);

  const executeRun = useCallback(async () => {
    if (!selectedRunId) return;
    setExecuting(true);
    setRunError(null);
    try {
      const detail = await simulationApi.executeRun(selectedRunId);
      setRunDetail(detail);
      setRunStatus("idle");
    } catch (err) {
      setRunStatus("error");
      setRunError(errorMessage(err, "Execution failed"));
    } finally {
      setExecuting(false);
    }
  }, [selectedRunId]);

  const createRun = useCallback(async () => {
    if (!selectedScenarioId) return;
    setCreatingRun(true);
    setRunError(null);
    try {
      const run = await scenarioApi.createRun(selectedScenarioId);
      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);
    } catch (err) {
      setRunStatus("error");
      setRunError(errorMessage(err, "Failed to create simulation run"));
    } finally {
      setCreatingRun(false);
    }
  }, [selectedScenarioId]);

  const currentFrame = frames[frameIndex] ?? null;

  return {
    scenarios,
    scenariosStatus,
    scenariosError,
    reloadScenarios: loadScenarios,

    selectedScenarioId,
    setSelectedScenarioId,
    scenarioDetail,
    scenarioStatus,
    scenarioError,

    runs,
    selectedRunId,
    setSelectedRunId,
    runDetail,
    runStatus,
    runError,
    executing,
    executeRun,
    creatingRun,
    createRun,

    frames,
    timelineStatus,
    timelineError,
    frameIndex,
    setFrameIndex,
    currentFrame,
  };
}
