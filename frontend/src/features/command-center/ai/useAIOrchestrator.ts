import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiApi } from "../api/aiApi";
import type { PlaybackClock } from "../playback/playbackClock";
import { usePlaybackState } from "../playback/usePlaybackClock";
import type { AIAgentRun, AIEvent, AIRequestType, CommandBrief, SimulationRun } from "../types";
import { applyAgentEvent, idleRoster, rosterFromBrief } from "./agentRoster";
import { AnalysisScheduler, frameIndexAt, type AnalysisTarget } from "./analysisScheduler";
import { useAIEvents } from "./useAIEvents";

export type AIStatus = "idle" | "waiting" | "running" | "ready" | "error";

interface UseAIOrchestratorOptions {
  scenarioId: string | null;
  runs: SimulationRun[];
  replayRunId: string | null;
  clock: PlaybackClock;
  recordedTimestepMinutes: number;
}

/**
 * Keeps the AI layer in step with the timeline without freezing the UI or
 * billing a graph run per frame.
 *
 * The deterministic readouts (telemetry, structures, the 3D world) keep
 * updating every frame from the simulation mirror — untouched by this hook.
 * Only the agent analysis is paced, by `AnalysisScheduler`:
 *
 *   playing            -> at most one analysis every AI_UPDATE_INTERVAL_MS
 *   scrubbing (paused) -> one analysis once the playhead has settled
 *   pause / end of run -> one analysis immediately, on the frame on screen
 *
 * The analysis always targets a RECORDED run: the live client-side preview
 * has no backend frames to cite, and the AI layer may only reason over
 * deterministic recorded evidence (CLAUDE.md §5, §26a).
 */
export function useAIOrchestrator({ scenarioId, runs, replayRunId, clock, recordedTimestepMinutes }: UseAIOrchestratorOptions) {
  const { elapsedMinutes, playing, durationMinutes } = usePlaybackState(clock);

  const targetRun = useMemo(() => {
    if (replayRunId) return runs.find((r) => r.id === replayRunId) ?? null;
    return runs.find((r) => r.status === "completed" && (r.frame_count ?? 0) > 0) ?? null;
  }, [runs, replayRunId]);

  const frameCount = targetRun?.frame_count ?? 0;
  const frameIndex = frameIndexAt(elapsedMinutes, recordedTimestepMinutes, frameCount);

  const [brief, setBrief] = useState<CommandBrief | null>(null);
  const [runStatus, setRunStatus] = useState<AIStatus>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AIAgentRun[]>(() => idleRoster());
  const [analysedFrame, setAnalysedFrame] = useState<number | null>(null);
  const [lastTrigger, setLastTrigger] = useState<AIRequestType | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  // Reported by the backend on each request — never assumed here.
  const [provider, setProvider] = useState<string | null>(null);

  const questionRef = useRef<string>("");
  const schedulerRef = useRef<AnalysisScheduler | null>(null);

  const target: AnalysisTarget | null = useMemo(() => {
    if (!scenarioId || !targetRun) return null;
    // The version the RUN was produced from — a recorded run's frames never
    // change, so later parameter edits do not invalidate its briefs.
    return { scenarioId, scenarioVersionId: targetRun.scenario_version_id ?? null, runId: targetRun.id, frameIndex };
  }, [scenarioId, targetRun, frameIndex]);

  // The scheduler owns the timers, the cache and the stale-response rules.
  // It is built once, in an effect, so nothing touches a ref during render.
  useEffect(() => {
    const scheduler = new AnalysisScheduler({
      run: async (t, trigger) => {
        const created = await aiApi.analyzeFrame({
          scenario_id: t.scenarioId,
          simulation_run_id: t.runId,
          scenario_version_id: t.scenarioVersionId,
          frame_index: t.frameIndex,
          request_type: trigger,
          user_question: questionRef.current.trim() || null,
        });
        setProvider(created.provider ?? null);
        const result = await aiApi.getResult(created.id);
        if (result.status !== "completed" || !result.result) {
          throw new Error(result.error ?? "Analysis did not complete");
        }
        return { brief: result.result, requestId: created.id };
      },
      onQueued: () => setRunStatus("waiting"),
      onStart: (t, trigger) => {
        setRunStatus("running");
        setError(null);
        setLastTrigger(trigger);
        setAgents(idleRoster("PENDING"));
        setAnalysedFrame(t.frameIndex);
      },
      onOutcome: (outcome) => {
        if (outcome.kind === "completed") {
          setBrief(outcome.brief);
          setAgents(rosterFromBrief(outcome.brief.agent_runs));
          setAnalysedFrame(outcome.brief.frame_index);
          setRequestId(outcome.requestId || null);
          setRunStatus("ready");
          setError(null);
        } else if (outcome.kind === "failed") {
          setRunStatus("error");
          setError(outcome.error);
        }
        // "stale" outcomes are silent by design: the operator has already
        // moved on, and a stale brief must never be painted over the frame
        // now on screen.
      },
    });
    schedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, []);

  // --- live milestones ----------------------------------------------------
  // Only events for the run we are analysing move the chips; everything else
  // belongs to another tab or another test.
  const onEvent = useCallback(
    (event: AIEvent) => {
      const runId = target?.runId;
      if (!runId || (event.simulation_run_id && event.simulation_run_id !== runId)) return;
      switch (event.type) {
        case "AI_ANALYSIS_STARTED":
          setAgents(idleRoster("PENDING"));
          break;
        case "AGENT_STARTED":
          if (event.agent_name) setAgents((prev) => applyAgentEvent(prev, event.agent_name as string, { status: "RUNNING" }));
          break;
        case "AGENT_COMPLETED":
          if (event.agent_name) {
            setAgents((prev) =>
              applyAgentEvent(prev, event.agent_name as string, {
                status: event.status ?? "COMPLETED",
                summary: event.summary ?? null,
                duration_ms: event.duration_ms ?? 0,
              }),
            );
          }
          break;
        default:
          break;
      }
    },
    [target],
  );
  useAIEvents(Boolean(target), onEvent);

  // --- the trigger policy -------------------------------------------------

  const wasPlaying = useRef(playing);
  const atEnd = elapsedMinutes >= durationMinutes;

  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler || !target) return;
    const previouslyPlaying = wasPlaying.current;
    wasPlaying.current = playing;
    let trigger: AIRequestType;
    if (playing) trigger = "playback";
    else if (previouslyPlaying) trigger = atEnd ? "complete" : "paused";
    else trigger = "scrub";
    scheduler.request(target, trigger);
  }, [target, playing, atEnd]);

  const setQuestion = useCallback((value: string) => {
    questionRef.current = value;
  }, []);

  /** Operator pressed "Analyse now" — bypasses throttle and debounce. */
  const analyseNow = useCallback(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler || !target) return;
    scheduler.invalidate();
    scheduler.request(target, "manual");
  }, [target]);

  const status: AIStatus = target ? runStatus : "idle";

  return {
    brief,
    status,
    error,
    agents,
    frameIndex,
    analysedFrame,
    frameCount,
    targetRun,
    lastTrigger,
    requestId,
    provider,
    setQuestion,
    analyseNow,
    /** True when the brief on screen describes a frame other than the one
     * under the playhead (the panel says so rather than implying currency). */
    briefIsBehind: brief !== null && analysedFrame !== null && analysedFrame !== frameIndex,
  };
}

export type AIOrchestrator = ReturnType<typeof useAIOrchestrator>;
