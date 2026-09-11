import { CommandPanel, DataReadout, EmptyState, ErrorState, SectionLabel } from "@/components/ui";
import type { ScenarioDetail, ScenarioListItem } from "../types";

interface ScenarioContextPanelProps {
  scenarios: ScenarioListItem[];
  scenariosStatus: "idle" | "loading" | "error";
  scenariosError: string | null;
  selectedScenarioId: string | null;
  onSelectScenario: (id: string) => void;
  scenario: ScenarioDetail | null;
  scenarioStatus: "idle" | "loading" | "error";
  scenarioError: string | null;
}

export function ScenarioContextPanel({
  scenarios,
  scenariosStatus,
  scenariosError,
  selectedScenarioId,
  onSelectScenario,
  scenario,
  scenarioStatus,
  scenarioError,
}: ScenarioContextPanelProps) {
  return (
    <CommandPanel title="Scenario">
      <div className="flex flex-col gap-4">
        {scenariosStatus === "error" ? (
          <ErrorState title="Scenarios unavailable" detail={scenariosError ?? undefined} />
        ) : scenariosStatus === "loading" && scenarios.length === 0 ? (
          <p className="text-ink-faint text-xs">Loading scenarios…</p>
        ) : scenarios.length === 0 ? (
          <EmptyState title="No scenarios" detail="Create a scenario in the Scenario Builder first." />
        ) : (
          <label className="flex flex-col gap-1.5">
            <SectionLabel>Active scenario</SectionLabel>
            <select
              value={selectedScenarioId ?? ""}
              onChange={(event) => onSelectScenario(event.target.value)}
              className="bg-surface-raised border-hairline-strong text-ink focus-visible:ring-accent-strong rounded-[var(--radius-control)] border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
            >
              {scenarios.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {scenarioStatus === "error" ? (
          <ErrorState title="Scenario unavailable" detail={scenarioError ?? undefined} />
        ) : scenario ? (
          <div className="grid grid-cols-2 gap-3">
            <DataReadout label="Location" value={scenario.location_name ?? undefined} />
            <DataReadout
              label="Coordinates"
              value={
                scenario.latitude != null && scenario.longitude != null
                  ? `${scenario.latitude.toFixed(2)}, ${scenario.longitude.toFixed(2)}`
                  : undefined
              }
            />
            <DataReadout label="Status" value={scenario.status} />
            <DataReadout label="Version" value={scenario.current_version?.version_number} />
          </div>
        ) : null}
      </div>
    </CommandPanel>
  );
}
