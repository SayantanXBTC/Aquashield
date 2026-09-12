import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunSelector } from "../components/RunSelector";
import type { SimulationRun } from "../types";

function makeRun(overrides: Partial<SimulationRun> & { id: string }): SimulationRun {
  return {
    scenario_version_id: "v1",
    status: "completed",
    started_at: null,
    completed_at: null,
    duration_seconds: null,
    timestep_config: {},
    model_identifier: null,
    error_message: null,
    created_at: "2026-09-12T05:16:35Z",
    frame_count: 25,
    ...overrides,
  };
}

describe("RunSelector", () => {
  it("renders nothing when there are no runs", () => {
    const { container } = render(
      <RunSelector runs={[]} selectedRunId={null} onSelectRun={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows real per-run status and frame count", () => {
    const runs = [
      makeRun({ id: "run-completed", status: "completed", frame_count: 25 }),
      makeRun({ id: "run-pending", status: "pending", frame_count: null }),
    ];
    render(<RunSelector runs={runs} selectedRunId="run-completed" onSelectRun={vi.fn()} />);

    const select = screen.getByRole("combobox", { name: /simulation run/i });
    expect(select).toHaveValue("run-completed");
    expect(screen.getByText(/COMPLETED · 25 frames/)).toBeInTheDocument();
    expect(screen.getByText(/PENDING · No playback data available/)).toBeInTheDocument();
  });

  it("calls onSelectRun with the chosen run's id", async () => {
    const runs = [
      makeRun({ id: "run-a" }),
      makeRun({ id: "run-b", status: "pending", frame_count: null }),
    ];
    const onSelectRun = vi.fn();
    const user = userEvent.setup();
    render(<RunSelector runs={runs} selectedRunId="run-a" onSelectRun={onSelectRun} />);

    await user.selectOptions(screen.getByRole("combobox", { name: /simulation run/i }), "run-b");

    expect(onSelectRun).toHaveBeenCalledWith("run-b");
  });
});
