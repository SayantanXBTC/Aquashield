import type { AIAgentExecutionStatus, AIAgentRun } from "../types";

/**
 * The analysis pipeline as the HUD renders it — mirrors
 * `agents/prompts/versions.py`'s AGENT_LABELS/AGENT_ORDER, in graph order.
 *
 * The roster is only the shape of the chip row. Statuses always come from the
 * backend (live milestones, then the brief's own `agent_runs`), never from a
 * guess here: an agent the graph skipped must read SKIPPED, not COMPLETED.
 */
export const AGENT_ROSTER: { agent: string; label: string }[] = [
  { agent: "context_collector", label: "Context Collector" },
  { agent: "hazard_agent", label: "Hazard Analyst" },
  { agent: "damage_agent", label: "Damage / Impact Analyst" },
  { agent: "risk_agent", label: "Risk / Vulnerability Analyst" },
  { agent: "evidence_retrieval", label: "Evidence Retrieval" },
  { agent: "precaution_agent", label: "Precaution Agent" },
  { agent: "response_agent", label: "Tactical Response Agent" },
  { agent: "resource_agent", label: "Resource Agent" },
  { agent: "safety_validator", label: "Safety Validator" },
  { agent: "command_synthesizer", label: "Command Synthesizer" },
];

/**
 * The graph's supersteps, in order — the HUD groups the chips by these so the
 * branches that run in tandem read as one stage rather than a flat list.
 * Mirrors the edges in `agents/graph/workflow/graph.py`; `parallel` is true
 * where the graph fans out into a single superstep.
 */
export const AGENT_STAGES: { id: string; label: string; parallel: boolean; agents: string[] }[] = [
  { id: "collect", label: "Collect", parallel: false, agents: ["context_collector"] },
  { id: "analyse", label: "Analyse", parallel: true, agents: ["hazard_agent", "damage_agent", "risk_agent"] },
  { id: "evidence", label: "Retrieve evidence", parallel: false, agents: ["evidence_retrieval"] },
  { id: "advise", label: "Advise", parallel: true, agents: ["precaution_agent", "response_agent"] },
  { id: "resource", label: "Resource", parallel: false, agents: ["resource_agent"] },
  { id: "assure", label: "Validate & synthesise", parallel: false, agents: ["safety_validator", "command_synthesizer"] },
];

/** Groups a chip row into the graph's supersteps, dropping empty stages. */
export function byStage(runs: AIAgentRun[]): { id: string; label: string; parallel: boolean; runs: AIAgentRun[] }[] {
  const byAgent = new Map(runs.map((r) => [r.agent, r]));
  return AGENT_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    parallel: stage.parallel,
    runs: stage.agents.map((agent) => byAgent.get(agent)).filter((run): run is AIAgentRun => run !== undefined),
  })).filter((stage) => stage.runs.length > 0);
}

export function idleRoster(status: AIAgentExecutionStatus = "PENDING"): AIAgentRun[] {
  return AGENT_ROSTER.map(({ agent, label }) => ({ agent, label, status, summary: null, duration_ms: 0 }));
}

/** Applies one live milestone to the chip row. Unknown agents are ignored —
 * the roster is never invented from an event. */
export function applyAgentEvent(runs: AIAgentRun[], agent: string, patch: Partial<AIAgentRun>): AIAgentRun[] {
  if (!runs.some((r) => r.agent === agent)) return runs;
  return runs.map((r) => (r.agent === agent ? { ...r, ...patch } : r));
}

/** Once the brief arrives it is the authority: any agent it does not mention
 * was skipped by the graph's conditional routing. */
export function rosterFromBrief(agentRuns: AIAgentRun[]): AIAgentRun[] {
  const byAgent = new Map(agentRuns.map((r) => [r.agent, r]));
  return AGENT_ROSTER.map(({ agent, label }) => byAgent.get(agent) ?? { agent, label, status: "SKIPPED" as const, summary: null, duration_ms: 0 });
}
