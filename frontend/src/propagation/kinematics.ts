/**
 * Propagation kinematics — TypeScript MIRROR of simulation/core/propagation.py
 * (`PropagationParams`, `front_state`). See world.ts for the mirroring
 * contract. This is what the Command Center's live preview runs every frame
 * while a user drags the origin pin or moves a slider; the backend runs the
 * Python original when a run is recorded.
 */
import type { PropagationConfig } from "@shared/types";
import { DEFAULT_SHORE, WORLD_DEFAULTS, WORLD_KM, clamp, distanceToCoastAlongHeading, headingVector, round4, type ShoreParams } from "./world";

const MARCH_MAX_KM = WORLD_KM * 1.5;

export interface PropagationParams {
  originXKm: number;
  originYKm: number;
  headingDeg: number;
  speedKmh: number;
  intensity: number;
  spreadRadiusKm: number;
  dispersionRate: number;
}

export interface ModelDefaults {
  speedKmh: number;
  spreadRadiusKm: number;
}

export function paramsFromConfig(config: PropagationConfig | Record<string, unknown>, defaults: ModelDefaults): PropagationParams {
  const c = config as Record<string, unknown>;
  const num = (key: string, fallback: number): number => {
    const raw = c[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  };
  return {
    originXKm: clamp(num("origin_x_km", WORLD_DEFAULTS.origin_x_km), 0, WORLD_KM),
    originYKm: clamp(num("origin_y_km", WORLD_DEFAULTS.origin_y_km), 0, WORLD_KM),
    headingDeg: ((num("heading_deg", WORLD_DEFAULTS.heading_deg) % 360) + 360) % 360,
    speedKmh: Math.max(0.1, num("speed_kmh", defaults.speedKmh)),
    intensity: clamp(num("intensity", WORLD_DEFAULTS.intensity), 0, 1),
    spreadRadiusKm: Math.max(0, num("spread_radius_km", defaults.spreadRadiusKm)),
    dispersionRate: clamp(num("dispersion_rate", WORLD_DEFAULTS.dispersion_rate), 0, 1),
  };
}

export function paramsToConfig(params: PropagationParams): PropagationConfig {
  return {
    origin_x_km: params.originXKm,
    origin_y_km: params.originYKm,
    heading_deg: params.headingDeg,
    speed_kmh: params.speedKmh,
    intensity: params.intensity,
    spread_radius_km: params.spreadRadiusKm,
    dispersion_rate: params.dispersionRate,
  };
}

export interface FrontState {
  elapsedMinutes: number;
  traveledKm: number;
  positionXKm: number;
  positionYKm: number;
  coastDistanceTotalKm: number | null;
  distanceToCoastKm: number | null;
  arrivalProgress: number;
  arrived: boolean;
  etaMinutes: number | null;
  minutesSinceArrival: number;
}

/** Advance the hazard front `elapsedMinutes` from the origin. `stopAtCoast`
 * pins the position at the shoreline once reached.
 *
 * `coastOverrideKm` replaces the analytic shoreline march with a distance
 * measured elsewhere — the "real_map" profile reads the real coast off the
 * basemap's water polygons (three/map/mapCoast.ts), where the synthetic sine
 * curve describes a coastline that is not under the map. `null` keeps the
 * analytic curve, which is what every synthetic-world caller and every
 * fixture uses, so the Python mirror is untouched. */
export function frontState(
  params: PropagationParams,
  elapsedMinutes: number,
  stopAtCoast: boolean,
  shore: ShoreParams = DEFAULT_SHORE,
  coastOverrideKm: number | null = null,
): FrontState {
  const hours = Math.max(0, elapsedMinutes) / 60;
  const total = coastOverrideKm ?? distanceToCoastAlongHeading(params.originXKm, params.originYKm, params.headingDeg, shore);
  const traveled = params.speedKmh * hours;
  const [dx, dy] = headingVector(params.headingDeg);

  if (total === null) {
    const advance = Math.min(traveled, MARCH_MAX_KM);
    return {
      elapsedMinutes,
      traveledKm: round4(traveled),
      positionXKm: params.originXKm + dx * advance,
      positionYKm: params.originYKm + dy * advance,
      coastDistanceTotalKm: null,
      distanceToCoastKm: null,
      arrivalProgress: 0,
      arrived: false,
      etaMinutes: null,
      minutesSinceArrival: 0,
    };
  }

  const arrived = traveled >= total;
  const progress = total <= 0 ? 1 : clamp(traveled / total, 0, 1);
  const remaining = Math.max(0, total - traveled);
  const eta = arrived ? 0 : (remaining / params.speedKmh) * 60;
  const sinceArrival = arrived ? ((traveled - total) / params.speedKmh) * 60 : 0;
  const advance = stopAtCoast ? Math.min(traveled, total) : traveled;
  return {
    elapsedMinutes,
    traveledKm: round4(traveled),
    positionXKm: params.originXKm + dx * advance,
    positionYKm: params.originYKm + dy * advance,
    coastDistanceTotalKm: total,
    distanceToCoastKm: remaining,
    arrivalProgress: progress,
    arrived,
    etaMinutes: eta,
    minutesSinceArrival: sinceArrival,
  };
}
