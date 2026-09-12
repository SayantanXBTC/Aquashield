import type { SimulationRun, SimulationStatus } from "../types";

/**
 * Pure, unit-tested formatting for the run selector (Prompt 10.1's
 * RunSelector.tsx) — kept out of the component so the "what text does this
 * run show" logic can be tested directly without rendering anything. Never
 * fabricates a count: a run with no known frame_count (still pending,
 * running, or failed before any artifact existed) always reads "No playback
 * data available", never a guessed number.
 */

const STATUS_LABEL: Record<SimulationStatus, string> = {
  pending: "PENDING",
  running: "RUNNING",
  completed: "COMPLETED",
  failed: "FAILED",
  cancelled: "CANCELLED",
};

export function formatRunFrameSummary(run: Pick<SimulationRun, "status" | "frame_count">): string {
  if (run.status === "completed") {
    return run.frame_count != null && run.frame_count > 0
      ? `${run.frame_count} frame${run.frame_count === 1 ? "" : "s"}`
      : "No playback data available";
  }
  return "No playback data available";
}

export function formatRunOptionLabel(run: Pick<SimulationRun, "status" | "frame_count">): string {
  return `${STATUS_LABEL[run.status]} · ${formatRunFrameSummary(run)}`;
}

/** A short, stable per-run distinguisher for when a scenario has multiple
 * runs of the same status (e.g. two completed runs) — real `created_at`,
 * never a fabricated index. Falls back to a short id fragment if
 * `created_at` is somehow absent. */
export function formatRunTimestamp(run: Pick<SimulationRun, "created_at" | "id">): string {
  if (!run.created_at) return `#${run.id.slice(0, 8)}`;
  const date = new Date(run.created_at);
  if (Number.isNaN(date.getTime())) return `#${run.id.slice(0, 8)}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
