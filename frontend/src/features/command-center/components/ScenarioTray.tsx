import { Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui";
import { DISASTER_ICON, IconAlert, IconLayers } from "@/components/ui/icons";
import { hazardLabel } from "@/components/ui/hazardLabel";
import { cn } from "@/lib/utils";
import type { AsyncStatus } from "../hooks/useScenarioSession";
import type { ScenarioListItem } from "../types";
import { HudPanel } from "./HudPanel";

interface ScenarioTrayProps {
  scenarios: ScenarioListItem[];
  status: AsyncStatus;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onArchive: (id: string) => void;
  onRetry: () => void;
}

/** The user's saved tests. Private to the signed-in account — the backend
 * only ever returns the caller's own scenarios. */
export function ScenarioTray({ scenarios, status, error, selectedId, onSelect, onNew, onArchive, onRetry }: ScenarioTrayProps) {
  return (
    <HudPanel
      id="tray"
      title="My tests"
      icon={<IconLayers size={14} />}
      aside={
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onNew();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onNew();
            }
          }}
          className="border-accent-soft bg-accent/12 text-accent-strong hover:bg-accent/20 inline-flex h-6 cursor-pointer items-center gap-1 rounded-[var(--radius-control)] border px-2 text-[10px] font-semibold tracking-[0.12em] uppercase"
        >
          <Plus className="h-3 w-3" /> New test
        </span>
      }
      bodyClassName="p-1.5"
    >
      {status === "error" ? (
        <div className="p-2">
          <ErrorState title="Could not load tests" detail={error ?? undefined} onRetry={onRetry} />
        </div>
      ) : status === "loading" && scenarios.length === 0 ? (
        <p className="text-ink-faint px-2 py-3 text-xs">Loading…</p>
      ) : scenarios.length === 0 ? (
        <div className="p-2">
          <EmptyState title="No tests yet" detail="Create one to place a hazard on the water." />
        </div>
      ) : (
        <ul className="flex max-h-[38vh] flex-col gap-0.5 overflow-y-auto">
          {scenarios.map((s) => {
            const Icon = DISASTER_ICON[s.disaster_type] ?? IconAlert;
            const active = s.id === selectedId;
            return (
              <li key={s.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-2 text-left transition-colors",
                    active ? "bg-accent/12 text-ink" : "text-ink-soft hover:bg-white/[0.05] hover:text-ink",
                  )}
                >
                  <Icon size={14} className={active ? "text-accent-strong" : "text-ink-faint"} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-xs font-medium">{s.name}</span>
                    <span className="text-ink-faint truncate text-[10px]">
                      {hazardLabel(s.disaster_type)} · v{s.current_version_number ?? 1}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onArchive(s.id)}
                  aria-label={`Archive ${s.name}`}
                  title="Archive"
                  className="text-ink-faint hover:text-status-critical mr-1 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] transition-colors group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </HudPanel>
  );
}
