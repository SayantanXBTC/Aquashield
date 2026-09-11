import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ScenarioContextPanel } from "../components/ScenarioContextPanel";

const SCENARIO_LIST_ITEM = {
  id: "s1",
  name: "Test Flood Scenario",
  disaster_type: "flood" as const,
  status: "ready" as const,
  location_name: "Test City",
  latitude: 22.5,
  longitude: 88.3,
  current_version_number: 1,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("ScenarioContextPanel — New scenario link (Prompt 9.1 §A)", () => {
  it("renders a 'New scenario' link pointing at /scenarios", () => {
    render(
      <MemoryRouter>
        <ScenarioContextPanel
          scenarios={[SCENARIO_LIST_ITEM]}
          scenariosStatus="idle"
          scenariosError={null}
          selectedScenarioId="s1"
          onSelectScenario={vi.fn()}
          scenario={null}
          scenarioStatus="idle"
          scenarioError={null}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /new scenario/i });
    expect(link).toHaveAttribute("href", "/scenarios");
  });

  it("still renders the 'New scenario' link even with no scenarios loaded yet", () => {
    render(
      <MemoryRouter>
        <ScenarioContextPanel
          scenarios={[]}
          scenariosStatus="idle"
          scenariosError={null}
          selectedScenarioId={null}
          onSelectScenario={vi.fn()}
          scenario={null}
          scenarioStatus="idle"
          scenarioError={null}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /new scenario/i })).toHaveAttribute("href", "/scenarios");
  });
});
