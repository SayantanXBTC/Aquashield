import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScenarioBuilderPage } from "../components/ScenarioBuilderPage";
import { scenarioApi } from "../api/scenarioApi";
import {
  DISASTER_FIELD_SPECS,
  DISASTER_TYPES,
  DISASTER_TYPE_DEFAULTS,
  DISASTER_TYPE_DESCRIPTIONS,
  DISASTER_TYPE_LABELS,
} from "../disasterFieldSpecs";

vi.mock("../api/scenarioApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  scenarioApi: {
    createScenario: vi.fn(),
  },
}));

function selectDisasterType(type: string) {
  fireEvent.change(screen.getByLabelText(/disaster type/i), { target: { value: type } });
}

describe("ScenarioForm — complete disaster catalog (Prompt 9.1)", () => {
  beforeEach(() => {
    vi.mocked(scenarioApi.createScenario).mockReset();
  });

  it("lists all 9 disaster types in the selector with their labels", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    const select = screen.getByLabelText(/disaster type/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);

    expect(optionValues.sort()).toEqual([...DISASTER_TYPES].sort());
    for (const type of DISASTER_TYPES) {
      expect(screen.getByRole("option", { name: DISASTER_TYPE_LABELS[type] })).toBeInTheDocument();
    }
  });

  it.each(DISASTER_TYPES)("renders %s's parameter fields when selected", (type) => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    selectDisasterType(type);

    for (const field of DISASTER_FIELD_SPECS[type]) {
      // Exact label match — several types have multiple fields sharing a
      // first word (e.g. oil_spill's "Wind speed (kt)" / "Wind direction
      // (°)"), so a partial/regex match would be ambiguous.
      expect(screen.getByLabelText(field.label)).toBeInTheDocument();
    }
  });

  it.each(DISASTER_TYPES)("shows %s's one-line description under the selector", (type) => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    selectDisasterType(type);
    expect(screen.getByText(DISASTER_TYPE_DESCRIPTIONS[type])).toBeInTheDocument();
  });

  it("clears fields that don't apply to the newly selected disaster type (no stale values leak across a type change)", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    // flood is the default type
    fireEvent.change(screen.getByLabelText(/rainfall/i), { target: { value: "999" } });
    expect((screen.getByLabelText(/rainfall/i) as HTMLInputElement).value).toBe("999");

    selectDisasterType("tsunami");
    expect(screen.queryByLabelText(/rainfall/i)).not.toBeInTheDocument();

    // Switching back to flood must not resurrect the old rainfall value —
    // resetConfigForDisasterType drops it rather than only hiding the field.
    selectDisasterType("flood");
    expect((screen.getByLabelText(/rainfall/i) as HTMLInputElement).value).toBe("");
  });

  it("renders unit labels for numeric fields", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    // flood defaults
    expect(screen.getByText(/rainfall \(mm \/ 24h\)/i)).toBeInTheDocument();
    expect(screen.getByText(/river level \(m\)/i)).toBeInTheDocument();

    selectDisasterType("cyclone");
    expect(screen.getByText(/wind speed \(kt\)/i)).toBeInTheDocument();
    expect(screen.getByText(/central pressure \(hpa\)/i)).toBeInTheDocument();
  });

  it("fills the form with that disaster type's demo template values when 'Use demo template' is clicked", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    selectDisasterType("cyclone");

    fireEvent.click(screen.getByRole("button", { name: /use demo template/i }));

    const defaults = DISASTER_TYPE_DEFAULTS.cyclone;
    expect((screen.getByLabelText(/wind speed/i) as HTMLInputElement).value).toBe(defaults.wind_speed_kt);
    expect((screen.getByLabelText(/central pressure/i) as HTMLInputElement).value).toBe(
      defaults.central_pressure_hpa,
    );
    expect((screen.getByLabelText(/radius/i) as HTMLInputElement).value).toBe(defaults.radius_km);
  });

  it("shows a validation error for an out-of-range value on the cyclone type", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Test" } });
    selectDisasterType("cyclone");
    fireEvent.change(screen.getByLabelText(/central pressure/i), { target: { value: "1500" } });

    fireEvent.click(screen.getByRole("button", { name: /create scenario/i }));

    expect(screen.getByText(/central pressure.*must be at most 1050/i)).toBeInTheDocument();
    expect(scenarioApi.createScenario).not.toHaveBeenCalled();
  });

  it("shows a validation error for an out-of-range value on the tsunami type", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Test" } });
    selectDisasterType("tsunami");
    fireEvent.change(screen.getByLabelText(/magnitude/i), { target: { value: "25" } });

    fireEvent.click(screen.getByRole("button", { name: /create scenario/i }));

    expect(screen.getByText(/magnitude.*must be at most 10/i)).toBeInTheDocument();
    expect(scenarioApi.createScenario).not.toHaveBeenCalled();
  });
});
