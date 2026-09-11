import { DISASTER_FIELD_SPECS } from "../../disasterFieldSpecs";
import type { FormErrors } from "../../validation";
import type { DisasterType } from "../../types";

interface DisasterParameterFieldsProps {
  disasterType: DisasterType;
  values: Record<string, string>;
  errors: FormErrors;
  onChange: (key: string, value: string) => void;
}

/** Renders the field group for the selected disaster type — switching
 * disasterType swaps this component's fields entirely (§27); dropped fields'
 * values are discarded by the caller (see formState.resetConfigForDisasterType). */
export function DisasterParameterFields({
  disasterType,
  values,
  errors,
  onChange,
}: DisasterParameterFieldsProps) {
  const fields = DISASTER_FIELD_SPECS[disasterType];

  if (fields.length === 0) {
    return <p className="text-sm text-slate-500">No configurable parameters for this disaster type yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const inputId = `disaster-field-${field.key}`;
        const errorId = `${inputId}-error`;
        const error = errors[`config.${field.key}`];
        return (
          <div key={field.key} className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm text-slate-300">
              {field.label}
            </label>
            <input
              id={inputId}
              type={field.type === "number" ? "number" : "text"}
              min={field.min}
              max={field.max}
              step={field.step ?? (field.type === "number" ? "any" : undefined)}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {error && (
              <p id={errorId} className="text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
