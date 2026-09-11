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

/**
 * A short, factual, non-scientific one-liner per disaster type — rendered as
 * helper text under the disaster-type selector (§14: keep the selector a
 * compact native `<select>`, not a card grid; the description is the only
 * addition). Mirrors the backend's app/core/disaster_catalog.py descriptions
 * by hand — same parallel-registry convention as DISASTER_FIELD_SPECS vs.
 * DISASTER_CONFIG_SCHEMAS (CLAUDE.md §25).
 */
export const DISASTER_TYPE_DESCRIPTIONS: Record<DisasterType, string> = {
  flood: "River / rainfall-driven inundation.",
  flash_flood: "Rapid-onset flooding from intense, short-duration rainfall.",
  coastal_flood: "Coastal inundation from tidal/surge-driven water rise.",
  storm_surge: "Cyclone-driven abnormal coastal water rise.",
  cyclone: "Rotating wind storm with a moving center and expanding wind field.",
  tsunami: "Wave train propagating from an offshore source toward the coast.",
  oil_spill: "Oil slick drift and weathering on open water.",
  chemical_pollution: "Pollutant plume drift and dilution on open water.",
  search_rescue: "Drifting person/vessel position and search-area growth.",
};

/**
 * "Use demo template" values (§17) — a frontend-only convenience that
 * pre-fills the same form a user would fill manually with one sensible demo
 * value set per disaster type. Deliberately NOT real historical data (the UI
 * must label it as a demo template, never imply otherwise) and deliberately
 * NOT persisted as extra database rows — CLAUDE.md's guidance here is "user
 * can create any supported type", not "the database happens to contain nine
 * template rows". Keys match DISASTER_FIELD_SPECS for the same type exactly.
 */
export const DISASTER_TYPE_DEFAULTS: Record<DisasterType, Record<string, string>> = {
  flood: {
    rainfall_mm_24h: "180",
    river_level_m: "6.2",
    water_rise_rate_m_per_hr: "0.15",
    drainage_capacity_pct: "40",
  },
  flash_flood: {
    rainfall_mm_24h: "220",
    river_level_m: "2.5",
    water_rise_rate_m_per_hr: "0.6",
    drainage_capacity_pct: "15",
  },
  coastal_flood: {
    rainfall_mm_24h: "90",
    river_level_m: "4.0",
    water_rise_rate_m_per_hr: "0.2",
    drainage_capacity_pct: "25",
  },
  storm_surge: { central_pressure_hpa: "955", wind_speed_kt: "85", radius_km: "120" },
  cyclone: { central_pressure_hpa: "930", wind_speed_kt: "110", radius_km: "150" },
  tsunami: {
    source_latitude: "-0.5",
    source_longitude: "119.0",
    magnitude: "7.5",
    initial_wave_height_m: "2.8",
    propagation_direction_deg: "90",
  },
  oil_spill: {
    spill_volume_tonnes: "500",
    oil_type: "crude",
    wind_speed_kt: "12",
    wind_direction_deg: "200",
    current_speed_kt: "1.5",
    current_direction_deg: "210",
  },
  chemical_pollution: {
    spill_volume_tonnes: "300",
    oil_type: "industrial_effluent",
    wind_speed_kt: "8",
    wind_direction_deg: "140",
    current_speed_kt: "1.0",
    current_direction_deg: "160",
  },
  search_rescue: { vessel_type: "fishing_trawler", search_radius_km: "6" },
};
