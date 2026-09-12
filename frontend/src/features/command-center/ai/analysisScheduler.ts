import type { AIRequestType, CommandBrief } from "../types";

/**
 * When the AI layer is allowed to run, and which answers still count.
 *
 * The deterministic simulation updates every frame; the agent graph must not.
 * A LangGraph run costs real time and (with a hosted provider) real credits,
 * so this scheduler is the single place that decides when one is worth
 * starting:
 *
 *   playback  — at most one analysis per AI_UPDATE_INTERVAL_MS while playing
 *   scrub     — nothing until the playhead has been still for AI_SCRUB_DEBOUNCE_MS
 *   paused / complete / manual — immediately, on the frame now on screen
 *
 * It also decides which answers are still worth showing. Every request is
 * tagged with the scope it was made in (scenario version + run); an answer
 * that arrives after the operator switched test, re-recorded, or edited the
 * configuration is discarded rather than rendered against the wrong world.
 *
 * Pure TypeScript on purpose — no React, no timers of its own beyond the two
 * it owns — so the whole policy is unit-testable without a DOM.
 */

export const AI_UPDATE_INTERVAL_MS = 5000;
export const AI_SCRUB_DEBOUNCE_MS = 600;

export interface AnalysisTarget {
  scenarioId: string;
  scenarioVersionId: string | null;
  runId: string;
  frameIndex: number;
}

/** Identity of one analysable frame — the cache key. */
export function frameKey(target: AnalysisTarget): string {
  return `${target.scenarioVersionId ?? "no-version"}|${target.runId}|${target.frameIndex}`;
}

/** Identity of the world the operator is looking at. A change invalidates
 * every cached brief and every in-flight request. */
export function scopeKey(target: Pick<AnalysisTarget, "scenarioId" | "scenarioVersionId" | "runId">): string {
  return `${target.scenarioId}|${target.scenarioVersionId ?? "no-version"}|${target.runId}`;
}

export type AnalysisOutcome =
  | { kind: "completed"; target: AnalysisTarget; brief: CommandBrief; requestId: string; cached: boolean }
  | { kind: "failed"; target: AnalysisTarget; error: string }
  | { kind: "stale"; target: AnalysisTarget; reason: "scope-changed" | "superseded" };

export interface SchedulerOptions {
  /** Performs one analysis. Rejections become `failed` outcomes. */
  run: (target: AnalysisTarget, trigger: AIRequestType) => Promise<{ brief: CommandBrief; requestId: string }>;
  /** Called for every resolved request that was not discarded. */
  onOutcome: (outcome: AnalysisOutcome) => void;
  /** Called when a request actually starts (after throttle/debounce). */
  onStart?: (target: AnalysisTarget, trigger: AIRequestType) => void;
  /** Called when a request is accepted but is waiting on throttle/debounce. */
  onQueued?: (target: AnalysisTarget, trigger: AIRequestType) => void;
  intervalMs?: number;
  debounceMs?: number;
  now?: () => number;
}

interface Pending {
  target: AnalysisTarget;
  trigger: AIRequestType;
}

export class AnalysisScheduler {
  private readonly options: Required<Omit<SchedulerOptions, "onStart" | "onQueued">> & Pick<SchedulerOptions, "onStart" | "onQueued">;
  private readonly cache = new Map<string, CommandBrief>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Pending | null = null;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private inFlightKey: string | null = null;
  private scope: string | null = null;
  private disposed = false;

  constructor(options: SchedulerOptions) {
    this.options = {
      intervalMs: AI_UPDATE_INTERVAL_MS,
      debounceMs: AI_SCRUB_DEBOUNCE_MS,
      now: () => Date.now(),
      ...options,
    };
  }

  /** The brief already held for this frame, if any. */
  cached(target: AnalysisTarget): CommandBrief | null {
    return this.cache.get(frameKey(target)) ?? null;
  }

  /** Ask for an analysis of `target`. Whether it runs now, later or not at
   * all depends on the trigger. */
  request(target: AnalysisTarget, trigger: AIRequestType): void {
    if (this.disposed) return;
    this.enterScope(target);

    const hit = this.cache.get(frameKey(target));
    if (hit) {
      // Already analysed under this exact scope + frame — show it, spend nothing.
      this.clearTimer();
      this.pending = null;
      this.options.onOutcome({ kind: "completed", target, brief: hit, requestId: "", cached: true });
      return;
    }

    if (trigger === "scrub") {
      this.schedule(target, trigger, this.options.debounceMs);
      return;
    }
    if (trigger === "playback") {
      const waited = this.options.now() - this.lastStartedAt;
      this.schedule(target, trigger, Math.max(0, this.options.intervalMs - waited));
      return;
    }
    // paused | complete | manual — the operator is looking at this frame now.
    this.clearTimer();
    this.dispatch(target, trigger);
  }

  /** Drop every cached brief and abandon anything in flight — used when the
   * operator changes test, run or configuration version. */
  invalidate(): void {
    this.cache.clear();
    this.clearTimer();
    this.pending = null;
    this.inFlightKey = null;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.pending = null;
  }

  private enterScope(target: AnalysisTarget): void {
    const next = scopeKey(target);
    if (this.scope === next) return;
    this.scope = next;
    this.cache.clear();
    this.clearTimer();
    this.pending = null;
    this.inFlightKey = null;
  }

  private schedule(target: AnalysisTarget, trigger: AIRequestType, delayMs: number): void {
    this.pending = { target, trigger };
    this.options.onQueued?.(target, trigger);
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      const pending = this.pending;
      this.pending = null;
      if (pending) this.dispatch(pending.target, pending.trigger);
    }, delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private dispatch(target: AnalysisTarget, trigger: AIRequestType): void {
    if (this.disposed) return;
    const key = frameKey(target);
    const scopeAtRequest = scopeKey(target);
    const hit = this.cache.get(key);
    if (hit) {
      this.options.onOutcome({ kind: "completed", target, brief: hit, requestId: "", cached: true });
      return;
    }
    this.lastStartedAt = this.options.now();
    this.inFlightKey = key;
    this.options.onStart?.(target, trigger);
    this.options
      .run(target, trigger)
      .then(({ brief, requestId }) => {
        if (this.disposed) return;
        if (this.scope !== scopeAtRequest) {
          // The operator moved to another version/run while we waited.
          this.options.onOutcome({ kind: "stale", target, reason: "scope-changed" });
          return;
        }
        this.cache.set(key, brief);
        if (this.inFlightKey !== key) {
          // A newer frame's analysis has already started; keep the brief in
          // the cache but do not paint an older frame over the current one.
          this.options.onOutcome({ kind: "stale", target, reason: "superseded" });
          return;
        }
        this.inFlightKey = null;
        this.options.onOutcome({ kind: "completed", target, brief, requestId, cached: false });
      })
      .catch((error: unknown) => {
        if (this.disposed) return;
        if (this.inFlightKey === key) this.inFlightKey = null;
        if (this.scope !== scopeAtRequest) {
          this.options.onOutcome({ kind: "stale", target, reason: "scope-changed" });
          return;
        }
        this.options.onOutcome({ kind: "failed", target, error: error instanceof Error ? error.message : "Analysis failed" });
      });
  }
}

/** The recorded frame under the playhead. Never past the run's last frame. */
export function frameIndexAt(elapsedMinutes: number, timestepMinutes: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.max(0, Math.min(frameCount - 1, Math.round(elapsedMinutes / timestepMinutes)));
}
