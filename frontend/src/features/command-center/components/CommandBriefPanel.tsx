import { useCallback, useState } from "react";
import { BrainCircuit, ShieldAlert } from "lucide-react";
import { CommandButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { aiApi } from "../api/aiApi";
import type { PlaybackClock } from "../playback/playbackClock";
import { usePlaybackState } from "../playback/usePlaybackClock";
import type { AIPriorityLevel, AIRequestOut, CommandBrief, SimulationRun } from "../types";
import { HudPanel } from "./HudPanel";

interface CommandBriefPanelProps {
  scenarioId: string | null;
  /** The recorded run being replayed, else the latest completed run. */
  runs: SimulationRun[];
  replayRunId: string | null;
  /** The sim clock — the playhead maps to a recorded frame index. */
  clock: PlaybackClock;
  recordedTimestepMinutes: number;
}

const LEVEL_CLASS: Record<AIPriorityLevel, string> = {
  CRITICAL: "text-status-critical border-status-critical/40",
  HIGH: "text-severity-high border-severity-high/40",
  MEDIUM: "text-severity-moderate border-severity-moderate/40",
  LOW: "text-status-ok border-status-ok/40",
};

/**
 * Additive AI Command Brief panel (Prompt 14). Calls POST /ai/analyze for
 * the recorded run + frame under the playhead and renders the returned
 * brief verbatim: situation, hazard, priorities, human-gated actions,
 * limitations. Nothing here interprets simulation data itself; the panel
 * only shows what the backend's validated brief contains. Collapsed by
 * default so the existing layout is unchanged until opened.
 */
export function CommandBriefPanel({ scenarioId, runs, replayRunId, clock, recordedTimestepMinutes }: CommandBriefPanelProps) {
  const { elapsedMinutes } = usePlaybackState(clock);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<AIRequestOut | null>(null);
  const [brief, setBrief] = useState<CommandBrief | null>(null);

  const targetRun = replayRunId ? runs.find((r) => r.id === replayRunId) ?? null : runs.find((r) => r.status === "completed" && (r.frame_count ?? 0) > 0) ?? null;
  const frameIndex = targetRun ? Math.max(0, Math.min((targetRun.frame_count ?? 1) - 1, Math.round(elapsedMinutes / recordedTimestepMinutes))) : 0;

  const generate = useCallback(async () => {
    if (!scenarioId || !targetRun) return;
    setBusy(true);
    setError(null);
    try {
      const created = await aiApi.analyze({ scenario_id: scenarioId, simulation_run_id: targetRun.id, frame_index: frameIndex, user_question: question.trim() || null });
      setRequest(created);
      const result = await aiApi.getResult(created.id);
      if (result.status !== "completed" || !result.result) {
        setError(result.error ?? "Analysis did not complete");
        setBrief(null);
      } else {
        setBrief(result.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }, [scenarioId, targetRun, frameIndex, question]);

  return (
    <HudPanel
      id="ai-brief"
      title="AI command brief"
      icon={<BrainCircuit className="h-3.5 w-3.5" />}
      defaultCollapsed
      aside={request ? <span className="text-ink-faint font-mono text-[10px]">{request.provider} · {request.execution_ms?.toFixed(0)} ms</span> : null}
      bodyClassName="flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-1.5">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Optional question for the analysts"
          maxLength={400}
          className="text-ink h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/5 px-2 text-xs outline-none placeholder:text-white/30 focus:border-accent/40"
        />
        <CommandButton tone="accent" disabled={!targetRun || busy} onClick={() => void generate()}>
          {busy ? "Analysing…" : "Generate"}
        </CommandButton>
      </div>
      {!targetRun ? (
        <p className="text-ink-faint text-[11px]">Record a run first — the brief analyses recorded frames only.</p>
      ) : (
        <p className="text-ink-faint text-[10px]">Run {targetRun.id.slice(0, 8)} · frame {frameIndex}</p>
      )}
      {error ? (
        <p role="alert" className="text-status-critical text-[11px]">
          {error}
        </p>
      ) : null}

      {brief ? (
        <div className="flex max-h-[40vh] flex-col gap-2.5 overflow-y-auto pr-1">
          <p className="text-ink text-xs leading-relaxed">{brief.situation}</p>
          <p className="text-ink-soft text-[11px] leading-relaxed">{brief.current_hazard}</p>

          {brief.priorities.length ? (
            <section>
              <h4 className="text-ink-faint mb-1 text-[10px] tracking-[0.14em] uppercase">Priorities</h4>
              <ul className="flex flex-col gap-1">
                {brief.priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px]">
                    <span className={cn("shrink-0 rounded-[3px] border px-1 font-mono text-[9px]", LEVEL_CLASS[p.level])}>{p.level}</span>
                    <span className="text-ink">
                      {p.subject} <span className="text-ink-faint">— {p.rationale}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {brief.recommended_actions.length ? (
            <section>
              <h4 className="text-ink-faint mb-1 text-[10px] tracking-[0.14em] uppercase">Recommended actions · human approval required</h4>
              <ul className="flex flex-col gap-1.5">
                {brief.recommended_actions.map((a, i) => (
                  <li key={i} className="rounded-[6px] border border-white/[0.06] bg-white/[0.03] p-2 text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className={cn("shrink-0 rounded-[3px] border px-1 font-mono text-[9px]", LEVEL_CLASS[a.priority])}>{a.priority}</span>
                      <span className="text-ink">{a.action}</span>
                    </div>
                    {a.prerequisites.length ? <p className="text-ink-faint mt-1">Prerequisites: {a.prerequisites.join("; ")}</p> : null}
                    {a.risks.length ? <p className="text-ink-faint">Risks: {a.risks.join("; ")}</p> : null}
                    <p className="text-ink-faint">
                      Resources: {a.resources} · <ShieldAlert className="inline h-3 w-3" /> requires human approval
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {brief.key_exposures.length ? (
            <section>
              <h4 className="text-ink-faint mb-1 text-[10px] tracking-[0.14em] uppercase">Key exposures</h4>
              <ul className="flex flex-col gap-1">
                {brief.key_exposures.map((x, i) => (
                  <li key={i} className="text-ink-soft text-[11px]">
                    <span className="text-ink-faint font-mono text-[9px] uppercase">{x.claim_kind.replace(/_/g, " ")}</span> {x.statement}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {brief.data_limitations.length ? (
            <section>
              <h4 className="text-ink-faint mb-1 text-[10px] tracking-[0.14em] uppercase">Data limitations</h4>
              <ul className="flex flex-col gap-0.5">
                {brief.data_limitations.map((l, i) => (
                  <li key={i} className="text-ink-faint text-[10px]">
                    <span className="font-mono">{l.code}</span> · {l.subject}: {l.detail}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p className="text-ink-faint text-[10px] leading-relaxed uppercase tracking-[0.06em]">{brief.disclaimer}</p>
        </div>
      ) : null}
    </HudPanel>
  );
}
