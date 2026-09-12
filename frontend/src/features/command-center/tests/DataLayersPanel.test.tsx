import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataLayersPanel } from "../components/DataLayersPanel";
import type { DataLayerKey } from "../hooks/useDataLayers";

const ENABLED: Record<DataLayerKey, boolean> = {
  hazardFootprint: true,
  infrastructure: true,
  exposure: true,
  coastline: true,
};

describe("DataLayersPanel", () => {
  it("always shows Terrain as Procedural Demo with elevation unavailable, regardless of run state", () => {
    render(
      <DataLayersPanel
        enabled={ENABLED}
        onToggle={vi.fn()}
        hazardFootprint={null}
        exposureResults={[]}
        infrastructureCount={0}
        coastlineFeatureCount={0}
        dataQuality="unknown"
        hasRun={false}
      />,
    );
    expect(screen.getByText(/Procedural Demo Terrain/)).toBeInTheDocument();
    expect(screen.getByText(/Elevation: Unavailable/)).toBeInTheDocument();
  });

  it("lists real exposed assets by name/type/status, never a fabricated damage claim", () => {
    render(
      <DataLayersPanel
        enabled={ENABLED}
        onToggle={vi.fn()}
        hazardFootprint={{
          disaster_type: "flood",
          simulation_run_id: "r1",
          frame_index: 24,
          geometry: null,
          geometry_type: "Polygon",
          intensity: 4,
          intensity_units: "m",
          model_id: "flood-demo-v1",
          model_version: "flood-demo-v1",
          is_demo_model: true,
        }}
        exposureResults={[
          {
            asset_id: "a1",
            asset_name: "Demo General Hospital",
            asset_type: "hospital",
            criticality: "critical",
            status: "within_hazard_footprint",
            distance_km: 0,
            latitude: 23.81,
            longitude: 90.41,
          },
        ]}
        infrastructureCount={1}
        coastlineFeatureCount={0}
        dataQuality="available"
        hasRun
      />,
    );

    expect(screen.getByText("Demo General Hospital")).toBeInTheDocument();
    expect(screen.getByText(/hospital · within footprint/i)).toBeInTheDocument();
    expect(screen.queryByText(/destroyed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/damaged/i)).not.toBeInTheDocument();
  });

  it("shows an honest empty state before a run exists", () => {
    render(
      <DataLayersPanel
        enabled={ENABLED}
        onToggle={vi.fn()}
        hazardFootprint={null}
        exposureResults={[]}
        infrastructureCount={0}
        coastlineFeatureCount={0}
        dataQuality="unknown"
        hasRun={false}
      />,
    );
    expect(screen.getByText(/hazard footprint unavailable/i)).toBeInTheDocument();
  });
});
