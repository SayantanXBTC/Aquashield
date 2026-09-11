import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScenarioBuilderPage } from "../components/ScenarioBuilderPage";
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
    createScenario: vi.fn(),
  },
}));

describe("ScenarioBuilderPage", () => {
  beforeEach(() => {
    vi.mocked(scenarioApi.createScenario).mockReset();
  });

  it("renders the basic information, location, time, and parameter sections", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/disaster type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    // flood is the default disaster type
    expect(screen.getByLabelText(/rainfall/i)).toBeInTheDocument();
  });

  it("changes the visible parameter fields when the disaster type changes", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/rainfall/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/magnitude/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/disaster type/i), { target: { value: "tsunami" } });

    expect(screen.queryByLabelText(/rainfall/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/magnitude/i)).toBeInTheDocument();
  });

  it("shows a validation error and does not call the API when name is empty", () => {
    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /create scenario/i }));

    expect(screen.getByText(/scenario name is required/i)).toBeInTheDocument();
    expect(scenarioApi.createScenario).not.toHaveBeenCalled();
  });

  it("creates a scenario and calls onCreated on success", async () => {
    vi.mocked(scenarioApi.createScenario).mockResolvedValue({
      id: "abc-123",
      name: "Test Scenario",
      description: null,
      disaster_type: "flood",
      status: "draft",
      location_name: null,
      latitude: null,
      longitude: null,
      created_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      current_version: null,
      version_count: 1,
    });
    const onCreated = vi.fn();

    render(<ScenarioBuilderPage onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Test Scenario" } });
    fireEvent.click(screen.getByRole("button", { name: /create scenario/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("abc-123"));
  });

  it("shows an error message when the API call fails", async () => {
    vi.mocked(scenarioApi.createScenario).mockRejectedValue(new Error("Unsupported disaster type"));

    render(<ScenarioBuilderPage onCreated={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Test Scenario" } });
    fireEvent.click(screen.getByRole("button", { name: /create scenario/i }));

    expect(await screen.findByText(/failed to create scenario/i)).toBeInTheDocument();
  });
});
