import { describe, expect, it } from "vitest";
import type { SimulationState } from "@shared/types";
import { toVisualState } from "./simulationVisualAdapter";

function baseState(overrides: Partial<SimulationState>): SimulationState {
  return {
    simulation_run_id: "run-1",
    timestep: 4,
    disaster_type: "flood",
    simulation_time: "2026-01-01T02:00:00Z",
    environmental_state: {},
    hazard_state: {},
    affected_area: null,
    risk_state: {},
    infrastructure_impacts: [],
    metadata: { progress: 0.5 },
    ...overrides,
  };
}

describe("toVisualState", () => {
  it("maps flood hazard_state to radius/intensity from real fields", () => {
    const state = baseState({
      disaster_type: "flood",
      hazard_state: { water_level_m: 3, rise_rate_m_per_hr: 0.5, affected_radius_km: 15 },
    });
    const visual = toVisualState(state);
    expect(visual.radiusKm).toBe(15);
    expect(visual.intensity01).toBeCloseTo(0.5); // 3 / 6
    expect(visual.center).toBeNull();
    expect(visual.label).toContain("3.00");
  });

  it("maps tsunami hazard_state, exposing the source as a secondary center", () => {
    const state = baseState({
      disaster_type: "tsunami",
      hazard_state: {
        wave_height_m: 4,
        coastal_impact_m: 2,
        arrival_progress: 0.6,
        source: { latitude: 3.3, longitude: 95.9 },
      },
    });
    const visual = toVisualState(state);
    expect(visual.center).toBeNull();
    expect(visual.secondaryCenter).toEqual({ latitude: 3.3, longitude: 95.9 });
    expect(visual.radiusKm).toBeCloseTo(8 + 2 * 15);
    expect(visual.label).toContain("60%");
  });

  it("maps cyclone hazard_state to a real moving center", () => {
    const state = baseState({
      disaster_type: "cyclone",
      hazard_state: { center: { latitude: 15, longitude: 90 }, wind_speed_kt: 90, hazard_radius_km: 60 },
    });
    const visual = toVisualState(state);
    expect(visual.center).toEqual({ latitude: 15, longitude: 90 });
    expect(visual.radiusKm).toBe(60);
    expect(visual.intensity01).toBeCloseTo(0.6); // 90 / 150
  });

  it("maps oil_spill hazard_state, deriving radius from slick area", () => {
    const state = baseState({
      disaster_type: "oil_spill",
      hazard_state: { center: { latitude: 19, longitude: 72.8 }, slick_area_km2: Math.PI * 4, concentration_index: 0.8 },
    });
    const visual = toVisualState(state);
    expect(visual.radiusKm).toBeCloseTo(2);
    expect(visual.intensity01).toBeCloseTo(0.8);
  });

  it("maps search_rescue hazard_state, inverting confidence into intensity", () => {
    const state = baseState({
      disaster_type: "search_rescue",
      hazard_state: { probable_center: { latitude: 8.5, longitude: 76.9 }, search_radius_km: 12, confidence: 0.3 },
    });
    const visual = toVisualState(state);
    expect(visual.radiusKm).toBe(12);
    expect(visual.intensity01).toBeCloseTo(0.7);
  });

  it("never fabricates a value — missing fields become 0, not a guess", () => {
    const state = baseState({ disaster_type: "cyclone", hazard_state: {} });
    const visual = toVisualState(state);
    expect(visual.radiusKm).toBe(0);
    expect(visual.intensity01).toBe(0);
    expect(visual.center).toBeNull();
  });
});
