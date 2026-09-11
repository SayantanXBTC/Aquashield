import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/features/scenario-builder/api/scenarioApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  scenarioApi: {
    getScenarios: vi.fn(),
    getScenario: vi.fn(),
    getRuns: vi.fn(),
    createRun: vi.fn(),
  },
}));

vi.mock("../api/simulationApi", () => ({
  simulationApi: {
    getRun: vi.fn(),
    executeRun: vi.fn(),
    getTimeline: vi.fn(),
  },
}));

// The 3D viewport needs a real WebGL context this test environment can't
// provide — isolate the data-flow behavior this test actually targets from
// that rendering concern (see docs/development/command-center.md "Testing").
vi.mock("../components/CommandCenterViewport", () => ({
  CommandCenterViewport: () => <div data-testid="viewport-stub" />,
}));

import { scenarioApi } from "@/features/scenario-builder/api/scenarioApi";
import { simulationApi } from "../api/simulationApi";
import { CommandCenterPage } from "../CommandCenterPage";

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

const SCENARIO_DETAIL = {
  ...SCENARIO_LIST_ITEM,
  description: null,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  current_version: {
    id: "v1",
    scenario_id: "s1",
    version_number: 1,
    label: "Initial",
    scenario_config: {},
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  version_count: 1,
};

const PENDING_RUN = {
  id: "run1",
  scenario_version_id: "v1",
  status: "pending" as const,
  started_at: null,
  completed_at: null,
  duration_seconds: null,
  timestep_config: {},
  model_identifier: null,
  error_message: null,
  created_at: "2026-01-01T00:00:00Z",
};

function mockScenariosResolved() {
  vi.mocked(scenarioApi.getScenarios).mockResolvedValue({
    items: [SCENARIO_LIST_ITEM],
    total: 1,
    limit: 50,
    offset: 0,
  });
  vi.mocked(scenarioApi.getScenario).mockResolvedValue(SCENARIO_DETAIL);
  vi.mocked(scenarioApi.getRuns).mockResolvedValue([PENDING_RUN]);
  vi.mocked(simulationApi.getRun).mockResolvedValue(PENDING_RUN);
}

describe("CommandCenterPage", () => {
  beforeEach(() => {
    vi.mocked(scenarioApi.getScenarios).mockReset();
    vi.mocked(scenarioApi.getScenario).mockReset();
    vi.mocked(scenarioApi.getRuns).mockReset();
    vi.mocked(scenarioApi.createRun).mockReset();
    vi.mocked(simulationApi.getRun).mockReset();
    vi.mocked(simulationApi.executeRun).mockReset();
    vi.mocked(simulationApi.getTimeline).mockReset();
  });

  it("loads the scenario, its pending run, and renders the viewport", async () => {
    mockScenariosResolved();
    render(<CommandCenterPage />);

    expect(await screen.findByText("Test Flood Scenario")).toBeInTheDocument();
    // Both the header and the Simulation panel show the run status —
    // assert at least one, rather than assuming a single match.
    await waitFor(() => expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0));
    expect(screen.getByTestId("viewport-stub")).toBeInTheDocument();
  });

  it("shows an actionable error state when scenarios fail to load", async () => {
    vi.mocked(scenarioApi.getScenarios).mockRejectedValue(new Error("network down"));
    render(<CommandCenterPage />);

    expect(await screen.findByText(/scenarios unavailable/i)).toBeInTheDocument();
  });

  it("shows an empty state when a scenario has no simulation runs", async () => {
    vi.mocked(scenarioApi.getScenarios).mockResolvedValue({
      items: [SCENARIO_LIST_ITEM],
      total: 1,
      limit: 50,
      offset: 0,
    });
    vi.mocked(scenarioApi.getScenario).mockResolvedValue(SCENARIO_DETAIL);
    vi.mocked(scenarioApi.getRuns).mockResolvedValue([]);

    render(<CommandCenterPage />);

    expect(await screen.findByText(/no simulation run exists/i)).toBeInTheDocument();
  });

  it("executes a pending run and surfaces its completed timeline", async () => {
    mockScenariosResolved();
    const completedRun = { ...PENDING_RUN, status: "completed" as const, model_identifier: "flood-demo-v1" };
    vi.mocked(simulationApi.executeRun).mockResolvedValue(completedRun);
    vi.mocked(simulationApi.getTimeline).mockResolvedValue({
      simulation_run_id: "run1",
      frame_count: 1,
      frames: [
        {
          simulation_run_id: "run1",
          timestep: 0,
          simulation_time: "2026-01-01T00:00:00Z",
          state: {
            simulation_run_id: "run1",
            timestep: 0,
            disaster_type: "flood",
            environmental_state: {},
            hazard_state: { water_level_m: 1.5, affected_radius_km: 4 },
            affected_area: null,
            risk_state: {},
            infrastructure_impacts: [],
            metadata: {},
          },
          is_key_event: true,
        },
      ],
    });

    const user = userEvent.setup();
    render(<CommandCenterPage />);

    const executeButton = await screen.findByRole("button", { name: /^execute$/i });
    await waitFor(() => expect(executeButton).toBeEnabled());
    await user.click(executeButton);

    await waitFor(() => expect(simulationApi.executeRun).toHaveBeenCalledWith("run1"));
    expect(await screen.findByText(/water level 1\.50 m/i)).toBeInTheDocument();
  });

  it("shows a deliberate awaiting-playback-data state for a completed run with no frames", async () => {
    mockScenariosResolved();
    const completedRun = { ...PENDING_RUN, status: "completed" as const, model_identifier: "demo-placeholder-v0" };
    vi.mocked(simulationApi.executeRun).mockResolvedValue(completedRun);
    vi.mocked(simulationApi.getTimeline).mockResolvedValue({
      simulation_run_id: "run1",
      frame_count: 0,
      frames: [],
    });

    const user = userEvent.setup();
    render(<CommandCenterPage />);

    const executeButton = await screen.findByRole("button", { name: /^execute$/i });
    await waitFor(() => expect(executeButton).toBeEnabled());
    await user.click(executeButton);

    // Not the old bare "Timeline data unavailable" — a deliberate state that
    // says what's actually happening (Prompt 8.1 §16).
    expect(await screen.findByText(/awaiting playback data/i)).toBeInTheDocument();
    expect(screen.queryByText(/^timeline data unavailable$/i)).not.toBeInTheDocument();
  });
});
