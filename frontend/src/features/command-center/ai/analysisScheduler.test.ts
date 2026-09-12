import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisScheduler, frameIndexAt, frameKey, scopeKey, type AnalysisOutcome, type AnalysisTarget } from "./analysisScheduler";
import type { CommandBrief } from "../types";

const INTERVAL = 5000;
const DEBOUNCE = 600;

function brief(frameIndex: number): CommandBrief {
  return {
    scenario_id: "scn",
    simulation_run_id: "run-1",
    frame_index: frameIndex,
    generated_at: "2026-09-12T00:00:00Z",
    situation: `frame ${frameIndex}`,
    current_hazard: "",
    hazard_progression: [],
    key_exposures: [],
    priorities: [],
    precautions: [],
    recommended_actions: [],
    resource_status: "RESOURCE_DATA_UNAVAILABLE",
    agent_runs: [],
    evidence_references: [],
    data_limitations: [],
    uncertainties: [],
    human_review_required: true,
    validation_notes: [],
    evidence_citations: [],
    claim_mappings: [],
    disclaimer: "",
  };
}

function target(frameIndex: number, over: Partial<AnalysisTarget> = {}): AnalysisTarget {
  return { scenarioId: "scn", scenarioVersionId: "v1", runId: "run-1", frameIndex, ...over };
}

let clock = 0;

function build(run?: (t: AnalysisTarget) => Promise<{ brief: CommandBrief; requestId: string }>) {
  const outcomes: AnalysisOutcome[] = [];
  const started: { frameIndex: number; trigger: string }[] = [];
  const runner = vi.fn(run ?? ((t: AnalysisTarget) => Promise.resolve({ brief: brief(t.frameIndex), requestId: `req-${t.frameIndex}` })));
  const scheduler = new AnalysisScheduler({
    run: runner,
    onOutcome: (o) => outcomes.push(o),
    onStart: (t, trigger) => started.push({ frameIndex: t.frameIndex, trigger }),
    intervalMs: INTERVAL,
    debounceMs: DEBOUNCE,
    now: () => clock,
  });
  return { scheduler, outcomes, started, runner };
}

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("keys", () => {
  it("separates frames, runs and versions", () => {
    expect(frameKey(target(1))).not.toBe(frameKey(target(2)));
    expect(frameKey(target(1, { runId: "run-2" }))).not.toBe(frameKey(target(1)));
    expect(scopeKey(target(1, { scenarioVersionId: "v2" }))).not.toBe(scopeKey(target(1)));
  });

  it("clamps the playhead to the recorded frame range", () => {
    expect(frameIndexAt(0, 15, 9)).toBe(0);
    expect(frameIndexAt(37, 15, 9)).toBe(2);
    expect(frameIndexAt(10_000, 15, 9)).toBe(8);
    expect(frameIndexAt(30, 15, 0)).toBe(0);
  });
});

describe("scrub debounce", () => {
  it("runs once, on the frame the operator stopped on", async () => {
    const { scheduler, runner } = build();
    for (const frame of [1, 2, 3, 4]) {
      scheduler.request(target(frame), "scrub");
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(runner).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][0].frameIndex).toBe(4);
  });

  it("does not run at all while the playhead keeps moving", async () => {
    const { scheduler, runner } = build();
    for (let frame = 0; frame < 20; frame += 1) {
      scheduler.request(target(frame), "scrub");
      await vi.advanceTimersByTimeAsync(DEBOUNCE - 100);
    }
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("playback throttle", () => {
  it("starts at most one analysis per interval", async () => {
    const { scheduler, runner } = build();
    scheduler.request(target(0), "playback");
    await vi.advanceTimersByTimeAsync(0);
    expect(runner).toHaveBeenCalledTimes(1);

    // Every frame in the next interval coalesces into one later run.
    for (let frame = 1; frame <= 20; frame += 1) {
      clock += 200;
      scheduler.request(target(frame), "playback");
      await vi.advanceTimersByTimeAsync(200);
    }
    // Still only the first run: the next one is queued for the end of the
    // interval, not fired per frame.
    expect(runner).toHaveBeenCalledTimes(1);
    clock += 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledTimes(2);
    // …and it analysed the newest frame, not a stale queued one.
    expect(runner.mock.calls[1][0].frameIndex).toBe(20);
  });
});

describe("immediate triggers", () => {
  it("runs straight away on pause, completion and manual request", async () => {
    const { scheduler, runner, started } = build();
    scheduler.request(target(3), "paused");
    await vi.advanceTimersByTimeAsync(0);
    clock += 10;
    scheduler.request(target(8), "complete");
    await vi.advanceTimersByTimeAsync(0);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(started.map((s) => s.trigger)).toEqual(["paused", "complete"]);
  });
});

describe("cache", () => {
  it("serves a frame already analysed in this scope without calling the API", async () => {
    const { scheduler, runner, outcomes } = build();
    scheduler.request(target(2), "manual");
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request(target(2), "manual");
    await vi.advanceTimersByTimeAsync(0);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(outcomes.filter((o) => o.kind === "completed").length).toBe(2);
    expect(outcomes.at(-1)).toMatchObject({ kind: "completed", cached: true });
    expect(scheduler.cached(target(2))).not.toBeNull();
  });

  it("evicts everything when the scenario version changes", async () => {
    const { scheduler, runner } = build();
    scheduler.request(target(2), "manual");
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request(target(2, { scenarioVersionId: "v2" }), "manual");
    await vi.advanceTimersByTimeAsync(0);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(scheduler.cached(target(2))).toBeNull();
  });

  it("evicts everything when the run changes", async () => {
    const { scheduler } = build();
    scheduler.request(target(2), "manual");
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.cached(target(2))).not.toBeNull();
    scheduler.request(target(0, { runId: "run-2" }), "manual");
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.cached(target(2))).toBeNull();
  });
});

describe("stale responses", () => {
  it("discards an answer that arrives after the version changed", async () => {
    const pending = new Map<string, (value: { brief: CommandBrief; requestId: string }) => void>();
    const { scheduler, outcomes } = build((t) => new Promise((resolve) => pending.set(t.scenarioVersionId ?? "", resolve)));
    scheduler.request(target(4), "manual");
    await vi.advanceTimersByTimeAsync(0);
    // Operator edits the configuration while the analysis is in flight.
    scheduler.request(target(4, { scenarioVersionId: "v2" }), "manual");
    await vi.advanceTimersByTimeAsync(0);
    // The v1 answer lands after the operator already moved to v2.
    pending.get("v1")?.({ brief: brief(4), requestId: "req-4" });
    await vi.advanceTimersByTimeAsync(0);
    expect(outcomes.some((o) => o.kind === "stale" && o.reason === "scope-changed")).toBe(true);
    expect(outcomes.some((o) => o.kind === "completed")).toBe(false);
  });

  it("does not paint an older frame over a newer one", async () => {
    const pending = new Map<number, (value: { brief: CommandBrief; requestId: string }) => void>();
    const { scheduler, outcomes } = build((t) => new Promise((resolve) => pending.set(t.frameIndex, resolve)));
    scheduler.request(target(1), "manual");
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request(target(2), "manual");
    await vi.advanceTimersByTimeAsync(0);

    pending.get(1)?.({ brief: brief(1), requestId: "req-1" });
    await vi.advanceTimersByTimeAsync(0);
    expect(outcomes.some((o) => o.kind === "stale" && o.reason === "superseded")).toBe(true);

    pending.get(2)?.({ brief: brief(2), requestId: "req-2" });
    await vi.advanceTimersByTimeAsync(0);
    const completed = outcomes.filter((o) => o.kind === "completed");
    expect(completed).toHaveLength(1);
    expect(completed[0].kind === "completed" && completed[0].brief.frame_index).toBe(2);
  });

  it("surfaces a failure as an error, not as a silent empty panel", async () => {
    const { scheduler, outcomes } = build(() => Promise.reject(new Error("Scenario version is stale")));
    scheduler.request(target(1), "manual");
    await vi.advanceTimersByTimeAsync(0);
    expect(outcomes).toEqual([{ kind: "failed", target: target(1), error: "Scenario version is stale" }]);
  });
});

describe("dispose", () => {
  it("stops pending work", async () => {
    const { scheduler, runner } = build();
    scheduler.request(target(1), "scrub");
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2);
    expect(runner).not.toHaveBeenCalled();
  });
});
