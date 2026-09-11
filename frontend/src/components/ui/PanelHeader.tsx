import type { ReactNode } from "react";

interface PanelHeaderProps {
  title: string;
  action?: ReactNode;
}

export function PanelHeader({ title, action }: PanelHeaderProps) {
  return (
    <div className="border-hairline flex items-center justify-between border-b px-4 py-2.5">
      <h2 className="text-ink-soft text-[11px] font-semibold tracking-[0.14em] uppercase">{title}</h2>
      {action}
    </div>
  );
}
