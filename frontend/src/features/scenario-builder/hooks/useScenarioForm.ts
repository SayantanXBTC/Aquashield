import { useCallback, useState } from "react";
import { DISASTER_TYPE_DEFAULTS } from "../disasterFieldSpecs";
import { resetConfigForDisasterType, EMPTY_FORM_STATE, type ScenarioFormState } from "../formState";
import { validateScenarioForm, type FormErrors } from "../validation";
import type { DisasterType } from "../types";

interface UseScenarioFormResult {
  form: ScenarioFormState;
  errors: FormErrors;
  setField: <K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) => void;
  setDisasterType: (disasterType: DisasterType) => void;
  setConfigField: (key: string, value: string) => void;
  applyDemoTemplate: () => void;
  validate: () => boolean;
  reset: (next?: ScenarioFormState) => void;
}

export function useScenarioForm(initial: ScenarioFormState = EMPTY_FORM_STATE): UseScenarioFormResult {
  const [form, setForm] = useState<ScenarioFormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const setField = useCallback(
    <K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setDisasterType = useCallback((disasterType: DisasterType) => {
    setForm((prev) => ({
      ...prev,
      disasterType,
      config: resetConfigForDisasterType(prev.config, disasterType),
    }));
  }, []);

  const setConfigField = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, config: { ...prev.config, [key]: value } }));
  }, []);

  /** Fills `form.config` with the current disaster type's demo template
   * values (§17) — a frontend-only convenience, never a real historical
   * scenario. Replaces the config outright rather than merging, matching
   * `setDisasterType`'s "only fields this type actually has survive" rule. */
  const applyDemoTemplate = useCallback(() => {
    setForm((prev) => ({ ...prev, config: { ...DISASTER_TYPE_DEFAULTS[prev.disasterType] } }));
  }, []);

  const validate = useCallback(() => {
    const nextErrors = validateScenarioForm(form);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  const reset = useCallback((next: ScenarioFormState = EMPTY_FORM_STATE) => {
    setForm(next);
    setErrors({});
  }, []);

  return { form, errors, setField, setDisasterType, setConfigField, applyDemoTemplate, validate, reset };
}
