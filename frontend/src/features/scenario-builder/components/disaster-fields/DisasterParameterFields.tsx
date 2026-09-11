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
 * values are discarded by the caller (see formState.resetConfigForDisasterType).
 * Styled with the AQUASHIELD design tokens (frontend/src/styles/tokens.css)
 * to match the Command Center's visual language (Prompt 9.1 §C). */
export function DisasterParameterFields({
  disasterType,
  values,
  errors,
  onChange,
}: DisasterParameterFieldsProps) {
  const fields = DISASTER_FIELD_SPECS[disasterType];

  if (fields.length === 0) {
    return <p className="text-ink-faint text-sm">No configurable parameters for this disaster type yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const inputId = `disaster-field-${field.key}`;
        const errorId = `${inputId}-error`;
        const error = errors[`config.${field.key}`];
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-ink-soft text-xs font-medium tracking-wide">
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
              className="bg-surface border-hairline-strong text-ink focus-visible:ring-accent-strong rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:outline-none"
            />
            {error && (
              <p id={errorId} className="text-status-critical text-xs">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
