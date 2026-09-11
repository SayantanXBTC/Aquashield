import { DISASTER_FIELD_SPECS } from "./disasterFieldSpecs";
import type { ScenarioFormState } from "./formState";

export type FormErrors = Record<string, string>;

/**
 * Client-side validation for immediate feedback. The server (§8, §28) is
 * authoritative — this only checks the same DATA VALIDITY rules the backend
 * would reject, not any scientific-model validity.
 */
export function validateScenarioForm(form: ScenarioFormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = "Scenario name is required.";
  }

  const hasLat = form.latitude !== "";
  const hasLon = form.longitude !== "";
  if (hasLat !== hasLon) {
    errors.latitude = "Latitude and longitude must be provided together.";
    errors.longitude = "Latitude and longitude must be provided together.";
  } else if (hasLat && hasLon) {
    const lat = Number(form.latitude);
    const lon = Number(form.longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = "Latitude must be a number between -90 and 90.";
    }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) {
      errors.longitude = "Longitude must be a number between -180 and 180.";
    }
  }

  if (form.durationHours !== "") {
    const duration = Number(form.durationHours);
    if (Number.isNaN(duration) || duration <= 0) {
      errors.durationHours = "Duration must be a positive number of hours.";
    }
  }

  for (const field of DISASTER_FIELD_SPECS[form.disasterType]) {
    const raw = form.config[field.key];
    if (raw === undefined || raw === "") continue;
    if (field.type === "number") {
      const value = Number(raw);
      if (Number.isNaN(value)) {
        errors[`config.${field.key}`] = `${field.label} must be a number.`;
      } else if (field.min !== undefined && value < field.min) {
        errors[`config.${field.key}`] = `${field.label} must be at least ${field.min}.`;
      } else if (field.max !== undefined && value > field.max) {
        errors[`config.${field.key}`] = `${field.label} must be at most ${field.max}.`;
      }
    }
  }

  return errors;
}

export function isFormValid(errors: FormErrors): boolean {
  return Object.keys(errors).length === 0;
}
