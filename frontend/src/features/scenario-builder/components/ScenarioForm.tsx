import { DISASTER_TYPES, DISASTER_TYPE_LABELS } from "../disasterFieldSpecs";
import type { ScenarioFormState } from "../formState";
import type { FormErrors } from "../validation";
import type { DisasterType } from "../types";
import { DisasterParameterFields } from "./disaster-fields/DisasterParameterFields";
import { FormField } from "./FormField";

interface ScenarioFormProps {
  form: ScenarioFormState;
  errors: FormErrors;
  saving: boolean;
  submitLabel: string;
  onFieldChange: <K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) => void;
  onDisasterTypeChange: (disasterType: DisasterType) => void;
  onConfigFieldChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

export function ScenarioForm({
  form,
  errors,
  saving,
  submitLabel,
  onFieldChange,
  onDisasterTypeChange,
  onConfigFieldChange,
  onSubmit,
  onCancel,
}: ScenarioFormProps) {
  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section aria-labelledby="section-basic-info" className="flex flex-col gap-4">
        <h3 id="section-basic-info" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Basic Information
        </h3>
        <FormField
          id="scenario-name"
          label="Scenario name"
          value={form.name}
          onChange={(v) => onFieldChange("name", v)}
          error={errors.name}
          required
          placeholder="e.g. Bay of Bengal Tsunami"
        />
        <FormField
          id="scenario-description"
          label="Description"
          as="textarea"
          value={form.description}
          onChange={(v) => onFieldChange("description", v)}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="scenario-disaster-type" className="text-sm text-slate-300">
            Disaster type <span aria-hidden="true">*</span>
          </label>
          <select
            id="scenario-disaster-type"
            value={form.disasterType}
            onChange={(e) => onDisasterTypeChange(e.target.value as DisasterType)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {DISASTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {DISASTER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-labelledby="section-location" className="flex flex-col gap-4">
        <h3 id="section-location" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Location
        </h3>
        <FormField
          id="scenario-location-name"
          label="Location name"
          value={form.locationName}
          onChange={(v) => onFieldChange("locationName", v)}
          placeholder="e.g. Arabian Sea"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="scenario-latitude"
            label="Latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            value={form.latitude}
            onChange={(v) => onFieldChange("latitude", v)}
            error={errors.latitude}
          />
          <FormField
            id="scenario-longitude"
            label="Longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            value={form.longitude}
            onChange={(v) => onFieldChange("longitude", v)}
            error={errors.longitude}
          />
        </div>
      </section>

      <section aria-labelledby="section-time" className="flex flex-col gap-4">
        <h3 id="section-time" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Time
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="scenario-start-time"
            label="Start time"
            type="datetime-local"
            value={form.startTime}
            onChange={(v) => onFieldChange("startTime", v)}
          />
          <FormField
            id="scenario-duration"
            label="Duration (hours)"
            type="number"
            min={0}
            step="any"
            value={form.durationHours}
            onChange={(v) => onFieldChange("durationHours", v)}
            error={errors.durationHours}
          />
        </div>
      </section>

      <section aria-labelledby="section-parameters" className="flex flex-col gap-4">
        <h3 id="section-parameters" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Disaster Parameters — {DISASTER_TYPE_LABELS[form.disasterType]}
        </h3>
        <DisasterParameterFields
          disasterType={form.disasterType}
          values={form.config}
          errors={errors}
          onChange={onConfigFieldChange}
        />
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
