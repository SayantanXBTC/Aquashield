import { CommandButton, CommandPanel, EmptyState, SectionLabel } from "@/components/ui";
import type { DataLayerKey } from "../hooks/useDataLayers";
import type { ExposureResult, GeospatialDataQuality, HazardFootprint } from "../types";

interface DataLayersPanelProps {
  enabled: Record<DataLayerKey, boolean>;
  onToggle: (key: DataLayerKey) => void;
  hazardFootprint: HazardFootprint | null;
  exposureResults: ExposureResult[];
  /** Always available — independent of any run (GET /infrastructure-assets). */
  infrastructureCount: number;
  /** Always available — real Natural Earth data (GET /geographic-features/nearby). */
  coastlineFeatureCount: number;
  dataQuality: GeospatialDataQuality;
  hasRun: boolean;
}

const LAYER_LABELS: Record<DataLayerKey, string> = {
  hazardFootprint: "Hazard Footprint",
  infrastructure: "Infrastructure",
  exposure: "Exposure",
  coastline: "Coastline",
};

/** Real Geospatial World & Exposure Analysis (Prompt 10) — compact layer
 * toggles for the command center, following the existing CommandPanel/
 * CommandButton/EmptyState visual language rather than inventing new
 * controls. Never renders a fabricated count — every number here comes from
 * GET /simulation-runs/{id}/hazard-footprints and /exposure. */
export function DataLayersPanel({
  enabled,
  onToggle,
  hazardFootprint,
  exposureResults,
  infrastructureCount,
  coastlineFeatureCount,
  dataQuality,
  hasRun,
}: DataLayersPanelProps) {
  const exposedCount = exposureResults.filter((r) => r.status === "within_hazard_footprint").length;
  const nearbyCount = exposureResults.filter((r) => r.status === "potentially_exposed").length;

  return (
    <CommandPanel title="Data Layers">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LAYER_LABELS) as DataLayerKey[]).map((key) => (
            <CommandButton
              key={key}
              type="button"
              tone={enabled[key] ? "accent" : "default"}
              aria-pressed={enabled[key]}
              onClick={() => onToggle(key)}
            >
              {LAYER_LABELS[key]}
            </CommandButton>
          ))}
        </div>

        {enabled.infrastructure ? (
          <div className="flex flex-col gap-1.5 text-xs">
            <SectionLabel>Infrastructure</SectionLabel>
            <p className="text-ink-soft">
              {infrastructureCount > 0
                ? `${infrastructureCount} known asset${infrastructureCount === 1 ? "" : "s"}`
                : "No known assets near this scenario"}
            </p>
          </div>
        ) : null}

        {enabled.coastline ? (
          <div className="flex flex-col gap-1.5 text-xs">
            <SectionLabel>Coastline</SectionLabel>
            <p className="text-ink-soft">
              {coastlineFeatureCount > 0
                ? `${coastlineFeatureCount} segment${coastlineFeatureCount === 1 ? "" : "s"} within 300 km`
                : "No coastline data within 300 km of this scenario"}
            </p>
            {coastlineFeatureCount > 0 ? (
              <p className="text-ink-faint text-[10px] tracking-wide uppercase">
                Natural Earth · public domain
              </p>
            ) : null}
          </div>
        ) : null}

        {!hasRun ? (
          <EmptyState
            title="Hazard footprint unavailable"
            detail="Execute a simulation run to load hazard footprint and exposure data."
          />
        ) : dataQuality === "unavailable" || dataQuality === "unknown" ? (
          <EmptyState
            title="Dataset unavailable for this scenario"
            detail="No hazard footprint geometry is available at this frame yet."
          />
        ) : (
          <div className="flex flex-col gap-1.5 text-xs">
            <SectionLabel>Hazard Footprint</SectionLabel>
            <p className="text-ink-soft">
              {hazardFootprint
                ? `${hazardFootprint.intensity ?? "—"} ${hazardFootprint.intensity_units} (${hazardFootprint.geometry_type ?? "no geometry yet"})`
                : "No footprint at this frame"}
            </p>

            <SectionLabel>Exposure</SectionLabel>
            <p className="text-ink-soft">
              {exposedCount} within footprint · {nearbyCount} potentially exposed
            </p>

            <p className="text-ink-faint text-[10px] tracking-wide uppercase">
              AQUASHIELD demo model — not an official forecast
            </p>
          </div>
        )}
      </div>
    </CommandPanel>
  );
}
