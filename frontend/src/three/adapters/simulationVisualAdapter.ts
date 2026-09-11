import type { DisasterType, SimulationState } from "@shared/types";
import type { LatLon } from "../utils/geoProjection";

/**
 * The seam between Prompt 7's simulation contracts and the Three.js scene.
 * Disaster visualizers never read `SimulationState`/`hazard_state` directly
 * — they only ever see a `SimulationVisualState`, so a backend field rename
 * only touches this one file, not five visualizer components.
 *
 * Every number below is read directly from the real simulation output
 * (simulation/models/<type>/model.py — Prompt 7). Where a *visual* radius or
 * 0-1 intensity isn't already a named field (e.g. tsunami has no
 * `impact_radius_km`), this derives one with a documented, fixed mapping —
 * a rendering convenience, never an invented physical quantity (Prompt 8
 * "Do not invent scientific formulas. This is a visualization mapping
 * layer.").
 */
export interface SimulationVisualState {
  disasterType: DisasterType;
  timestep: number;
  simulationTimeIso: string | null;
  /** 0-1 run progress, straight from the engine's own frame metadata. */
  progress: number;
  /** Primary hazard center. `null` means "use the scenario's own location"
   * (flood has no separate moving center). */
  center: LatLon | null;
  /** A secondary point of interest — currently only the tsunami's distant
   * source, shown as its own marker. */
  secondaryCenter: LatLon | null;
  radiusKm: number;
  /** 0-1 visual intensity driver (color/scale), fixed-ceiling normalization
   * of a real value — see the per-type mapping below. */
  intensity01: number;
  /** A short, real-number label for the scene marker — never a fabricated
   * statistic. */
  label: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function point(value: unknown): LatLon | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const latitude = num(v.latitude);
  const longitude = num(v.longitude);
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function toVisualState(state: SimulationState): SimulationVisualState {
  const hazard = state.hazard_state as Record<string, unknown>;
  const progress = num((state.metadata as Record<string, unknown> | undefined)?.progress);
  const base = {
    disasterType: state.disaster_type,
    timestep: state.timestep,
    simulationTimeIso: state.simulation_time ?? null,
    progress,
    secondaryCenter: null as LatLon | null,
  };

  switch (state.disaster_type) {
    case "flood":
    case "flash_flood":
    case "coastal_flood": {
      const waterLevelM = num(hazard.water_level_m);
      return {
        ...base,
        center: null,
        radiusKm: num(hazard.affected_radius_km),
        intensity01: clamp01(waterLevelM / 6), // 6m ~ visual scale ceiling, not a hazard threshold
        label: `Water level ${waterLevelM.toFixed(2)} m`,
      };
    }
    case "tsunami": {
      const waveHeightM = num(hazard.wave_height_m);
      const coastalImpactM = num(hazard.coastal_impact_m);
      return {
        ...base,
        center: null, // impact is centered on the scenario's coastal location
        secondaryCenter: point(hazard.source),
        radiusKm: 8 + coastalImpactM * 15, // visualization-only radius mapping
        intensity01: clamp01(coastalImpactM / 5),
        label: `Wave ${waveHeightM.toFixed(2)} m — arrival ${(num(hazard.arrival_progress) * 100).toFixed(0)}%`,
      };
    }
    case "cyclone":
    case "storm_surge": {
      const windSpeedKt = num(hazard.wind_speed_kt);
      return {
        ...base,
        center: point(hazard.center),
        radiusKm: num(hazard.hazard_radius_km),
        intensity01: clamp01(windSpeedKt / 150),
        label: `Wind ${windSpeedKt.toFixed(0)} kt`,
      };
    }
    case "oil_spill":
    case "chemical_pollution": {
      const areaKm2 = num(hazard.slick_area_km2);
      return {
        ...base,
        center: point(hazard.center),
        radiusKm: Math.sqrt(areaKm2 / Math.PI),
        intensity01: clamp01(num(hazard.concentration_index)),
        label: `Slick ${areaKm2.toFixed(1)} km²`,
      };
    }
    case "search_rescue": {
      const radiusKm = num(hazard.search_radius_km);
      const confidence = num(hazard.confidence);
      return {
        ...base,
        center: point(hazard.probable_center),
        radiusKm,
        intensity01: clamp01(1 - confidence),
        label: `Search radius ${radiusKm.toFixed(1)} km`,
      };
    }
    default:
      return {
        ...base,
        center: null,
        radiusKm: 0,
        intensity01: 0,
        label: "No visual mapping for this disaster type",
      };
  }
}
