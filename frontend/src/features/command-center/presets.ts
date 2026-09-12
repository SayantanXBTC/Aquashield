import type { DisasterType } from "./types";
import type { HazardKind } from "@/propagation/hazards";

/**
 * The "New test" presets — generic demo disasters only. No real-world place
 * names, no coordinates: every test starts in the same synthetic shoreline
 * world with the model's own documented defaults and a sensible origin
 * offshore. The scenario_config written on creation is exactly `config`;
 * everything else is tuned inline afterwards.
 */
export interface DisasterPreset {
  id: string;
  name: string;
  disasterType: DisasterType;
  kind: HazardKind;
  blurb: string;
  config: Record<string, number>;
}

export const DISASTER_PRESETS: DisasterPreset[] = [
  {
    id: "oil-spill",
    name: "Demo Oil Spill",
    disasterType: "oil_spill",
    kind: "oil_spill",
    blurb: "Slow drifting slick, spreads and thins",
    config: { origin_x_km: 120, origin_y_km: 150, heading_deg: 95, speed_kmh: 3, intensity: 0.7, spread_radius_km: 18, dispersion_rate: 0.3, duration_hours: 12 },
  },
  {
    id: "tsunami",
    name: "Demo Tsunami",
    disasterType: "tsunami",
    kind: "tsunami",
    blurb: "Fast wavefront, sharp crest, coastal run-up",
    config: { origin_x_km: 45, origin_y_km: 140, heading_deg: 90, speed_kmh: 500, intensity: 0.6, spread_radius_km: 12, dispersion_rate: 0.3, duration_hours: 2 },
  },
  {
    id: "cyclone",
    name: "Demo Cyclone",
    disasterType: "cyclone",
    kind: "cyclone",
    blurb: "Rotating wind field tracking to landfall",
    config: { origin_x_km: 60, origin_y_km: 90, heading_deg: 60, speed_kmh: 25, intensity: 0.75, spread_radius_km: 70, dispersion_rate: 0.4, duration_hours: 10 },
  },
  {
    id: "coastal-flood",
    name: "Demo Coastal Flood",
    disasterType: "coastal_flood",
    kind: "coastal_flood",
    blurb: "Surge front, rising level, inland reach",
    config: { origin_x_km: 130, origin_y_km: 170, heading_deg: 100, speed_kmh: 40, intensity: 0.6, spread_radius_km: 10, dispersion_rate: 0.3, duration_hours: 6 },
  },
];
