import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeographicContextPanel } from "../components/GeographicContextPanel";
import type { GeographicFeature } from "../types";

const COASTLINE_FEATURE: GeographicFeature = {
  id: "f1",
  feature_type: "coastline",
  geometry: { type: "LineString", coordinates: [] },
  properties: {},
  dataset_name: "Natural Earth 110m Coastline",
  source_provider: "Natural Earth",
  license: "Public Domain (Natural Earth — https://www.naturalearthdata.com/about/terms-of-use/)",
};

describe("GeographicContextPanel", () => {
  it("renders the scenario's real coordinates, never a hardcoded location", () => {
    render(
      <GeographicContextPanel
        scenarioLocation={{ latitude: 23.81, longitude: 90.41 }}
        coastlineFeatures={[]}
        infrastructureCount={0}
      />,
    );
    expect(screen.getByText("23.81, 90.41")).toBeInTheDocument();
  });

  it("shows coastline as unavailable when no features were returned", () => {
    render(
      <GeographicContextPanel scenarioLocation={null} coastlineFeatures={[]} infrastructureCount={0} />,
    );
    expect(screen.getByText(/unavailable near this scenario/i)).toBeInTheDocument();
  });

  it("derives coastline provenance from the real API response, not a literal", () => {
    render(
      <GeographicContextPanel
        scenarioLocation={null}
        coastlineFeatures={[COASTLINE_FEATURE]}
        infrastructureCount={0}
      />,
    );
    expect(screen.getByText(/Available — Natural Earth/)).toBeInTheDocument();
  });

  it("honestly labels infrastructure as synthetic demo assets, not OpenStreetMap", () => {
    render(
      <GeographicContextPanel scenarioLocation={null} coastlineFeatures={[]} infrastructureCount={3} />,
    );
    expect(screen.getByText(/synthetic demo assets/i)).toBeInTheDocument();
    expect(screen.queryByText(/openstreetmap/i)).not.toBeInTheDocument();
  });

  it("always shows terrain as procedural and elevation as unavailable", () => {
    render(
      <GeographicContextPanel scenarioLocation={null} coastlineFeatures={[]} infrastructureCount={0} />,
    );
    expect(screen.getByText("Procedural Demo")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
