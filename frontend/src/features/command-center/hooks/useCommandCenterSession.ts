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
 * Playback pacing, a UI convenience only — not a physical/simulated timing
 * claim. `TimelineFrame` (shared/types/index.ts) carries no duration/fps
 * field, so there is no "real" per-frame interval to derive playback speed
 * from; 600ms at 1x is simply a comfortable default cadence for stepping
 * through frames, divided by the speed multiplier (2x -> 300ms, 4x ->
 * 150ms, 0.5x -> 1200ms). See docs/development/command-center.md "Timeline
 * playback".
 */
const PLAYBACK_BASE_INTERVAL_MS = 600;

/**
 * Orchestrates the real Prompt 7 data flow this feature exists to prove out:
 *
 *   Scenario -> SimulationRun -> Simulation API -> Timeline Frames -> frontend state
 *
 * Every value here comes from an actual backend response — nothing is
 * fabricated to make the UI look alive. Prompt 9 adds client-side playback
 * on top of the already-fetched `frames`: `isPlaying`/`playbackSpeed` drive
 * a `setInterval` that advances `frameIndex`, with no backend/WebSocket
 * involvement at all — see `PLAYBACK_BASE_INTERVAL_MS` below for the
 * pacing model and the auto-pause effects for how a stale interval is kept
 * from ever advancing a frameIndex belonging to a different run's frames.
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
  const [frameIndex, setFrameIndexState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

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
      setFrameIndexState(0);
      // A scenario switch invalidates whatever run/frames playback was
      // stepping through — never let a stale interval keep advancing a
      // frameIndex that belongs to a different scenario's timeline.
      setIsPlaying(false);
    });

    (async () => {
      try {
        // getDefaultRun applies the real completed-preferred priority
        // (backend/app/services/run_selection.py) — never "the newest run
        // regardless of status" (the old runList[0] bug that could
        // auto-select a PENDING run created after a perfectly good
        // COMPLETED one; see docs/geospatial/impact-visualization.md).
        // runList itself is still fetched in full for the run selector UI,
        // which must let a user explicitly pick any run, including a
        // pending or failed one.
        const [detail, runList, defaultRun] = await Promise.all([
          scenarioApi.getScenario(selectedScenarioId),
          scenarioApi.getRuns(selectedScenarioId),
          scenarioApi.getDefaultRun(selectedScenarioId),
        ]);
        if (cancelled) return;
        setScenarioDetail(detail);
        setRuns(runList);
        setScenarioStatus("idle");
        setSelectedRunId(defaultRun?.id ?? null);
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
    // A different run means a different (or no) timeline — playback for the
    // previous run's frames must not keep ticking against this one.
    startTransition(() => setIsPlaying(false));

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
    // Frames are about to be replaced (or cleared) — auto-pause first so no
    // interval tick lands on the outgoing frame set.
    startTransition(() => setIsPlaying(false));

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
        setFrameIndexState(0);
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

  // Manual scrub (dragging/clicking the timeline slider) is an explicit
  // override of the current position — it must win over the interval, not
  // fight it, so scrubbing always pauses playback first.
  const setFrameIndex = useCallback((index: number) => {
    setIsPlaying(false);
    setFrameIndexState(index);
  }, []);

  const play = useCallback(() => {
    // No-op if there's nothing to play, or already at the last frame —
    // pressing Play at the end must not silently loop back to 0.
    if (frames.length === 0 || frameIndex >= frames.length - 1) return;
    setIsPlaying(true);
  }, [frames.length, frameIndex]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) return false;
      if (frames.length === 0 || frameIndex >= frames.length - 1) return prev;
      return true;
    });
  }, [frames.length, frameIndex]);

  // The interval that actually advances frameIndex during playback. Torn
  // down and rebuilt whenever isPlaying, playbackSpeed, or frames changes —
  // and, critically, torn down on unmount — so no interval ever outlives
  // the component or advances a frameIndex belonging to a stale frame set
  // (CLAUDE.md §27's "every timer/animation handle must be cleaned up"
  // discipline, applied to a plain setInterval rather than an Anime.js
  // handle).
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const intervalMs = PLAYBACK_BASE_INTERVAL_MS / playbackSpeed;
    const id = window.setInterval(() => {
      setFrameIndexState((prev) => Math.min(prev + 1, frames.length - 1));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isPlaying, playbackSpeed, frames]);

  // Stop cleanly at the last frame rather than looping. Also covers "frames
  // became empty while playing" defensively, in case a future code path
  // clears frames without going through one of the pause points above.
  useEffect(() => {
    if (isPlaying && (frames.length === 0 || frameIndex >= frames.length - 1)) {
      startTransition(() => setIsPlaying(false));
    }
  }, [isPlaying, frameIndex, frames.length]);

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

    isPlaying,
    play,
    pause,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
  };
}
