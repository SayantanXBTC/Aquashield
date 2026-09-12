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

// "within_hazard_footprint"/"potentially_exposed" only — never "damaged"/
// "destroyed" (CLAUDE.md wording rule; ExposureStatus's own doc comment in
// shared/types/index.ts). "no_active_hazard" is the always-available
// baseline listing (no run executed/selected yet).
const EXPOSURE_STATUS_LABEL: Record<string, string> = {
  within_hazard_footprint: "within footprint",
  potentially_exposed: "potentially exposed",
  no_active_hazard: "no active hazard",
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
  // The dedicated Exposure listing (name/type/status) only ever shows real
  // per-frame exposure results — never the always-available baseline
  // "no_active_hazard" listing, which has no hazard to be exposed to yet.
  const exposedAssets = exposureResults.filter((r) => r.status !== "no_active_hazard");

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

        {/* Prompt 10.1: a read-only status line, not a toggle — the
            landmass/water are always rendered by three/terrain/Landmass.tsx
            regardless of any Data Layers setting. This exists purely so the
            panel never implies real elevation data is available (CLAUDE.md
            §27 "no fabricated numbers"; no DEM ingestion in this phase). */}
        <div className="flex flex-col gap-1.5 text-xs">
          <SectionLabel>Terrain</SectionLabel>
          <p className="text-ink-soft">Procedural Demo Terrain · Elevation: Unavailable</p>
        </div>

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

            {exposedAssets.length > 0 ? (
              <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                {exposedAssets.map((asset) => (
                  <li key={asset.asset_id} className="text-ink-soft flex items-center justify-between gap-2">
                    <span className="truncate">{asset.asset_name}</span>
                    <span className="text-ink-faint shrink-0 text-[10px] tracking-wide uppercase">
                      {asset.asset_type} · {EXPOSURE_STATUS_LABEL[asset.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-ink-faint text-[10px] tracking-wide uppercase">
              AQUASHIELD demo model — not an official forecast
            </p>
          </div>
        )}
      </div>
    </CommandPanel>
  );
}
