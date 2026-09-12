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
  { agent: "precaution_agent", label: "Precaution Agent" },
  { agent: "response_agent", label: "Tactical Response Agent" },
  { agent: "resource_agent", label: "Resource Agent" },
  { agent: "safety_validator", label: "Safety Validator" },
  { agent: "command_synthesizer", label: "Command Synthesizer" },
];

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
