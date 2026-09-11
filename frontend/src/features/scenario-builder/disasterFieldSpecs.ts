import type { DisasterType } from "./types";

export interface FieldSpec {
  key: string;
  label: string;
  type: "number" | "text";
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

const FLOOD_FIELDS: FieldSpec[] = [
  { key: "rainfall_mm_24h", label: "Rainfall (mm / 24h)", type: "number", min: 0 },
  { key: "river_level_m", label: "River level (m)", type: "number", min: 0 },
  { key: "water_rise_rate_m_per_hr", label: "Water rise rate (m/hr)", type: "number" },
  { key: "drainage_capacity_pct", label: "Drainage capacity (%)", type: "number", min: 0, max: 100 },
];

const CYCLONE_FIELDS: FieldSpec[] = [
  { key: "central_pressure_hpa", label: "Central pressure (hPa)", type: "number", min: 800, max: 1050 },
  { key: "wind_speed_kt", label: "Wind speed (kt)", type: "number", min: 0 },
  { key: "radius_km", label: "Radius (km)", type: "number", min: 0 },
];

const OIL_SPILL_FIELDS: FieldSpec[] = [
  { key: "spill_volume_tonnes", label: "Spill volume (tonnes)", type: "number", min: 0 },
  { key: "oil_type", label: "Oil type", type: "text" },
  { key: "wind_speed_kt", label: "Wind speed (kt)", type: "number", min: 0 },
  { key: "wind_direction_deg", label: "Wind direction (°)", type: "number", min: 0, max: 360 },
  { key: "current_speed_kt", label: "Current speed (kt)", type: "number", min: 0 },
  { key: "current_direction_deg", label: "Current direction (°)", type: "number", min: 0, max: 360 },
];

/**
 * Field groups shown per disaster type — drives the dynamic form (§27) and
 * client-side range validation (§28). Mirrors the disaster-specific models
 * in backend/app/schemas/scenario_config.py; a disaster type reuses another
 * type's field group where the backend does the same (flash_flood/
 * coastal_flood -> flood; storm_surge -> cyclone; chemical_pollution ->
 * oil_spill). Complex nested fields (track, spill_location,
 * incident_location, drift_conditions) aren't exposed in this basic form —
 * the scenario's own Location section already captures "where", and the API
 * still accepts them via a future richer editor.
 */
export const DISASTER_FIELD_SPECS: Record<DisasterType, FieldSpec[]> = {
  flood: FLOOD_FIELDS,
  flash_flood: FLOOD_FIELDS,
  coastal_flood: FLOOD_FIELDS,
  storm_surge: CYCLONE_FIELDS,
  cyclone: CYCLONE_FIELDS,
  tsunami: [
    { key: "source_latitude", label: "Source latitude", type: "number", min: -90, max: 90 },
    { key: "source_longitude", label: "Source longitude", type: "number", min: -180, max: 180 },
    { key: "magnitude", label: "Magnitude", type: "number", min: 0, max: 10, step: 0.1 },
    { key: "initial_wave_height_m", label: "Initial wave height (m)", type: "number", min: 0 },
    { key: "propagation_direction_deg", label: "Propagation direction (°)", type: "number", min: 0, max: 360 },
  ],
  oil_spill: OIL_SPILL_FIELDS,
  chemical_pollution: OIL_SPILL_FIELDS,
  search_rescue: [
    { key: "vessel_type", label: "Vessel type", type: "text" },
    { key: "search_radius_km", label: "Search radius (km)", type: "number", min: 0 },
  ],
};

export const DISASTER_TYPE_LABELS: Record<DisasterType, string> = {
  flood: "Flood",
  flash_flood: "Flash Flood",
  coastal_flood: "Coastal Flood",
  storm_surge: "Storm Surge",
  cyclone: "Cyclone",
  tsunami: "Tsunami",
  oil_spill: "Oil Spill",
  chemical_pollution: "Chemical Pollution",
  search_rescue: "Search & Rescue",
};

export const DISASTER_TYPES = Object.keys(DISASTER_TYPE_LABELS) as DisasterType[];
