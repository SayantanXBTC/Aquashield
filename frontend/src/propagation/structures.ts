/**
 * Structure exposure — TypeScript MIRROR of simulation/core/structures.py.
 * See world.ts for the mirroring contract; mirror.test.ts replays the
 * shared fixtures' `infrastructure_impacts` through this port.
 * SIMPLIFIED DEMONSTRATION rules — not a vulnerability or damage model.
 */
import type { StructureConfig, StructureImpact, StructureStatus } from "@shared/types";
import type { HazardKind, HazardSnapshot } from "./hazards";
import { DEFAULT_SHORE, headingVector, landDepthKm, type ShoreParams } from "./world";

const TSUNAMI_HALF_ANGLE_RAD = (40 * Math.PI) / 180;
const COASTAL_STRUCTURE_MAX_SHORE_KM = 3;
const OIL_FRINGE_KM = 2;
const FLOOD_LATERAL_BASE_KM = 25;
export const EXPOSURE_CLEAR = 0.05;
export const EXPOSURE_AT_RISK = 0.35;
export const EXPOSURE_IMPACTED = 0.7;

export function statusFor(exposure: number): StructureStatus {
  if (exposure < EXPOSURE_CLEAR) return "clear";
  if (exposure < EXPOSURE_AT_RISK) return "at_risk";
  if (exposure < EXPOSURE_IMPACTED) return "impacted";
  return "severe";
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function inlandDepthKm(xKm: number, yKm: number, shore: ShoreParams = DEFAULT_SHORE): number {
  return landDepthKm(xKm, yKm, shore);
}

function lateralOffsetKm(px: number, py: number, ox: number, oy: number, headingDeg: number): number {
  const [dx, dy] = headingVector(headingDeg);
  return Math.abs((px - ox) * dy - (py - oy) * dx);
}

export interface HazardGeometry {
  kind: HazardKind;
  originXKm: number;
  originYKm: number;
  positionXKm: number;
  positionYKm: number;
  headingDeg: number;
  arrived: boolean;
  coastDistanceTotalKm: number | null;
  traveledKm: number;
  spreadRadiusKm: number;
  radiusKm: number;
  inundationKm: number;
  scale: number;
}

/** The same geometry the Python models hand to `assess_structures`, read
 * off a HazardSnapshot (live or replayed). */
export function geometryFromSnapshot(s: HazardSnapshot): HazardGeometry {
  const base = {
    kind: s.kind,
    originXKm: s.params.originXKm,
    originYKm: s.params.originYKm,
    positionXKm: s.front.positionXKm,
    positionYKm: s.front.positionYKm,
    headingDeg: s.params.headingDeg,
    arrived: s.front.arrived,
    coastDistanceTotalKm: s.front.coastDistanceTotalKm,
    traveledKm: s.front.traveledKm,
    spreadRadiusKm: s.params.spreadRadiusKm,
    radiusKm: 0,
    inundationKm: 0,
    scale: 0,
  };
  switch (s.kind) {
    case "tsunami": {
      const initial = 0.5 + 9.5 * s.params.intensity;
      return { ...base, inundationKm: s.inundationKm ?? 0, scale: ((s.waveHeightM ?? 0) * s.front.arrivalProgress) / initial };
    }
    case "cyclone":
      return { ...base, radiusKm: s.radiusKm, scale: Math.min(1, (s.windSpeedKt ?? 0) / 160) };
    case "oil_spill":
      return { ...base, radiusKm: s.slickRadiusKm ?? s.radiusKm, scale: s.concentrationIndex ?? 0 };
    case "coastal_flood": {
      const peak = s.peakLevelM ?? 0;
      const ratio = peak <= 0 ? 0 : (s.waterLevelM ?? 0) / peak;
      return { ...base, inundationKm: s.params.spreadRadiusKm * ratio, scale: ratio };
    }
  }
}

function landfallPoint(g: HazardGeometry): [number, number] | null {
  if (g.coastDistanceTotalKm === null) return null;
  const [dx, dy] = headingVector(g.headingDeg);
  return [g.originXKm + dx * g.coastDistanceTotalKm, g.originYKm + dy * g.coastDistanceTotalKm];
}

/** Returns [distance km to the hazard reference point, exposure 0-1]. */
export function exposureFor(g: HazardGeometry, xKm: number, yKm: number, shore: ShoreParams = DEFAULT_SHORE): [number, number] {
  const dist = Math.hypot(xKm - g.positionXKm, yKm - g.positionYKm);
  switch (g.kind) {
    case "tsunami": {
      if (!g.arrived || landfallPoint(g) === null || g.inundationKm <= 0) return [dist, 0];
      const depth = inlandDepthKm(xKm, yKm, shore);
      if (depth < -0.5 || depth > g.inundationKm) return [dist, 0];
      const halfWidth = Math.max(5, g.traveledKm * Math.tan(TSUNAMI_HALF_ANGLE_RAD));
      const lateral = lateralOffsetKm(xKm, yKm, g.originXKm, g.originYKm, g.headingDeg);
      if (lateral > halfWidth) return [dist, 0];
      const depthFactor = 1 - Math.max(0, depth) / g.inundationKm;
      const lateralFactor = 1 - 0.5 * (lateral / halfWidth);
      return [dist, clamp01(g.scale * depthFactor * lateralFactor)];
    }
    case "cyclone": {
      if (g.radiusKm <= 0 || dist > g.radiusKm) return [dist, 0];
      return [dist, clamp01(g.scale * Math.pow(1 - dist / g.radiusKm, 0.7))];
    }
    case "oil_spill": {
      if (inlandDepthKm(xKm, yKm, shore) > COASTAL_STRUCTURE_MAX_SHORE_KM) return [dist, 0];
      const reach = g.radiusKm + OIL_FRINGE_KM;
      if (dist > reach) return [dist, 0];
      return [dist, clamp01(g.scale * (1 - dist / reach))];
    }
    case "coastal_flood": {
      if (!g.arrived || landfallPoint(g) === null || g.inundationKm <= 0) return [dist, 0];
      const depth = inlandDepthKm(xKm, yKm, shore);
      if (depth < -0.5 || depth > g.inundationKm) return [dist, 0];
      const lateralLimit = FLOOD_LATERAL_BASE_KM + g.spreadRadiusKm;
      const lateral = lateralOffsetKm(xKm, yKm, g.originXKm, g.originYKm, g.headingDeg);
      if (lateral > lateralLimit) return [dist, 0];
      const depthFactor = 1 - Math.max(0, depth) / g.inundationKm;
      const lateralFactor = 1 - 0.4 * (lateral / lateralLimit);
      return [dist, clamp01(g.scale * depthFactor * lateralFactor)];
    }
  }
}

export function assessStructures(structures: StructureConfig[], geometry: HazardGeometry, shore: ShoreParams = DEFAULT_SHORE): StructureImpact[] {
  const impacts: StructureImpact[] = [];
  for (const s of structures) {
    if (s.enabled === false) continue;
    const [distance, exposure] = exposureFor(geometry, s.x_km, s.y_km, shore);
    impacts.push({ structure_id: s.id, structure_type: s.type, name: s.name, distance_km: distance, exposure, status: statusFor(exposure) });
  }
  return impacts;
}
