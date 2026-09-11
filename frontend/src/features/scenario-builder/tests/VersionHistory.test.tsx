import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionHistory } from "../components/VersionHistory";
import type { ScenarioVersion } from "../types";

const VERSIONS: ScenarioVersion[] = [
  {
    id: "v1",
    scenario_id: "s1",
    version_number: 1,
    label: "Initial version",
    scenario_config: { rainfall_mm_24h: 100 },
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "v2",
    scenario_id: "s1",
    version_number: 2,
    label: "Increased rainfall",
    scenario_config: { rainfall_mm_24h: 200 },
    notes: null,
    created_at: "2026-01-02T00:00:00Z",
  },
];

describe("VersionHistory", () => {
  it("renders every version and marks the current one", () => {
    render(<VersionHistory versions={VERSIONS} currentVersionNumber={2} />);

    expect(screen.getByText("Version 1")).toBeInTheDocument();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("renders an empty state with no versions", () => {
    render(<VersionHistory versions={[]} currentVersionNumber={null} />);
    expect(screen.getByText(/no versions yet/i)).toBeInTheDocument();
  });
});
