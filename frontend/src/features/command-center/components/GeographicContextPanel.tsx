import { CommandPanel, DataReadout, SectionLabel } from "@/components/ui";
import type { LatLon } from "@/three/utils/geoProjection";
import type { GeographicFeature } from "../types";

interface GeographicContextPanelProps {
  scenarioLocation: LatLon | null;
  coastlineFeatures: GeographicFeature[];
  infrastructureCount: number;
}

/** Prompt 10.1: a compact "what real geographic data backs this view"
 * summary. Every value is derived from real state/API data, never a
 * literal typed into this component:
 *  - Coordinates: the scenario's own lat/lon (ScenarioDetail).
 *  - Coastline: derived from the actual GET /geographic-features/nearby
 *    response — source_provider/license come from the ingested dataset row
 *    (Natural Earth 110m Coastline, public domain), not a hardcoded string;
 *    "Unavailable" when nothing was returned, never assumed present.
 *  - Infrastructure: backend/app/db/seed.py seeds every InfrastructureAsset
 *    with extra_metadata={"demo_data": true} and no real source-provider
 *    field — this honestly reads "Synthetic demo assets", not "OpenStreetMap"
 *    or any other real-world provenance claim that wouldn't be true.
 *  - Elevation/Terrain: explicitly unavailable/procedural — see CLAUDE.md
 *    §27 and docs/geospatial/impact-visualization.md. No DEM ingestion is
 *    part of this phase.
 */
export function GeographicContextPanel({
  scenarioLocation,
  coastlineFeatures,
  infrastructureCount,
}: GeographicContextPanelProps) {
  const coastlineSample = coastlineFeatures[0] ?? null;

  return (
    <CommandPanel title="Geographic Context">
      <div className="flex flex-col gap-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <DataReadout
            label="Coordinates"
            value={
              scenarioLocation
                ? `${scenarioLocation.latitude.toFixed(2)}, ${scenarioLocation.longitude.toFixed(2)}`
                : undefined
            }
          />
          <DataReadout
            label="Infrastructure"
            value={infrastructureCount > 0 ? `${infrastructureCount} asset${infrastructureCount === 1 ? "" : "s"}` : "None known"}
          />
        </div>

        <div className="flex flex-col gap-1">
          <SectionLabel>Coastline</SectionLabel>
          <p className="text-ink-soft">
            {coastlineSample
              ? `Available — ${coastlineSample.source_provider} (${coastlineSample.license})`
              : "Unavailable near this scenario"}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <SectionLabel>Infrastructure source</SectionLabel>
          <p className="text-ink-soft">Synthetic demo assets — no real-world provenance</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DataReadout label="Elevation" value="Unavailable" />
          <DataReadout label="Terrain" value="Procedural Demo" />
        </div>

        <p className="text-ink-faint text-[10px] tracking-wide uppercase">
          Terrain remains procedural — DEM ingestion is not part of this phase
        </p>
      </div>
    </CommandPanel>
  );
}
