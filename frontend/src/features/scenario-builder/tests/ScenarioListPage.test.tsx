import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScenarioListPage } from "../components/ScenarioListPage";
import { scenarioApi } from "../api/scenarioApi";
import type { ScenarioListItem } from "../types";

vi.mock("../api/scenarioApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  scenarioApi: {
    getScenarios: vi.fn(),
    duplicateScenario: vi.fn(),
    archiveScenario: vi.fn(),
    createRun: vi.fn(),
  },
}));

const SAMPLE_ITEM: ScenarioListItem = {
  id: "s1",
  name: "Demo Flood",
  disaster_type: "flood",
  status: "ready",
  location_name: "Test City",
  latitude: 1,
  longitude: 2,
  current_version_number: 1,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("ScenarioListPage", () => {
  beforeEach(() => {
    vi.mocked(scenarioApi.getScenarios).mockReset();
    vi.mocked(scenarioApi.duplicateScenario).mockReset();
  });

  it("renders scenarios returned by the API", async () => {
    vi.mocked(scenarioApi.getScenarios).mockResolvedValue({
      items: [SAMPLE_ITEM],
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(<ScenarioListPage onCreateNew={vi.fn()} onView={vi.fn()} />);

    expect(await screen.findByText("Demo Flood")).toBeInTheDocument();
  });

  it("calls duplicateScenario when the Duplicate action is clicked", async () => {
    vi.mocked(scenarioApi.getScenarios).mockResolvedValue({
      items: [SAMPLE_ITEM],
      total: 1,
      limit: 20,
      offset: 0,
    });
    vi.mocked(scenarioApi.duplicateScenario).mockResolvedValue({
      ...SAMPLE_ITEM,
      id: "s2",
    } as never);

    render(<ScenarioListPage onCreateNew={vi.fn()} onView={vi.fn()} />);
    await screen.findByText("Demo Flood");

    fireEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    await waitFor(() => expect(scenarioApi.duplicateScenario).toHaveBeenCalledWith("s1"));
  });
});
