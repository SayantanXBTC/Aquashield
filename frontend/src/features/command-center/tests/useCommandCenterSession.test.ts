import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/features/scenario-builder/api/scenarioApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  scenarioApi: {
    getScenarios: vi.fn(),
    getScenario: vi.fn(),
    getRuns: vi.fn(),
    createRun: vi.fn(),
  },
}));

vi.mock("../api/simulationApi", () => ({
  simulationApi: {
    getRun: vi.fn(),
    executeRun: vi.fn(),
    getTimeline: vi.fn(),
  },
}));

import { scenarioApi } from "@/features/scenario-builder/api/scenarioApi";
import { simulationApi } from "../api/simulationApi";
import { useCommandCenterSession } from "../hooks/useCommandCenterSession";
import type { TimelineFrame } from "../types";

const SCENARIO_LIST_ITEM = {
  id: "s1",
  name: "Test Flood Scenario",
  disaster_type: "flood" as const,
  status: "ready" as const,
  location_name: "Test City",
  latitude: 22.5,
  longitude: 88.3,
  current_version_number: 1,
  updated_at: "2026-01-01T00:00:00Z",
};

const SCENARIO_DETAIL = {
  ...SCENARIO_LIST_ITEM,
  description: null,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  current_version: {
    id: "v1",
    scenario_id: "s1",
    version_number: 1,
    label: "Initial",
    scenario_config: {},
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  version_count: 1,
};

function makeRun(id: string) {
  return {
    id,
    scenario_version_id: "v1",
    status: "completed" as const,
    started_at: "2026-01-01T00:00:00Z",
    completed_at: "2026-01-01T00:00:01Z",
    duration_seconds: 0.5,
    timestep_config: {},
    model_identifier: "flood-demo-v1",
    error_message: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function makeFrames(runId: string, count: number): TimelineFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    simulation_run_id: runId,
    timestep: i,
    state: { disaster_type: "flood" },
    is_key_event: false,
  }));
}

/** Wires the scenario -> run -> timeline chain to resolve with one
 * already-completed run and `frameCount` frames, so the hook reaches a
 * playable state without needing to exercise create/execute. */
function setupPlayableRun(frameCount: number, runId = "run1") {
  const run = makeRun(runId);
  vi.mocked(scenarioApi.getScenarios).mockResolvedValue({
    items: [SCENARIO_LIST_ITEM],
    total: 1,
    limit: 50,
    offset: 0,
  });
  vi.mocked(scenarioApi.getScenario).mockResolvedValue(SCENARIO_DETAIL);
  vi.mocked(scenarioApi.getRuns).mockResolvedValue([run]);
  vi.mocked(simulationApi.getRun).mockResolvedValue(run);
  vi.mocked(simulationApi.getTimeline).mockResolvedValue({
    simulation_run_id: runId,
    frame_count: frameCount,
    frames: makeFrames(runId, frameCount),
  });
  return run;
}

describe("useCommandCenterSession playback", () => {
  beforeEach(() => {
    vi.mocked(scenarioApi.getScenarios).mockReset();
    vi.mocked(scenarioApi.getScenario).mockReset();
    vi.mocked(scenarioApi.getRuns).mockReset();
    vi.mocked(scenarioApi.createRun).mockReset();
    vi.mocked(simulationApi.getRun).mockReset();
    vi.mocked(simulationApi.executeRun).mockReset();
    vi.mocked(simulationApi.getTimeline).mockReset();
  });

  afterEach(() => {
    // Belt-and-suspenders: every test that enables fake timers restores them
    // itself, but guard against a failed assertion skipping that cleanup and
    // leaking fake timers into the next test file.
    vi.useRealTimers();
  });

  it("play() advances frameIndex on an interval, paced by playbackSpeed (fake timers)", async () => {
    setupPlayableRun(5);
    const { result } = renderHook(() => useCommandCenterSession());

    await waitFor(() => expect(result.current.frames).toHaveLength(5));
    expect(result.current.frameIndex).toBe(0);

    vi.useFakeTimers();
    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    // Base interval (documented in useCommandCenterSession.ts) is 600ms at
    // 1x — a UI pacing choice, not a physical timing claim.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.frameIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.frameIndex).toBe(2);
  });

  it("pause() stops advancement", async () => {
    setupPlayableRun(5);
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(5));

    vi.useFakeTimers();
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.frameIndex).toBe(1);

    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);

    act(() => vi.advanceTimersByTime(3000));
    // No further advancement once paused.
    expect(result.current.frameIndex).toBe(1);
  });

  it("setPlaybackSpeed changes interval timing (2x halves the interval)", async () => {
    setupPlayableRun(10);
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(10));

    vi.useFakeTimers();
    act(() => result.current.setPlaybackSpeed(2));
    act(() => result.current.play());

    // At 2x, the interval is 300ms (600ms / 2) — advancing only 300ms
    // should already produce one tick.
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.frameIndex).toBe(1);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.frameIndex).toBe(2);
  });

  it("auto-stops at the last frame without looping back to 0", async () => {
    setupPlayableRun(3);
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(3));

    vi.useFakeTimers();
    act(() => result.current.play());

    act(() => vi.advanceTimersByTime(600)); // -> index 1
    act(() => vi.advanceTimersByTime(600)); // -> index 2 (last), should auto-pause
    expect(result.current.frameIndex).toBe(2);
    expect(result.current.isPlaying).toBe(false);

    // Advancing further must not loop back to 0.
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.frameIndex).toBe(2);
  });

  it("auto-pauses when the selected run (and its frames) changes", async () => {
    const runA = setupPlayableRun(5, "runA");
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(5));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    const runB = makeRun("runB");
    vi.mocked(scenarioApi.getRuns).mockResolvedValue([runA, runB]);
    vi.mocked(simulationApi.getRun).mockImplementation(async (id: string) =>
      id === "runB" ? runB : runA,
    );
    vi.mocked(simulationApi.getTimeline).mockImplementation(async (id: string) => ({
      simulation_run_id: id,
      frame_count: id === "runB" ? 2 : 5,
      frames: makeFrames(id, id === "runB" ? 2 : 5),
    }));

    act(() => {
      result.current.setSelectedRunId("runB");
    });

    await waitFor(() => expect(result.current.isPlaying).toBe(false));
    await waitFor(() => expect(result.current.frames).toHaveLength(2));
    expect(result.current.frameIndex).toBe(0);
  });

  it("auto-pauses when the selected scenario changes", async () => {
    setupPlayableRun(5);
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(5));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.setSelectedScenarioId("s2");
    });

    await waitFor(() => expect(result.current.isPlaying).toBe(false));
    expect(result.current.frames).toHaveLength(0);
  });

  it("cleans up its interval on unmount — nothing fires afterward", async () => {
    setupPlayableRun(5);
    const { result, unmount } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(5));

    vi.useFakeTimers();
    act(() => result.current.play());
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    // Advancing after unmount must not throw or resurrect any state update.
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
  });

  it("manual setFrameIndex (scrub) pauses playback", async () => {
    setupPlayableRun(5);
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(5));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.setFrameIndex(3));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.frameIndex).toBe(3);
  });

  it("play() is a no-op at the last frame (never loops)", async () => {
    setupPlayableRun(2);
    const { result } = renderHook(() => useCommandCenterSession());
    await waitFor(() => expect(result.current.frames).toHaveLength(2));

    act(() => result.current.setFrameIndex(1)); // last index
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(false);
  });
});
