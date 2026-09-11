import { useState } from "react";
import { ApiError, scenarioApi } from "../api/scenarioApi";
import { formStateToCreateRequest } from "../formState";
import { useScenarioForm } from "../hooks/useScenarioForm";
import { ScenarioForm } from "./ScenarioForm";

interface ScenarioBuilderPageProps {
  onCreated: (scenarioId: string) => void;
  onCancel: () => void;
}

export function ScenarioBuilderPage({ onCreated, onCancel }: ScenarioBuilderPageProps) {
  const { form, errors, setField, setDisasterType, setConfigField, applyDemoTemplate, validate } =
    useScenarioForm();
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const scenario = await scenarioApi.createScenario(formStateToCreateRequest(form));
      onCreated(scenario.id);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to create scenario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-slate-100">Create Scenario</h2>
      {submitError && <p className="text-sm text-red-400">{submitError}</p>}
      <ScenarioForm
        form={form}
        errors={errors}
        saving={saving}
        submitLabel="Create Scenario"
        onFieldChange={setField}
        onDisasterTypeChange={setDisasterType}
        onConfigFieldChange={setConfigField}
        onApplyDemoTemplate={applyDemoTemplate}
        onSubmit={handleSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}
