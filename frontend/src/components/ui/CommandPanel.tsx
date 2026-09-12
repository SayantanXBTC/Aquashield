import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel";
import { PanelHeader } from "./PanelHeader";

interface CommandPanelProps {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "critical";
  children: ReactNode;
  className?: string;
  /** Panel body padding. "none" lets a panel own its own internal layout
   * (e.g. a full-bleed list) without fighting a fixed inset. */
  bodyPadding?: "default" | "none";
  /** Edge-to-edge inside a rail: no corner radius, no side borders — the
   * rail's own border and the 1px gaps between panels do that job, and two
   * nested rounded rectangles read as clutter at this density. */
  flush?: boolean;
}

/** A titled instrument panel — the command center's primary building block
 * (scenario context, simulation status, layer controls).
 *
 * The panel itself never scrolls its own body by default: the rail that owns
 * it scrolls instead. That's what stops one panel's overflow from being
 * clipped into a stub that visually collides with the panel below it. */
export function CommandPanel({
  title,
  action,
  icon,
  tone = "default",
  children,
  className = "",
  bodyPadding = "default",
  flush = false,
}: CommandPanelProps) {
  return (
    <GlassPanel variant={flush ? "flush" : "floating"} className={`flex flex-col ${className}`}>
      <PanelHeader title={title} action={action} icon={icon} tone={tone} />
      <div className={bodyPadding === "none" ? "" : "p-3"}>{children}</div>
    </GlassPanel>
  );
}
