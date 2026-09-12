import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HudPanelProps {
  id: string;
  title: string;
  icon?: ReactNode;
  /** Small text/badge on the right of the header. */
  aside?: ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

function readCollapsed(id: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(`aquashield.hud.${id}`);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

/**
 * A collapsible glassmorphic HUD overlay — the one panel primitive the
 * command center uses, so every overlay shares the same header, blur,
 * hairline and collapse behaviour. Collapsed state is remembered per panel
 * in localStorage (a per-viewer convenience only).
 */
export function HudPanel({ id, title, icon, aside, defaultCollapsed = false, className, bodyClassName, children }: HudPanelProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id, defaultCollapsed));
  const toggle = () => {
    setCollapsed((v) => {
      try {
        window.localStorage.setItem(`aquashield.hud.${id}`, v ? "0" : "1");
      } catch {
        // storage unavailable — state is still held in memory
      }
      return !v;
    });
  };
  return (
    <section
      aria-label={title}
      className={cn(
        "pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-white/[0.07] bg-[rgba(9,14,20,0.66)] shadow-[0_18px_48px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex h-9 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-left transition-colors hover:bg-white/[0.04]"
      >
        {icon ? <span className="text-accent-strong shrink-0">{icon}</span> : null}
        <span className="text-ink text-[11px] font-semibold tracking-[0.18em] uppercase">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {aside}
          <ChevronDown className={cn("text-ink-faint h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")} />
        </span>
      </button>
      {!collapsed ? <div className={cn("border-t border-white/[0.06] p-3", bodyClassName)}>{children}</div> : null}
    </section>
  );
}
