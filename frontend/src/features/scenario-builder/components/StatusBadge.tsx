import type { ScenarioStatus, SimulationStatus } from "../types";

const SCENARIO_STATUS_STYLES: Record<ScenarioStatus, string> = {
  draft: "bg-slate-700 text-slate-200",
  ready: "bg-emerald-900 text-emerald-300",
  archived: "bg-slate-800 text-slate-500",
};

const RUN_STATUS_STYLES: Record<SimulationStatus, string> = {
  pending: "bg-amber-900 text-amber-300",
  running: "bg-sky-900 text-sky-300",
  completed: "bg-emerald-900 text-emerald-300",
  failed: "bg-red-900 text-red-300",
  cancelled: "bg-slate-800 text-slate-500",
};

interface StatusBadgeProps {
  status: ScenarioStatus | SimulationStatus;
  kind?: "scenario" | "run";
}

/** Status is always paired with text, not conveyed by color alone (§38). */
export function StatusBadge({ status, kind = "scenario" }: StatusBadgeProps) {
  const styles = kind === "scenario" ? SCENARIO_STATUS_STYLES : RUN_STATUS_STYLES;
  const style = (styles as Record<string, string>)[status] ?? "bg-slate-700 text-slate-200";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${style}`}>
      {status}
    </span>
  );
}
