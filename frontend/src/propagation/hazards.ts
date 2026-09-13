/**
 * Per-disaster hazard formulas — TypeScript MIRROR of the four demo models
 * under simulation/models/{tsunami,cyclone,oil_spill,flood}/model.py. Every
 * constant here is that model's documented illustrative constant, ported
 * verbatim; mirror.test.ts checks the results against fixtures the Python
 * side generated. SIMPLIFIED DEMONSTRATION MODELS — not forecasts.
 *
 * Two entry points produce the same `HazardSnapshot`:
 *   - `computeHazard(kind, params, elapsedMinutes)` — live preview, run on
 *     the client every frame from the current slider/pin values;
 *   - `snapshotFromRecordedFrame(hazardState)` — replay of a frame the
 *     backend recorded (its `hazard_state` already contains every number).
 * Visualizers and the telemetry HUD never care which one produced it.
 */
import type { DisasterType, HazardPhase, PropagationHazardState, StructureImpact } from "@shared/types";
import { frontState, paramsFromConfig, type FrontState, type ModelDefaults, type PropagationParams } from "./kinematics";
import { DEFAULT_SHORE, type ShoreParams } from "./world";

export type HazardKind = "tsunami" | "cyclone" | "oil_spill" | "coastal_flood";

/** disaster_type -> hazard kind, mirroring simulation/core/registry.py's
 * reuse decisions (flash_flood/coastal_flood -> flood model, storm_surge ->
 * cyclone, chemical_pollution -> oil spill). search_rescue has no shoreline
 * visual and returns null. */
export function hazardKindFor(disasterType: DisasterType | string): HazardKind | null {
  switch (disasterType) {
    case "flood":
    case "flash_flood":
    case "coastal_flood":
      return "coastal_flood";
    case "storm_surge":
    case "cyclone":
      return "cyclone";
    case "tsunami":
      return "tsunami";
    case "oil_spill":
    case "chemical_pollution":
      return "oil_spill";
    default:
      return null;
  }
}

/** Each model's own defaults (DEFAULT_SPEED_KMH / DEFAULT_SPREAD_KM). */
export const MODEL_DEFAULTS: Record<HazardKind, ModelDefaults> = {
  tsunami: { speedKmh: 500, spreadRadiusKm: 12 },
  cyclone: { speedKmh: 25, spreadRadiusKm: 80 },
  oil_spill: { speedKmh: 3, spreadRadiusKm: 18 },
  coastal_flood: { speedKmh: 40, spreadRadiusKm: 10 },
};

export interface HazardSnapshot {
  kind: HazardKind;
  elapsedMinutes: number;
  params: PropagationParams;
  front: FrontState;
  phase: HazardPhase;
  /** Hazard radius in km: slick radius, wind-field radius, inundation reach. */
  radiusKm: number;
  /** 0-1 visual driver (colour/scale) — a fixed-ceiling normalisation of a
   * real model value, documented per kind below. */
  intensity01: number;
  /** Short real-number readout for the scene label. */
  label: string;
  /** Per-structure exposure for this frame (src/propagation/structures.ts
   * live, or a recorded frame's `infrastructure_impacts`). Attached by the
   * session, not computed here. */
  impacts?: StructureImpact[];
  // tsunami
  waveHeightM?: number;
  frontRadiusKm?: number;
  coastalImpactM?: number;
  inundationKm?: number;
  // cyclone
  windSpeedKt?: number;
  windDecay?: number;
  // oil spill
  slickRadiusKm?: number;
  concentrationIndex?: number;
  beached?: boolean;
  // coastal flood
  waterLevelM?: number;
  peakLevelM?: number;
}

function phaseOf(front: FrontState): HazardPhase {
  if (front.minutesSinceArrival > 0) return "inland";
  return front.arrived ? "landfall" : "offshore";
}

export function paramsFor(kind: HazardKind, config: Record<string, unknown>): PropagationParams {
  return paramsFromConfig(config, MODEL_DEFAULTS[kind]);
}

export function computeHazard(kind: HazardKind, params: PropagationParams, elapsedMinutes: number, shore: ShoreParams = DEFAULT_SHORE): HazardSnapshot {
  const hours = Math.max(0, elapsedMinutes) / 60;
  switch (kind) {
    case "tsunami": {
      const front = frontState(params, elapsedMinutes, true, shore);
      const initialWaveHeight = 0.5 + 9.5 * params.intensity;
      const waveHeightM = Math.max(0.05, initialWaveHeight * (1 - 0.35 * front.arrivalProgress));
      const ramp = front.arrived ? Math.min(1, front.minutesSinceArrival / 30) : 0;
      const inundationKm = params.spreadRadiusKm * params.intensity * ramp;
      const coastalImpactM = waveHeightM * front.arrivalProgress;
      return {
        kind,
        elapsedMinutes,
        params,
        front,
        phase: phaseOf(front),
        radiusKm: inundationKm,
        intensity01: Math.min(1, waveHeightM / 10), // 10 m = the model's own max initial height
        label: `Wave ${waveHeightM.toFixed(1)} m`,
        waveHeightM,
        frontRadiusKm: front.traveledKm,
        coastalImpactM,
        inundationKm,
      };
    }
    case "cyclone": {
      const front = frontState(params, elapsedMinutes, false, shore);
      const peakWind = 35 + 125 * params.intensity;
      const decay = Math.exp(-0.6 * params.dispersionRate * (front.minutesSinceArrival / 60));
      const windSpeedKt = peakWind * decay;
      return {
        kind,
        elapsedMinutes,
        params,
        front,
        phase: phaseOf(front),
        radiusKm: params.spreadRadiusKm,
        intensity01: Math.min(1, windSpeedKt / 160), // 160 kt = the model's own max peak wind
        label: `Wind ${windSpeedKt.toFixed(0)} kt`,
        windSpeedKt,
        windDecay: decay,
      };
    }
    case "oil_spill": {
      const front = frontState(params, elapsedMinutes, true, shore);
      const growth = 1 - Math.exp(-(0.4 + 1.6 * params.dispersionRate) * hours);
      const slickRadiusKm = 0.3 + params.spreadRadiusKm * growth;
      const concentrationIndex = Math.exp(-0.35 * params.dispersionRate * hours) * (0.35 + 0.65 * params.intensity);
      return {
        kind,
        elapsedMinutes,
        params,
        front,
        phase: phaseOf(front),
        radiusKm: slickRadiusKm,
        intensity01: Math.min(1, concentrationIndex),
        label: `Slick ${(Math.PI * slickRadiusKm * slickRadiusKm).toFixed(1)} km²`,
        slickRadiusKm,
        concentrationIndex,
        beached: front.arrived,
      };
    }
    case "coastal_flood": {
      const front = frontState(params, elapsedMinutes, true, shore);
      const peakLevelM = 0.5 + 5.5 * params.intensity;
      const since = front.minutesSinceArrival;
      let level: number;
      if (!front.arrived) level = 0;
      else if (since <= 60) {
        const t = since / 60;
        level = peakLevelM * (t * t * (3 - 2 * t));
      } else {
        level = peakLevelM * Math.exp(-0.3 * params.dispersionRate * ((since - 60) / 60));
      }
      const ratio = peakLevelM <= 0 ? 0 : level / peakLevelM;
      const inundationKm = params.spreadRadiusKm * ratio;
      return {
        kind,
        elapsedMinutes,
        params,
        front,
        phase: phaseOf(front),
        radiusKm: inundationKm,
        intensity01: Math.min(1, level / 6), // 6 m = the model's own max peak level
        label: `Water level ${level.toFixed(2)} m`,
        waterLevelM: level,
        peakLevelM,
        inundationKm,
      };
    }
  }
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Rebuilds a snapshot from a frame the backend recorded. Every number is
 * read from `hazard_state`; nothing is recomputed. */
export function snapshotFromRecordedFrame(
  kind: HazardKind,
  hazardState: Partial<PropagationHazardState> & Record<string, unknown>,
  elapsedMinutes: number,
): HazardSnapshot {
  const h = hazardState;
  const origin = (h.origin_km ?? { x: 0, y: 0 }) as { x: number; y: number };
  const position = (h.position_km ?? origin) as { x: number; y: number };
  const params: PropagationParams = {
    originXKm: num(origin.x),
    originYKm: num(origin.y),
    headingDeg: num(h.heading_deg),
    speedKmh: num(h.speed_kmh, 1),
    intensity: num(h.intensity),
    spreadRadiusKm: num(h.hazard_radius_km ?? h.spread_radius_km ?? h.radius_km),
    dispersionRate: num(h.dispersion_rate),
  };
  const arrived = Boolean(h.arrived);
  const front: FrontState = {
    elapsedMinutes,
    traveledKm: num(h.traveled_km),
    positionXKm: num(position.x),
    positionYKm: num(position.y),
    coastDistanceTotalKm: typeof h.coast_distance_total_km === "number" ? h.coast_distance_total_km : null,
    distanceToCoastKm: typeof h.distance_to_coast_km === "number" ? h.distance_to_coast_km : null,
    arrivalProgress: num(h.arrival_progress),
    arrived,
    etaMinutes: typeof h.eta_minutes === "number" ? h.eta_minutes : null,
    minutesSinceArrival: h.phase === "inland" ? 1 : 0,
  };
  const phase = (h.phase as HazardPhase | undefined) ?? phaseOf(front);
  const base = { kind, elapsedMinutes, params, front, phase, radiusKm: num(h.radius_km) };
  switch (kind) {
    case "tsunami": {
      const waveHeightM = num(h.wave_height_m);
      return {
        ...base,
        intensity01: Math.min(1, waveHeightM / 10),
        label: `Wave ${waveHeightM.toFixed(1)} m`,
        waveHeightM,
        frontRadiusKm: num(h.front_radius_km, front.traveledKm),
        coastalImpactM: num(h.coastal_impact_m),
        inundationKm: num(h.inundation_km),
      };
    }
    case "cyclone": {
      const windSpeedKt = num(h.wind_speed_kt);
      return {
        ...base,
        radiusKm: num(h.hazard_radius_km, base.radiusKm),
        intensity01: Math.min(1, windSpeedKt / 160),
        label: `Wind ${windSpeedKt.toFixed(0)} kt`,
        windSpeedKt,
        windDecay: num(h.wind_decay, 1),
      };
    }
    case "oil_spill": {
      const slickRadiusKm = num(h.slick_radius_km, base.radiusKm);
      const concentrationIndex = num(h.concentration_index);
      return {
        ...base,
        radiusKm: slickRadiusKm,
        intensity01: Math.min(1, concentrationIndex),
        label: `Slick ${num(h.slick_area_km2).toFixed(1)} km²`,
        slickRadiusKm,
        concentrationIndex,
        beached: Boolean(h.beached),
      };
    }
    case "coastal_flood": {
      const level = num(h.water_level_m);
      return {
        ...base,
        intensity01: Math.min(1, level / 6),
        label: `Water level ${level.toFixed(2)} m`,
        waterLevelM: level,
        peakLevelM: num(h.peak_level_m),
        inundationKm: num(h.inundation_km),
      };
    }
  }
}
