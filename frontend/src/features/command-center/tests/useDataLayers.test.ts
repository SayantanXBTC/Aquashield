import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../api/geospatialApi", () => ({
  geospatialApi: {
    getHazardFootprints: vi.fn(),
    getExposure: vi.fn(),
    getImpact: vi.fn(),
  },
}));

import { geospatialApi } from "../api/geospatialApi";
import { useDataLayers } from "../hooks/useDataLayers";

const FOOTPRINTS = [
  {
    disaster_type: "flood" as const,
    simulation_run_id: "r1",
    frame_index: 0,
    geometry: null,
    geometry_type: null,
    intensity: 1.0,
    intensity_units: "m",
    model_id: "flood-demo-v1",
    model_version: "flood-demo-v1",
    is_demo_model: true as const,
  },
  {
    disaster_type: "flood" as const,
    simulation_run_id: "r1",
    frame_index: 1,
    geometry: { type: "Polygon", coordinates: [[[88.3, 22.5]]] },
    geometry_type: "Polygon",
    intensity: 2.0,
    intensity_units: "m",
    model_id: "flood-demo-v1",
    model_version: "flood-demo-v1",
    is_demo_model: true as const,
  },
];

const EXPOSURE_RESULT = {
  asset_id: "a1",
  asset_name: "Test Hospital",
  asset_type: "hospital",
  criticality: "critical",
  status: "within_hazard_footprint" as const,
  distance_km: 0,
  latitude: 22.5,
  longitude: 88.3,
};

beforeEach(() => {
  vi.mocked(geospatialApi.getHazardFootprints).mockResolvedValue({
    simulation_run_id: "r1",
    frame_count: FOOTPRINTS.length,
    footprints: FOOTPRINTS,
  });
  vi.mocked(geospatialApi.getExposure).mockResolvedValue({
    simulation_run_id: "r1",
    frame_index: 1,
    data_quality: "available",
    exposure_results: [EXPOSURE_RESULT],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useDataLayers", () => {
  it("does not fetch when there is no completed run", () => {
    renderHook(() => useDataLayers({ runId: null, runCompleted: false, frameIndex: 0 }));
    expect(geospatialApi.getHazardFootprints).not.toHaveBeenCalled();
    expect(geospatialApi.getExposure).not.toHaveBeenCalled();
  });

  it("fetches footprints and exposure once a run is completed, selecting the current frame's footprint", async () => {
    const { result } = renderHook(() => useDataLayers({ runId: "r1", runCompleted: true, frameIndex: 1 }));

    await waitFor(() => expect(result.current.hazardFootprint?.frame_index).toBe(1));
    expect(result.current.hazardFootprint?.geometry_type).toBe("Polygon");
    expect(result.current.exposureResults).toEqual([EXPOSURE_RESULT]);
    expect(result.current.dataQuality).toBe("available");
  });

  it("toggling a layer off clears its data without refetching", async () => {
    const { result } = renderHook(() => useDataLayers({ runId: "r1", runCompleted: true, frameIndex: 1 }));
    await waitFor(() => expect(result.current.hazardFootprint).not.toBeNull());

    act(() => result.current.toggleLayer("hazardFootprint"));
    expect(result.current.enabled.hazardFootprint).toBe(false);
    expect(result.current.hazardFootprint).toBeNull();
  });

  it("clears exposure results when both infrastructure and exposure toggles are off", async () => {
    const { result } = renderHook(() => useDataLayers({ runId: "r1", runCompleted: true, frameIndex: 1 }));
    await waitFor(() => expect(result.current.exposureResults.length).toBe(1));

    act(() => result.current.toggleLayer("infrastructure"));
    act(() => result.current.toggleLayer("exposure"));

    await waitFor(() => expect(result.current.exposureResults).toEqual([]));
  });
});
