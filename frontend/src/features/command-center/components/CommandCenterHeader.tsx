import { HazardBadge, StatusIndicator } from "@/components/ui";
import type { ScenarioDetail, SimulationStatus } from "../types";

const RUN_STATUS_TONE: Record<SimulationStatus, "ok" | "warning" | "critical" | "offline" | "loading"> = {
  pending: "offline",
  running: "loading",
  completed: "ok",
  failed: "critical",
  cancelled: "offline",
};

interface CommandCenterHeaderProps {
  scenario: ScenarioDetail | null;
  runStatus?: SimulationStatus;
}

export function CommandCenterHeader({ scenario, runStatus }: CommandCenterHeaderProps) {
  return (
    <header className="border-hairline bg-abyss/90 relative z-10 flex items-center justify-between border-b px-5 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="text-ink text-sm font-bold tracking-[0.2em]">AQUASHIELD</span>
        <span className="text-ink-faint text-[11px] tracking-[0.14em] uppercase">Command Center</span>
      </div>
      <div className="flex items-center gap-4">
        {scenario ? (
          <>
            <span className="text-ink-soft text-xs">{scenario.name}</span>
            <HazardBadge disasterType={scenario.disaster_type} />
          </>
        ) : (
          <span className="text-ink-faint text-xs">No scenario selected</span>
        )}
        {runStatus ? <StatusIndicator tone={RUN_STATUS_TONE[runStatus]} label={runStatus} /> : null}
      </div>
    </header>
  );
}
