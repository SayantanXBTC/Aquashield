import { Radar, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AIPriorityLevel, AIRecommendedAction, CommandBrief, StructureConfig } from "../types";
import { HudPanel } from "./HudPanel";

interface IntelligencePanelProps {
  brief: CommandBrief | null;
  /** Placed structures, so an exposed subject can be located on the map. */
  structures: StructureConfig[];
  frameIndex: number;
  briefIsBehind: boolean;
  status: "idle" | "waiting" | "running" | "ready" | "error";
  provider?: string | null;
}

const LEVEL_CLASS: Record<AIPriorityLevel, string> = {
  CRITICAL: "text-status-critical border-status-critical/40",
  HIGH: "text-severity-high border-severity-high/40",
  MEDIUM: "text-severity-moderate border-severity-moderate/40",
  LOW: "text-status-ok border-status-ok/40",
};

const MISSING = "—";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-ink-faint mb-1 text-[10px] tracking-[0.14em] uppercase">{title}</h4>
      {children}
    </section>
  );
}

function ActionList({ actions, emptyLabel }: { actions: AIRecommendedAction[]; emptyLabel: string }) {
  if (!actions.length) return <p className="text-ink-faint text-[10px]">{emptyLabel}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {actions.map((action, index) => (
        <li key={index} className="rounded-[6px] border border-white/[0.06] bg-white/[0.03] p-2 text-[11px]">
          <div className="flex items-start gap-2">
            <span className={cn("shrink-0 rounded-[3px] border px-1 font-mono text-[9px]", LEVEL_CLASS[action.priority])}>{action.priority}</span>
            <span className="text-ink">{action.action}</span>
          </div>
          {action.prerequisites.length ? <p className="text-ink-faint mt-1">Prerequisites: {action.prerequisites.join("; ")}</p> : null}
          {action.risks.length ? <p className="text-ink-faint">Risks: {action.risks.join("; ")}</p> : null}
          <p className="text-ink-faint">
            Resources: {action.resources} · <ShieldAlert className="inline h-3 w-3" /> requires human approval
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The structured intelligence panel: the Command Brief rendered as
 * mission-control sections rather than chat.
 *
 * Everything on screen comes verbatim from the backend's validated brief —
 * this component computes no severity, no count and no coordinate of its
 * own. A value the brief does not carry renders the explicit "—" placeholder
 * (CLAUDE.md §27 "no fabricated numbers"), and spatial intersection is
 * always labelled POTENTIALLY EXPOSED, never damage.
 */
export function IntelligencePanel({ brief, structures, frameIndex, briefIsBehind, status, provider }: IntelligencePanelProps) {
  const byId = new Map(structures.map((s) => [s.id, s]));

  return (
    <HudPanel
      id="ai-intelligence"
      title="Intelligence"
      icon={<Radar className="h-3.5 w-3.5" />}
      aside={brief ? <span className="text-ink-faint font-mono text-[10px]">frame {brief.frame_index}</span> : null}
      bodyClassName="flex flex-col gap-2.5"
    >
      {!brief ? (
        <EmptyState
          dense
          title={status === "running" || status === "waiting" ? "Analysis in progress" : "No analysis yet"}
          detail={
            status === "idle"
              ? "Record a run — the agents analyse recorded frames only, never the live preview."
              : "The agents are reading the frame under the playhead."
          }
        />
      ) : (
        <div className="flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto pr-1">
          {briefIsBehind ? (
            <p className="text-severity-moderate text-[10px]">
              Showing frame {brief.frame_index}; playhead is at frame {frameIndex}.
            </p>
          ) : null}

          <Section title="Current hazard">
            <p className="text-ink text-xs leading-relaxed">{brief.situation}</p>
            <p className="text-ink-soft mt-1 text-[11px] leading-relaxed">{brief.current_hazard}</p>
            {brief.hazard_progression.length ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {brief.hazard_progression.map((statement, index) => (
                  <li key={index} className="text-ink-faint text-[10px] leading-relaxed">
                    {statement.statement}{" "}
                    <span className="font-mono text-[9px]">[{statement.evidence_ids.join(", ") || MISSING}]</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-faint mt-1 text-[10px]">No grounded progression statement for this frame.</p>
            )}
          </Section>

          <Section title="Potentially exposed · not damage">
            {brief.key_exposures.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="text-ink-faint text-left">
                      <th className="py-0.5 pr-2 font-normal tracking-[0.1em] uppercase">Subject</th>
                      <th className="py-0.5 pr-2 font-normal tracking-[0.1em] uppercase">Id</th>
                      <th className="py-0.5 pr-2 font-normal tracking-[0.1em] uppercase">x, y km</th>
                      <th className="py-0.5 font-normal tracking-[0.1em] uppercase">Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brief.key_exposures.map((exposure, index) => {
                      const placed = byId.get(exposure.subject_ref);
                      return (
                        <tr key={index} className="align-top">
                          <td className="text-ink py-0.5 pr-2">
                            {exposure.subject}
                            <span className="text-ink-faint block text-[9px] leading-relaxed">{exposure.statement}</span>
                          </td>
                          <td className="text-ink-faint py-0.5 pr-2 font-mono">{exposure.subject_ref || MISSING}</td>
                          <td className="text-ink-faint py-0.5 pr-2 font-mono">
                            {placed ? `${placed.x_km.toFixed(1)}, ${placed.y_km.toFixed(1)}` : MISSING}
                          </td>
                          <td className="py-0.5">
                            <span className={cn("rounded-[3px] border px-1 font-mono text-[9px]", LEVEL_CLASS[exposure.severity_hint])}>{exposure.severity_hint}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-ink-faint text-[10px]">No subject reports exposure at this frame. Absence of exposure data is not absence of risk.</p>
            )}
          </Section>

          <Section title="Risk priorities">
            {brief.priorities.length ? (
              <ul className="flex flex-col gap-1">
                {brief.priorities.map((priority, index) => (
                  <li key={index} className="flex items-start gap-2 text-[11px]">
                    <span className={cn("shrink-0 rounded-[3px] border px-1 font-mono text-[9px]", LEVEL_CLASS[priority.level])}>{priority.level}</span>
                    <span className="text-ink">
                      {priority.subject} <span className="text-ink-faint">— {priority.rationale}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-faint text-[10px]">No ranked priority for this frame.</p>
            )}
          </Section>

          <Section title="Precautions · human approval required">
            <ActionList actions={brief.precautions} emptyLabel="No precaution proposed for this frame." />
          </Section>

          <Section title="Tactical actions · human approval required">
            <ActionList actions={brief.recommended_actions} emptyLabel="No targeted action proposed for this frame." />
          </Section>

          <Section title="Data limitations & audit">
            <dl className="text-ink-faint grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
              <dt>Run</dt>
              <dd className="font-mono">{brief.simulation_run_id.slice(0, 8)}</dd>
              <dt>Frame</dt>
              <dd className="font-mono">{brief.frame_index}</dd>
              <dt>Resources</dt>
              <dd className="font-mono">{brief.resource_status}</dd>
              <dt>Provider</dt>
              <dd className="font-mono">{provider ?? MISSING}</dd>
            </dl>
            {brief.data_limitations.length ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {brief.data_limitations.map((limitation, index) => (
                  <li key={index} className="text-ink-faint text-[10px]">
                    <span className="font-mono">{limitation.code}</span> · {limitation.subject}: {limitation.detail}
                  </li>
                ))}
              </ul>
            ) : null}
            {brief.uncertainties.length ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {brief.uncertainties.map((uncertainty, index) => (
                  <li key={index} className="text-ink-faint text-[10px]">
                    {uncertainty}
                  </li>
                ))}
              </ul>
            ) : null}
            {brief.validation_notes.length ? (
              <details className="mt-1">
                <summary className="text-ink-faint cursor-pointer text-[10px] tracking-[0.1em] uppercase">Safety validator · {brief.validation_notes.length} note(s)</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {brief.validation_notes.map((note, index) => (
                    <li key={index} className="text-ink-faint text-[10px]">
                      {note}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Section>

          <p className="text-ink-faint text-[10px] leading-relaxed tracking-[0.06em] uppercase">{brief.disclaimer}</p>
        </div>
      )}
    </HudPanel>
  );
}
