import { useState } from "react";
import { ApiError, scenarioApi } from "../api/scenarioApi";
import { DISASTER_TYPE_LABELS } from "../disasterFieldSpecs";
import { formStateToUpdateRequest, scenarioToFormState } from "../formState";
import { useScenarioDetail } from "../hooks/useScenarioDetail";
import { useScenarioForm } from "../hooks/useScenarioForm";
import { ScenarioForm } from "./ScenarioForm";
import { SimulationRunsPanel } from "./SimulationRunsPanel";
import { StatusBadge } from "./StatusBadge";
import { VersionHistory } from "./VersionHistory";

interface ScenarioDetailPageProps {
  scenarioId: string;
  onBack: () => void;
  onDuplicated: (scenarioId: string) => void;
}

export function ScenarioDetailPage({ scenarioId, onBack, onDuplicated }: ScenarioDetailPageProps) {
  const { scenario, versions, runs, status, error, refetch } = useScenarioDetail(scenarioId);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { form, errors, setField, setDisasterType, setConfigField, applyDemoTemplate, validate, reset } =
    useScenarioForm();

  function startEditing() {
    if (!scenario) return;
    reset(scenarioToFormState(scenario));
    setEditing(true);
  }

  async function handleSave() {
    if (!scenario || !validate()) return;
    setSaving(true);
    setActionError(null);
    try {
      await scenarioApi.updateScenario(scenario.id, formStateToUpdateRequest(form, scenario));
      setEditing(false);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update scenario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!scenario) return;
    setActionError(null);
    try {
      const duplicate = await scenarioApi.duplicateScenario(scenario.id);
      onDuplicated(duplicate.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to duplicate scenario.");
    }
  }

  async function handleArchive() {
    if (!scenario) return;
    setActionError(null);
    try {
      await scenarioApi.archiveScenario(scenario.id);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to archive scenario.");
    }
  }

  if (status === "loading" || status === "idle") {
    return <p className="text-sm text-slate-400">Loading scenario...</p>;
  }
  if (status === "error" || !scenario) {
    return <p className="text-sm text-red-400">{error ?? "Scenario not found."}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="text-sm text-sky-400 hover:underline">
          ← Back to scenarios
        </button>
      </div>

      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      {editing ? (
        <ScenarioForm
          form={form}
          errors={errors}
          saving={saving}
          submitLabel="Save Changes"
          onFieldChange={setField}
          onDisasterTypeChange={setDisasterType}
          onConfigFieldChange={setConfigField}
          onApplyDemoTemplate={applyDemoTemplate}
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-100">{scenario.name}</h2>
              <StatusBadge status={scenario.status} />
            </div>
            {scenario.description && <p className="text-slate-400">{scenario.description}</p>}
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Disaster type</dt>
                <dd className="text-slate-200">{DISASTER_TYPE_LABELS[scenario.disaster_type]}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Location</dt>
                <dd className="text-slate-200">
                  {scenario.location_name ?? "—"}
                  {scenario.latitude != null && scenario.longitude != null
                    ? ` (${scenario.latitude}, ${scenario.longitude})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Current version</dt>
                <dd className="text-slate-200">
                  {scenario.current_version ? `v${scenario.current_version.version_number}` : "—"} of{" "}
                  {scenario.version_count}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-200">{new Date(scenario.updated_at).toLocaleString()}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={startEditing}
                className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                Duplicate
              </button>
              {scenario.status !== "archived" && (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="rounded border border-red-900 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Archive
                </button>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Current Configuration</h3>
            <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-300">
              {JSON.stringify(scenario.current_version?.scenario_config ?? {}, null, 2)}
            </pre>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Version History</h3>
            <VersionHistory
              versions={versions}
              currentVersionNumber={scenario.current_version?.version_number ?? null}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Simulation Runs</h3>
            <SimulationRunsPanel scenarioId={scenario.id} runs={runs} onRunCreated={refetch} />
          </section>
        </>
      )}
    </div>
  );
}
