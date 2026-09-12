import type { ReactNode } from "react";

interface PanelHeaderProps {
  title: string;
  action?: ReactNode;
  /** Optional leading glyph from components/ui/icons.tsx. Decorative — the
   * title text always carries the meaning. */
  icon?: ReactNode;
  /** Tints the leading rule for a panel that reports a hazard/impact state
   * rather than a neutral one. */
  tone?: "default" | "critical";
}

/**
 * A panel's title bar: a 2px leading rule, a compact uppercase label, and an
 * optional right-aligned action. The leading rule is what separates one
 * instrument from the next — deliberately used instead of a glowing border,
 * which is the pattern this design language bans outright.
 */
export function PanelHeader({ title, action, icon, tone = "default" }: PanelHeaderProps) {
  const rule = tone === "critical" ? "bg-status-critical" : "bg-accent";
  return (
    <div className="border-hairline relative flex items-center justify-between gap-2 border-b py-2 pr-3 pl-3.5">
      <span aria-hidden="true" className={`absolute top-2 bottom-2 left-0 w-[2px] ${rule}`} />
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-ink-faint shrink-0">{icon}</span> : null}
        <h2 className="text-ink truncate text-[11px] font-semibold tracking-[0.16em] uppercase">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
