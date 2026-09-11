import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SimulationRunsPanel } from "../components/SimulationRunsPanel";
import { scenarioApi } from "../api/scenarioApi";

vi.mock("../api/scenarioApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  scenarioApi: {
    createRun: vi.fn(),
  },
}));

describe("SimulationRunsPanel", () => {
  beforeEach(() => {
    vi.mocked(scenarioApi.createRun).mockReset();
  });

  it("creates a simulation run and notifies the parent, without faking a result", async () => {
    vi.mocked(scenarioApi.createRun).mockResolvedValue({
      id: "run-1",
      scenario_version_id: "v1",
      status: "pending",
      started_at: null,
      completed_at: null,
      duration_seconds: null,
      timestep_config: {},
      model_identifier: null,
      error_message: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    const onRunCreated = vi.fn();

    render(<SimulationRunsPanel scenarioId="s1" runs={[]} onRunCreated={onRunCreated} />);
    fireEvent.click(screen.getByRole("button", { name: /create simulation run/i }));

    await waitFor(() => expect(scenarioApi.createRun).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(onRunCreated).toHaveBeenCalled());
  });

  it("shows existing runs with the 'not yet executed' notice, never a fake result", () => {
    render(
      <SimulationRunsPanel
        scenarioId="s1"
        runs={[
          {
            id: "run-1",
            scenario_version_id: "v1",
            status: "pending",
            started_at: null,
            completed_at: null,
            duration_seconds: null,
            timestep_config: {},
            model_identifier: null,
            error_message: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ]}
        onRunCreated={vi.fn()}
      />,
    );

    expect(screen.getByText(/not yet executed/i)).toBeInTheDocument();
    expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
  });
});
