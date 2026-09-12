import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { byStage } from "../ai/agentRoster";
import type { AIAgentExecutionStatus, AIAgentRun, AIRequestType } from "../types";
import { HudPanel } from "./HudPanel";

interface AgentExecutionHudProps {
  agents: AIAgentRun[];
  /** What the orchestrator is doing right now. */
  status: "idle" | "waiting" | "running" | "ready" | "error";
  trigger: AIRequestType | null;
  frameIndex: number | null;
  error: string | null;
  onAnalyseNow: () => void;
  disabled: boolean;
}

const DOT: Record<AIAgentExecutionStatus, string> = {
  PENDING: "bg-white/25",
  RUNNING: "bg-accent-strong",
  COMPLETED: "bg-status-ok",
  FAILED: "bg-status-critical",
  UNAVAILABLE: "bg-severity-moderate",
  SKIPPED: "bg-white/15",
};

// RUNNING gets its own loud pill instead of the flat mono label every other
// status shares — a working agent must be unmissable at a glance, not read
// the same size as an idle one.
const STATUS_CHIP: Record<AIAgentExecutionStatus, string> = {
  PENDING: "text-ink-faint font-mono text-[9px] tracking-[0.08em] uppercase",
  RUNNING: "text-accent-strong bg-accent/15 border border-accent-soft rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] uppercase motion-safe:animate-pulse",
  COMPLETED: "text-ink-faint font-mono text-[9px] tracking-[0.08em] uppercase",
  FAILED: "text-status-critical font-mono text-[9px] font-bold tracking-[0.08em] uppercase",
  UNAVAILABLE: "text-severity-moderate font-mono text-[9px] tracking-[0.08em] uppercase",
  SKIPPED: "text-ink-faint font-mono text-[9px] tracking-[0.08em] uppercase",
};

const STATUS_LABEL: Record<AgentExecutionHudProps["status"], string> = {
  idle: "No recorded run",
  waiting: "Queued",
  running: "Analysing",
  ready: "Complete",
  error: "Failed",
};

const TRIGGER_LABEL: Record<AIRequestType, string> = {
  playback: "playback",
  scrub: "timeline scrub",
  paused: "paused",
  complete: "run complete",
  manual: "manual",
};

/**
 * The Agent Execution HUD — one chip per node of the analysis graph, in the
 * order the graph runs them.
 *
 * Statuses are reported by the backend (live `/ws/ai` milestones, then the
 * brief's own `agent_runs`); nothing here infers progress. An agent the
 * graph's conditional routing skipped reads SKIPPED, and the Resource Agent
 * reads UNAVAILABLE because no verified resource inventory exists — neither
 * is dressed up as success.
 */
export function AgentExecutionHud({ agents, status, trigger, frameIndex, error, onAnalyseNow, disabled }: AgentExecutionHudProps) {
  return (
    <HudPanel
      id="ai-agents"
      title="Agent pipeline"
      icon={<Cpu className="h-3.5 w-3.5" />}
      aside={
        <span className={cn("font-mono text-[10px]", status === "error" ? "text-status-critical" : status === "running" ? "text-accent-strong" : "text-ink-faint")}>
          {STATUS_LABEL[status]}
        </span>
      }
      bodyClassName="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-faint text-[10px]">
          {frameIndex === null ? "Frame —" : `Frame ${frameIndex}`}
          {trigger ? ` · ${TRIGGER_LABEL[trigger]}` : ""}
        </span>
        <button
          type="button"
          onClick={onAnalyseNow}
          disabled={disabled}
          className="text-ink-soft hover:text-ink cursor-pointer rounded-[4px] border border-white/[0.08] px-2 py-0.5 text-[10px] tracking-[0.1em] uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          Analyse now
        </button>
      </div>

      {/* Grouped by the graph's supersteps, so the branches that run in the
          same step read as one stage instead of a flat queue. */}
      <div className="flex flex-col gap-1.5">
        {byStage(agents).map((stage) => (
          <section key={stage.id}>
            <div className="text-ink-faint mb-0.5 flex items-center gap-1.5 text-[9px] tracking-[0.14em] uppercase">
              <span>{stage.label}</span>
              {stage.parallel ? <span className="text-accent-strong font-mono normal-case tracking-normal">‖ in tandem</span> : null}
              <span className="h-px flex-1 bg-white/[0.06]" aria-hidden />
            </div>
            <ul className={cn("flex flex-col gap-1", stage.parallel && "border-l border-white/[0.08] pl-2")}>
              {stage.runs.map((agent) => {
                const running = agent.status === "RUNNING";
                return (
                  <li
                    key={agent.agent}
                    className={cn(
                      "flex items-center gap-2 rounded-[4px] px-1 py-0.5 transition-colors",
                      running && "bg-accent/10",
                    )}
                    title={agent.summary ?? undefined}
                  >
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      {running ? (
                        <span className="bg-accent-strong absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" aria-hidden />
                      ) : null}
                      <span className={cn("relative h-1.5 w-1.5 shrink-0 rounded-full", DOT[agent.status])} aria-hidden />
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-[11px]", running ? "text-ink font-semibold" : "text-ink-soft")}>
                      {agent.label}
                    </span>
                    <span className={STATUS_CHIP[agent.status]}>{running ? "Working…" : agent.status}</span>
                    <span className="text-ink-faint w-12 shrink-0 text-right font-mono text-[9px]">
                      {agent.duration_ms > 0 ? `${agent.duration_ms.toFixed(0)} ms` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-status-critical text-[11px]">
          {error}
        </p>
      ) : null}
    </HudPanel>
  );
}
