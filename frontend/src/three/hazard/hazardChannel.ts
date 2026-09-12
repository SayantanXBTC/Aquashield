/**
 * A tiny mutable channel between the active disaster visualizer and the
 * water surface. The visualizer writes the current hazard's shape here every
 * frame (in scene units); WaterSurface copies it into its shader uniforms
 * every frame. No React state is involved — this runs at frame rate.
 *
 * Every field is a VISUAL quantity derived in the visualizer from a
 * `HazardSnapshot` (src/propagation/hazards.ts). The water shader only
 * reads it; nothing here flows back into simulation or analysis.
 */
export const HAZARD_KIND_NONE = 0;
export const HAZARD_KIND_TSUNAMI = 1;
export const HAZARD_KIND_OIL = 2;
export const HAZARD_KIND_CYCLONE = 3;
export const HAZARD_KIND_FLOOD = 4;

export interface HazardChannel {
  kind: number;
  /** Where the hazard started (scene x/z). */
  originX: number;
  originZ: number;
  /** Where its centre/front is now (scene x/z). */
  posX: number;
  posZ: number;
  /** Scene-units hazard radius (slick, wind field, inundation reach). */
  radius: number;
  /** Tsunami wave-front distance from origin, scene units. */
  front: number;
  /** 0-1 intensity driver. */
  intensity: number;
  /** Scene-space heading angle (radians), measured from +x toward +z. */
  headingRad: number;
  /** Flood: how far inland (km) the water currently extends past the shore. */
  inundationKm: number;
  /** Flood: current water level (m) — lifts the flooded water surface. */
  waterLevelM: number;
  /** Tsunami: visual crest height (scene units). */
  waveHeight: number;
  /** Flood: half-width (km) of the coast stretch that floods, either side
   * of the landfall line — mirrors structures.py FLOOD_LATERAL_BASE_KM + spread. */
  lateralKm: number;
}

export const hazardChannel: HazardChannel = {
  kind: HAZARD_KIND_NONE,
  originX: 0,
  originZ: 0,
  posX: 0,
  posZ: 0,
  radius: 0,
  front: 0,
  intensity: 0,
  headingRad: 0,
  inundationKm: 0,
  waterLevelM: 0,
  waveHeight: 0,
  lateralKm: 0,
};

export function clearHazardChannel(): void {
  hazardChannel.kind = HAZARD_KIND_NONE;
  hazardChannel.radius = 0;
  hazardChannel.front = 0;
  hazardChannel.intensity = 0;
  hazardChannel.inundationKm = 0;
  hazardChannel.waterLevelM = 0;
  hazardChannel.waveHeight = 0;
  hazardChannel.lateralKm = 0;
}
