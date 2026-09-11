import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel";
import { PanelHeader } from "./PanelHeader";

interface CommandPanelProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled floating overlay panel — the command center's primary
 * building block (scenario context, simulation status, layer controls). */
export function CommandPanel({ title, action, children, className = "" }: CommandPanelProps) {
  return (
    <GlassPanel className={`flex flex-col overflow-hidden ${className}`}>
      <PanelHeader title={title} action={action} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </GlassPanel>
  );
}
