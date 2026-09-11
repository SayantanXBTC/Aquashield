import { CommandButton, SectionLabel } from "@/components/ui";
import { DISASTER_TYPES, DISASTER_TYPE_DESCRIPTIONS, DISASTER_TYPE_LABELS } from "../disasterFieldSpecs";
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
  onApplyDemoTemplate: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

/** The Scenario Builder's create/edit form — restyled onto the AQUASHIELD
 * design tokens and `components/ui` primitives (Prompt 9.1 §C) so it reads
 * as part of the same command-center product rather than a generic SaaS
 * form, while staying a full page (not a Command Center overlay panel). */
export function ScenarioForm({
  form,
  errors,
  saving,
  submitLabel,
  onFieldChange,
  onDisasterTypeChange,
  onConfigFieldChange,
  onApplyDemoTemplate,
  onSubmit,
  onCancel,
}: ScenarioFormProps) {
  return (
    <form
      className="flex flex-col gap-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section aria-labelledby="section-basic-info" className="flex flex-col gap-4">
        <h3 id="section-basic-info">
          <SectionLabel>Basic Information</SectionLabel>
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scenario-disaster-type" className="text-ink-soft text-xs font-medium tracking-wide">
            Disaster type <span aria-hidden="true" className="text-accent-strong">*</span>
          </label>
          <select
            id="scenario-disaster-type"
            value={form.disasterType}
            onChange={(e) => onDisasterTypeChange(e.target.value as DisasterType)}
            className="bg-surface border-hairline-strong text-ink focus-visible:ring-accent-strong rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:outline-none"
          >
            {DISASTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {DISASTER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <p id="scenario-disaster-type-description" className="text-ink-faint text-xs">
            {DISASTER_TYPE_DESCRIPTIONS[form.disasterType]}
          </p>
        </div>
      </section>

      <section aria-labelledby="section-location" className="flex flex-col gap-4">
        <h3 id="section-location">
          <SectionLabel>Location</SectionLabel>
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
        <h3 id="section-time">
          <SectionLabel>Time</SectionLabel>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="section-parameters">
            <SectionLabel>{`Disaster Parameters — ${DISASTER_TYPE_LABELS[form.disasterType]}`}</SectionLabel>
          </h3>
          <div className="flex flex-col items-end gap-0.5">
            <CommandButton type="button" onClick={onApplyDemoTemplate}>
              Use demo template
            </CommandButton>
            <span className="text-ink-faint text-[10px] tracking-wide uppercase">
              Demo template values — not a real historical event
            </span>
          </div>
        </div>
        <DisasterParameterFields
          disasterType={form.disasterType}
          values={form.config}
          errors={errors}
          onChange={onConfigFieldChange}
        />
      </section>

      <div className="flex gap-3">
        <CommandButton type="submit" tone="accent" disabled={saving} className="px-4 py-2 text-sm">
          {saving ? "Saving..." : submitLabel}
        </CommandButton>
        {onCancel && (
          <CommandButton type="button" onClick={onCancel} className="px-4 py-2 text-sm">
            Cancel
          </CommandButton>
        )}
      </div>
    </form>
  );
}
