import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { byStage, idleRoster, rosterFromBrief } from "../ai/agentRoster";
import type { AIExposureFinding, CommandBrief, StructureConfig } from "../types";
import { AgentExecutionHud } from "./AgentExecutionHud";
import { IntelligencePanel } from "./IntelligencePanel";

const STRUCTURES: StructureConfig[] = [{ id: "port-1", type: "port", name: "Harbour", x_km: 192, y_km: 150, enabled: true }];

function exposure(): AIExposureFinding {
  return {
    subject: "Harbour",
    subject_ref: "port-1",
    claim_kind: "observed_simulation_fact",
    statement: "Structure 'Harbour' (port) reports exposure status impacted — potentially exposed.",
    evidence_ids: ["E4"],
    severity_hint: "HIGH",
  };
}

function brief(frameIndex: number, exposures: AIExposureFinding[]): CommandBrief {
  return {
    scenario_id: "scn",
    simulation_run_id: "3f6b1c22-0000-0000-0000-000000000000",
    frame_index: frameIndex,
    generated_at: "2026-09-12T00:00:00Z",
    situation: `Demo scenario, frame ${frameIndex}.`,
    current_hazard: "Current frame reports phase offshore (simplified demonstration model).",
    hazard_progression: [{ statement: `Current frame ${frameIndex}: phase=offshore`, evidence_ids: ["E3"] }],
    key_exposures: exposures,
    priorities: exposures.map((e) => ({ level: e.severity_hint, subject: e.subject, rationale: "port reports exposure status impacted.", evidence_ids: ["E4"] })),
    precautions: [],
    recommended_actions: exposures.map(() => ({
      action: "Consider suspending vessel movements at Harbour.",
      priority: "HIGH" as const,
      prerequisites: ["Harbour master concurrence"],
      risks: ["Economic disruption"],
      resources: "RESOURCE_DATA_UNAVAILABLE",
      requires_human_approval: true as const,
      evidence_ids: ["E4"],
    })),
    resource_status: "RESOURCE_DATA_UNAVAILABLE",
    agent_runs: [
      { agent: "context_collector", label: "Context Collector", status: "COMPLETED", summary: "8 evidence item(s)", duration_ms: 2 },
      { agent: "hazard_agent", label: "Hazard Analyst", status: "COMPLETED", summary: "trend approaching", duration_ms: 1 },
      { agent: "damage_agent", label: "Damage / Impact Analyst", status: "FAILED", summary: "provider outage", duration_ms: 1 },
      { agent: "resource_agent", label: "Resource Agent", status: "UNAVAILABLE", summary: "no inventory", duration_ms: 0 },
    ],
    evidence_references: [],
    data_limitations: [{ code: "NOT_CONFIGURED", subject: "regulatory_evidence", detail: "Evidence retriever not configured." }],
    uncertainties: [],
    human_review_required: true,
    validation_notes: [],
    disclaimer: "Generated from SIMPLIFIED DEMONSTRATION MODEL output.",
  };
}

describe("IntelligencePanel", () => {
  it("shows an explicit empty state before any analysis, never a fabricated one", () => {
    render(<IntelligencePanel brief={null} structures={STRUCTURES} frameIndex={0} briefIsBehind={false} status="idle" provider={null} />);
    expect(screen.getByText("No analysis yet")).toBeInTheDocument();
    expect(screen.getByText(/recorded frames only/i)).toBeInTheDocument();
  });

  it("moves a subject from unexposed to potentially exposed as the frame advances", () => {
    const view = render(<IntelligencePanel brief={brief(1, [])} structures={STRUCTURES} frameIndex={1} briefIsBehind={false} status="ready" provider="local" />);
    expect(screen.getByText(/No subject reports exposure at this frame/i)).toBeInTheDocument();
    expect(screen.queryByText("Harbour")).not.toBeInTheDocument();

    view.rerender(<IntelligencePanel brief={brief(2, [exposure()])} structures={STRUCTURES} frameIndex={2} briefIsBehind={false} status="ready" provider="local" />);
    // Once in the exposure table, once in the ranked priorities.
    expect(screen.getAllByText("Harbour")).toHaveLength(2);
    // Linked to the explicit subject id and its coordinates, and labelled as
    // exposure — never as damage.
    expect(screen.getByText("port-1")).toBeInTheDocument();
    expect(screen.getByText("192.0, 150.0")).toBeInTheDocument();
    expect(screen.getByText(/reports exposure status impacted — potentially exposed/i)).toBeInTheDocument();
    expect(screen.getByText(/Potentially exposed · not damage/i)).toBeInTheDocument();
    expect(screen.getAllByText("RESOURCE_DATA_UNAVAILABLE").length).toBeGreaterThan(0);
    expect(screen.getByText(/requires human approval/i)).toBeInTheDocument();
  });

  it("says which frame the brief describes when the playhead has moved on", () => {
    render(<IntelligencePanel brief={brief(2, [exposure()])} structures={STRUCTURES} frameIndex={7} briefIsBehind provider="local" status="ready" />);
    expect(screen.getByText(/Showing frame 2; playhead is at frame 7/)).toBeInTheDocument();
  });

  it("renders a coordinate placeholder for a subject that is not a placed structure", () => {
    render(<IntelligencePanel brief={brief(2, [{ ...exposure(), subject_ref: "asset-99" }])} structures={STRUCTURES} frameIndex={2} briefIsBehind={false} status="ready" provider="local" />);
    expect(screen.getByText("asset-99")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("AgentExecutionHud", () => {
  it("lists every agent of the pipeline with its reported status", () => {
    render(
      <AgentExecutionHud
        agents={rosterFromBrief(brief(2, []).agent_runs)}
        status="ready"
        trigger="scrub"
        frameIndex={2}
        error={null}
        onAnalyseNow={() => {}}
        disabled={false}
      />,
    );
    expect(screen.getByText("Hazard Analyst")).toBeInTheDocument();
    expect(screen.getByText("Command Synthesizer")).toBeInTheDocument();
    // A failed agent and an unavailable one are never dressed up as success,
    // and an agent the graph skipped reads SKIPPED.
    expect(screen.getByText("FAILED")).toBeInTheDocument();
    expect(screen.getByText("UNAVAILABLE")).toBeInTheDocument();
    expect(screen.getAllByText("SKIPPED").length).toBeGreaterThan(0);
    expect(screen.getByText(/Frame 2 · timeline scrub/)).toBeInTheDocument();
  });

  it("groups the chips by the graph's supersteps so the parallel branches read as parallel", () => {
    const stages = byStage(idleRoster());
    expect(stages.map((s) => s.id)).toEqual(["collect", "analyse", "advise", "resource", "assure"]);
    expect(stages.find((s) => s.id === "analyse")?.runs.map((r) => r.agent)).toEqual(["hazard_agent", "damage_agent", "risk_agent"]);
    expect(stages.filter((s) => s.parallel).map((s) => s.id)).toEqual(["analyse", "advise"]);

    render(<AgentExecutionHud agents={idleRoster()} status="waiting" trigger="playback" frameIndex={0} error={null} onAnalyseNow={() => {}} disabled={false} />);
    expect(screen.getByText("Analyse")).toBeInTheDocument();
    expect(screen.getByText("Advise")).toBeInTheDocument();
    expect(screen.getAllByText("‖ in tandem")).toHaveLength(2);
  });

  it("drops a stage whose agents the graph never reported", () => {
    const stages = byStage([{ agent: "context_collector", label: "Context Collector", status: "COMPLETED", summary: null, duration_ms: 1 }]);
    expect(stages.map((s) => s.id)).toEqual(["collect"]);
  });

  it("starts every agent pending and disables manual analysis with no recorded run", () => {
    render(<AgentExecutionHud agents={idleRoster()} status="idle" trigger={null} frameIndex={null} error={null} onAnalyseNow={() => {}} disabled />);
    expect(screen.getAllByText("PENDING")).toHaveLength(9);
    expect(screen.getByText("Frame —")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyse now/i })).toBeDisabled();
    expect(screen.getByText("No recorded run")).toBeInTheDocument();
  });
});
