import { DISASTER_FIELD_SPECS } from "./disasterFieldSpecs";
import type { DisasterType, ScenarioCreateRequest, ScenarioDetail, ScenarioUpdateRequest } from "./types";

export interface ScenarioFormState {
  name: string;
  description: string;
  disasterType: DisasterType;
  locationName: string;
  latitude: string;
  longitude: string;
  startTime: string;
  durationHours: string;
  /** Disaster-specific field values, raw strings from inputs — keyed by FieldSpec.key. */
  config: Record<string, string>;
}

export const EMPTY_FORM_STATE: ScenarioFormState = {
  name: "",
  description: "",
  disasterType: "flood",
  locationName: "",
  latitude: "",
  longitude: "",
  startTime: "",
  durationHours: "",
  config: {},
};

/** Changing disaster type drops incompatible config values rather than
 * silently carrying them over (§27) — only fields the new type actually has
 * survive the switch. */
export function resetConfigForDisasterType(
  config: Record<string, string>,
  disasterType: DisasterType,
): Record<string, string> {
  const validKeys = new Set(DISASTER_FIELD_SPECS[disasterType].map((f) => f.key));
  return Object.fromEntries(Object.entries(config).filter(([key]) => validKeys.has(key)));
}

export function scenarioToFormState(scenario: ScenarioDetail): ScenarioFormState {
  const rawConfig = (scenario.current_version?.scenario_config ?? {}) as Record<string, unknown>;
  const config: Record<string, string> = {};
  for (const field of DISASTER_FIELD_SPECS[scenario.disaster_type]) {
    const value = rawConfig[field.key];
    if (value !== undefined && value !== null) config[field.key] = String(value);
  }
  return {
    name: scenario.name,
    description: scenario.description ?? "",
    disasterType: scenario.disaster_type,
    locationName: scenario.location_name ?? "",
    latitude: scenario.latitude != null ? String(scenario.latitude) : "",
    longitude: scenario.longitude != null ? String(scenario.longitude) : "",
    startTime: typeof rawConfig.start_time === "string" ? rawConfig.start_time : "",
    durationHours: rawConfig.duration_hours != null ? String(rawConfig.duration_hours) : "",
    config,
  };
}

export function formStateToScenarioConfig(form: ScenarioFormState): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (form.startTime) config.start_time = new Date(form.startTime).toISOString();
  if (form.durationHours) config.duration_hours = Number(form.durationHours);

  for (const field of DISASTER_FIELD_SPECS[form.disasterType]) {
    const raw = form.config[field.key];
    if (raw === undefined || raw === "") continue;
    config[field.key] = field.type === "number" ? Number(raw) : raw;
  }
  return config;
}

export function formStateToCreateRequest(form: ScenarioFormState): ScenarioCreateRequest {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    disaster_type: form.disasterType,
    location_name: form.locationName.trim() || null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
    scenario_config: formStateToScenarioConfig(form),
  };
}

/** Only includes `scenario_config` when it actually differs from the
 * scenario's current version — the backend creates a new immutable version
 * whenever scenario_config is present in an update (§14), so an unchanged
 * config must not be resent. */
export function formStateToUpdateRequest(
  form: ScenarioFormState,
  original: ScenarioDetail,
): ScenarioUpdateRequest {
  const nextConfig = formStateToScenarioConfig(form);
  const originalConfig = original.current_version?.scenario_config ?? {};
  const configChanged = JSON.stringify(nextConfig) !== JSON.stringify(originalConfig);

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    location_name: form.locationName.trim() || null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
    scenario_config: configChanged ? nextConfig : undefined,
  };
}
