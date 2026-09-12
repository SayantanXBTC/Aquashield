import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImpactPanel } from "../components/ImpactPanel";
import type { ImpactFrame } from "../types";

const IMPACT: ImpactFrame = {
  simulation_run_id: "r1",
  frame_index: 24,
  disaster_type: "flood",
  data_quality: "available",
  severity_band: "critical",
  exposed_asset_count: 1,
  exposed_counts_by_type: { hospital: 1 },
  exposed_counts_by_criticality: { critical: 1 },
  hazard_footprint: {
    disaster_type: "flood",
    simulation_run_id: "r1",
    frame_index: 24,
    geometry: null,
    geometry_type: "Polygon",
    intensity: 4.0,
    intensity_units: "m",
    model_id: "flood-demo-v1",
    model_version: "flood-demo-v1",
    is_demo_model: true,
  },
  exposure_results: [],
  vulnerability_assessment_ids: ["v1"],
  risk_assessment_id: "r1",
  is_demo_model: true,
  cached: false,
};

describe("ImpactPanel", () => {
  it("shows an honest empty state before a run exists", () => {
    render(<ImpactPanel impact={null} hasRun={false} />);
    expect(screen.getByText(/impact unavailable/i)).toBeInTheDocument();
  });

  it("shows an honest empty state when data is unavailable at this frame", () => {
    render(<ImpactPanel impact={null} hasRun />);
    expect(screen.getByText(/no impact data at this frame/i)).toBeInTheDocument();
  });

  it("renders real severity/exposure/model fields from the impact response, never invented numbers", () => {
    render(<ImpactPanel impact={IMPACT} hasRun />);

    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // exposed_asset_count
    expect(screen.getByText(/hospital \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/critical \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/flood-demo-v1/)).toBeInTheDocument();
    expect(screen.getByText(/not an official forecast/i)).toBeInTheDocument();
  });
});
