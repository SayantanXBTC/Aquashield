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
const LEVEL_RANK: Record<AIPriorityLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const MISSING = "—";
/** How much of each section is shown before it is summarised. The brief is a
 * decision aid at a glance; the full list is one click away in the audit. */
const MAX_ROWS = 4;

function Badge({ level }: { level: AIPriorityLevel }) {
  return <span className={cn("shrink-0 rounded-[3px] border px-1 font-mono text-[9px]", LEVEL_CLASS[level])}>{level}</span>;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-ink-faint mb-1 flex items-center gap-1.5 text-[9px] tracking-[0.14em] uppercase">
        <span>{title}</span>
        {count !== undefined ? <span className="font-mono">{count}</span> : null}
        <span className="h-px flex-1 bg-white/[0.06]" aria-hidden />
      </div>
      {children}
    </section>
  );
}

/** More than MAX_ROWS: say how many were held back rather than truncating silently. */
function Overflow({ total }: { total: number }) {
  if (total <= MAX_ROWS) return null;
  return <li className="text-ink-faint text-[10px]">+{total - MAX_ROWS} more in the audit below</li>;
}

function ActionRow({ action, tag }: { action: AIRecommendedAction; tag: string }) {
  // Prerequisites and risks are what an operator checks before acting, not
  // while scanning — they stay on the row, one line, in the tooltip.
  const detail = [action.prerequisites.length ? `Prerequisites: ${action.prerequisites.join("; ")}` : "", action.risks.length ? `Risks: ${action.risks.join("; ")}` : ""].filter(Boolean).join("\n");
  return (
    <li className="flex items-start gap-1.5 text-[11px]" title={detail || undefined}>
      <Badge level={action.priority} />
      <span className="text-ink-faint shrink-0 font-mono text-[9px] uppercase">{tag}</span>
      <span className="text-ink line-clamp-2">{action.action}</span>
    </li>
  );
}

/**
 * The Command Brief as a mission-control readout: what the hazard is doing,
 * what is potentially exposed, what is ranked highest, and what is proposed —
 * each in one scannable line.
 *
 * Density is the point. Everything on screen comes verbatim from the
 * backend's validated brief — this component computes no severity, no count
 * and no coordinate of its own — but it shows the top MAX_ROWS of each
 * section and moves evidence ids, prerequisites, risks, uncertainties and
 * limitations into the audit block or a tooltip, so the panel answers "what
 * now?" without scrolling. A value the brief does not carry renders the "—"
 * placeholder (CLAUDE.md §27), and spatial intersection is always labelled
 * potentially exposed, never damage.
 */
export function IntelligencePanel({ brief, structures, frameIndex, briefIsBehind, status, provider }: IntelligencePanelProps) {
  const byId = new Map(structures.map((s) => [s.id, s]));

  const exposures = brief ? [...brief.key_exposures].sort((a, b) => LEVEL_RANK[a.severity_hint] - LEVEL_RANK[b.severity_hint]) : [];
  const priorities = brief?.priorities ?? [];
  const actions = brief ? [...brief.recommended_actions, ...brief.precautions] : [];
  const topLevel = priorities[0]?.level;

  return (
    <HudPanel
      id="ai-intelligence"
      title="Intelligence"
      icon={<Radar className="h-3.5 w-3.5" />}
      aside={brief ? <span className="text-ink-faint font-mono text-[10px]">frame {brief.frame_index}</span> : null}
      bodyClassName="flex flex-col gap-2"
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
        <div className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto pr-1">
          {briefIsBehind ? (
            <p className="text-severity-moderate text-[10px]">
              Showing frame {brief.frame_index}; playhead is at frame {frameIndex}.
            </p>
          ) : null}

          {/* The whole picture in one row. */}
          <dl className="grid grid-cols-3 gap-1.5 rounded-[6px] border border-white/[0.06] bg-white/[0.03] p-2">
            <div>
              <dt className="text-ink-faint text-[9px] tracking-[0.12em] uppercase">Exposed</dt>
              <dd className="text-ink font-mono text-sm">{exposures.length}</dd>
            </div>
            <div>
              <dt className="text-ink-faint text-[9px] tracking-[0.12em] uppercase">Top priority</dt>
              <dd className={cn("font-mono text-sm", topLevel ? LEVEL_CLASS[topLevel].split(" ")[0] : "text-ink-faint")}>{topLevel ?? MISSING}</dd>
            </div>
            <div>
              <dt className="text-ink-faint text-[9px] tracking-[0.12em] uppercase">Actions</dt>
              <dd className="text-ink font-mono text-sm">{actions.length}</dd>
            </div>
          </dl>

          <p className="text-ink-soft line-clamp-3 text-[11px] leading-relaxed">{brief.current_hazard}</p>

          <Section title="Potentially exposed · not damage" count={exposures.length}>
            {exposures.length ? (
              <ul className="flex flex-col gap-0.5">
                {exposures.slice(0, MAX_ROWS).map((exposure, index) => {
                  const placed = byId.get(exposure.subject_ref);
                  return (
                    <li key={index} className="flex items-center gap-1.5 text-[11px]" title={exposure.statement}>
                      <Badge level={exposure.severity_hint} />
                      <span className="text-ink min-w-0 flex-1 truncate">{exposure.subject}</span>
                      <span className="text-ink-faint shrink-0 font-mono text-[9px]">
                        {placed ? `${placed.x_km.toFixed(0)}, ${placed.y_km.toFixed(0)} km` : exposure.subject_ref || MISSING}
                      </span>
                    </li>
                  );
                })}
                <Overflow total={exposures.length} />
              </ul>
            ) : (
              <p className="text-ink-faint text-[10px]">Nothing exposed at this frame. Absence of exposure data is not absence of risk.</p>
            )}
          </Section>

          <Section title="Priorities" count={priorities.length}>
            {priorities.length ? (
              <ul className="flex flex-col gap-0.5">
                {priorities.slice(0, MAX_ROWS).map((priority, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-[11px]" title={priority.rationale}>
                    <Badge level={priority.level} />
                    <span className="text-ink line-clamp-1">{priority.subject}</span>
                  </li>
                ))}
                <Overflow total={priorities.length} />
              </ul>
            ) : (
              <p className="text-ink-faint text-[10px]">No ranked priority for this frame.</p>
            )}
          </Section>

          <Section title="Proposed · approval required" count={actions.length}>
            {actions.length ? (
              <ul className="flex flex-col gap-1">
                {actions.slice(0, MAX_ROWS).map((action, index) => (
                  <ActionRow key={index} action={action} tag={index < brief.recommended_actions.length ? "act" : "prec"} />
                ))}
                <Overflow total={actions.length} />
              </ul>
            ) : (
              <p className="text-ink-faint text-[10px]">Nothing proposed for this frame.</p>
            )}
          </Section>

          <p className="text-ink-faint flex items-center gap-1 text-[9px] tracking-[0.06em] uppercase">
            <ShieldAlert className="h-3 w-3 shrink-0" /> Simplified demonstration model · exposure, not damage · human approval required
          </p>

          {/* Everything an operator checks rather than scans: the full text of
              each finding, the evidence it cites, and what the validator did. */}
          <details className="rounded-[6px] border border-white/[0.06] bg-white/[0.02] p-2">
            <summary className="text-ink-faint cursor-pointer text-[9px] tracking-[0.14em] uppercase">Audit · evidence, limitations, full findings</summary>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <p className="text-ink-soft text-[10px] leading-relaxed">{brief.situation}</p>
              <dl className="text-ink-faint grid grid-cols-[auto_1fr] gap-x-2 text-[10px]">
                <dt>Run</dt>
                <dd className="font-mono">{brief.simulation_run_id.slice(0, 8)}</dd>
                <dt>Frame</dt>
                <dd className="font-mono">{brief.frame_index}</dd>
                <dt>Resources</dt>
                <dd className="font-mono">{brief.resource_status}</dd>
                <dt>Provider</dt>
                <dd className="font-mono">{provider ?? MISSING}</dd>
                <dt>Evidence</dt>
                <dd className="font-mono">{brief.evidence_references.length}</dd>
              </dl>

              {brief.hazard_progression.length ? (
                <ul className="flex flex-col gap-0.5">
                  {brief.hazard_progression.map((statement, index) => (
                    <li key={index} className="text-ink-faint text-[10px] leading-relaxed">
                      {statement.statement} <span className="font-mono text-[9px]">[{statement.evidence_ids.join(", ") || MISSING}]</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {exposures.length ? (
                <ul className="flex flex-col gap-0.5">
                  {exposures.map((exposure, index) => (
                    <li key={index} className="text-ink-faint text-[10px] leading-relaxed">
                      <span className="font-mono">{exposure.subject_ref || MISSING}</span> · {exposure.statement}
                    </li>
                  ))}
                </ul>
              ) : null}

              {actions.length ? (
                <ul className="flex flex-col gap-0.5">
                  {actions.map((action, index) => (
                    <li key={index} className="text-ink-faint text-[10px] leading-relaxed">
                      {action.action}
                      {action.prerequisites.length ? ` · Prerequisites: ${action.prerequisites.join("; ")}` : ""}
                      {action.risks.length ? ` · Risks: ${action.risks.join("; ")}` : ""} · Resources: {action.resources}
                    </li>
                  ))}
                </ul>
              ) : null}

              {brief.data_limitations.length ? (
                <ul className="flex flex-col gap-0.5">
                  {brief.data_limitations.map((limitation, index) => (
                    <li key={index} className="text-ink-faint text-[10px]">
                      <span className="font-mono">{limitation.code}</span> · {limitation.subject}: {limitation.detail}
                    </li>
                  ))}
                </ul>
              ) : null}

              {brief.uncertainties.length ? (
                <ul className="flex flex-col gap-0.5">
                  {brief.uncertainties.map((uncertainty, index) => (
                    <li key={index} className="text-ink-faint text-[10px]">
                      {uncertainty}
                    </li>
                  ))}
                </ul>
              ) : null}

              {brief.validation_notes.length ? (
                <ul className="flex flex-col gap-0.5">
                  {brief.validation_notes.map((note, index) => (
                    <li key={index} className="text-ink-faint text-[10px]">
                      Safety validator: {note}
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="text-ink-faint text-[10px] leading-relaxed">{brief.disclaimer}</p>
            </div>
          </details>
        </div>
      )}
    </HudPanel>
  );
}
