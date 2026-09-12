import { CommandPanel, DataReadout, EmptyState, SectionLabel } from "@/components/ui";
import type { ImpactFrame } from "../types";

interface ImpactPanelProps {
  impact: ImpactFrame | null;
  hasRun: boolean;
}

const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

/** Prompt 10.1: a dedicated per-frame impact summary — GET
 * /simulation-runs/{id}/impact/frames/{frame_index} via
 * geospatialApi.getImpact, fetched per-frame by useDataLayers. Every field
 * rendered here comes straight from that response; `severity_band` is
 * AQUASHIELD's own documented UI band (backend/app/services/
 * impact_severity.py), never an official forecast, and `is_demo_model`/
 * `model_id` are shown verbatim rather than implied. */
export function ImpactPanel({ impact, hasRun }: ImpactPanelProps) {
  if (!hasRun) {
    return (
      <CommandPanel title="Impact">
        <EmptyState title="Impact unavailable" detail="Execute a simulation run to compute an impact summary." />
      </CommandPanel>
    );
  }

  if (!impact || impact.data_quality === "unavailable" || impact.data_quality === "unknown") {
    return (
      <CommandPanel title="Impact">
        <EmptyState
          title="No impact data at this frame"
          detail="Impact summary is not yet available for the current frame."
        />
      </CommandPanel>
    );
  }

  const typeEntries = Object.entries(impact.exposed_counts_by_type);
  const criticalityEntries = Object.entries(impact.exposed_counts_by_criticality);

  return (
    <CommandPanel title="Impact">
      <div className="flex flex-col gap-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <DataReadout
            label="Severity"
            value={impact.severity_band ? SEVERITY_LABEL[impact.severity_band] : undefined}
          />
          <DataReadout label="Exposed assets" value={impact.exposed_asset_count} />
        </div>

        {typeEntries.length > 0 ? (
          <div className="flex flex-col gap-1">
            <SectionLabel>By type</SectionLabel>
            <p className="text-ink-soft">
              {typeEntries.map(([type, count]) => `${type} (${count})`).join(", ")}
            </p>
          </div>
        ) : null}

        {criticalityEntries.length > 0 ? (
          <div className="flex flex-col gap-1">
            <SectionLabel>By criticality</SectionLabel>
            <p className="text-ink-soft">
              {criticalityEntries.map(([level, count]) => `${level} (${count})`).join(", ")}
            </p>
          </div>
        ) : null}

        <p className="text-ink-faint text-[10px] tracking-wide uppercase">
          {impact.hazard_footprint?.model_id ?? "Demo model"}
          {impact.is_demo_model ? " · SIMPLIFIED DEMONSTRATION MODEL" : ""} — not an official forecast
        </p>
      </div>
    </CommandPanel>
  );
}
