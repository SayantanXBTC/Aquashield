import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { HazardBadge, StatusIndicator } from "@/components/ui";
import { IconShield } from "@/components/ui/icons";
import type { ScenarioDetail, WorldProfile } from "../types";
import type { SaveStatus } from "../hooks/useScenarioSession";
import { ProfileMenu } from "./ProfileMenu";

interface TopBarProps {
  scenario: ScenarioDetail | null;
  saveStatus: SaveStatus;
  replaying: boolean;
  /** A purely cosmetic 3D-rendering choice (CLAUDE.md §25/§27) — never a
   * real place. Omit both to hide the toggle (no test selected). */
  worldProfile?: WorldProfile;
  onToggleWorldProfile?: () => void;
}

const SAVE_TONE: Record<SaveStatus, { tone: "ok" | "warning" | "critical" | "loading"; label: string }> = {
  saved: { tone: "ok", label: "Saved" },
  dirty: { tone: "warning", label: "Unsaved" },
  saving: { tone: "loading", label: "Saving" },
  error: { tone: "critical", label: "Save failed" },
};

/** The console masthead: wordmark, the active test, its save state, the
 * preview/replay mode, and the profile menu. Glass over the viewport. */
export function TopBar({ scenario, saveStatus, replaying, worldProfile, onToggleWorldProfile }: TopBarProps) {
  const save = SAVE_TONE[saveStatus];
  return (
    <header className="pointer-events-auto relative z-30 flex h-12 items-center gap-4 rounded-[8px] border border-white/[0.07] bg-[rgba(9,14,20,0.66)] px-3 shadow-[0_18px_48px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <Link to="/" className="text-ink flex shrink-0 items-center gap-2.5" aria-label="AQUASHIELD home">
        <IconShield size={18} className="text-accent" />
        <span className="hidden text-[12px] font-bold tracking-[0.22em] sm:inline">AQUASHIELD</span>
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {scenario ? (
          <>
            <span className="text-ink truncate text-sm font-medium">{scenario.name}</span>
            <HazardBadge disasterType={scenario.disaster_type} />
            <span className="hidden sm:inline">
              <StatusIndicator tone={save.tone} label={save.label} />
            </span>
          </>
        ) : (
          <span className="text-ink-faint text-xs">No test selected</span>
        )}
      </div>

      <span
        className={`hidden rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase md:inline ${
          replaying ? "border-status-warning/50 text-status-warning" : "border-accent-soft text-accent-strong"
        }`}
      >
        {replaying ? "Replay · recorded run" : "Live preview"}
      </span>

      {worldProfile && onToggleWorldProfile ? (
        <button
          type="button"
          onClick={onToggleWorldProfile}
          disabled={replaying}
          title={worldProfile === "demo" ? "Switch to Dense Coastal Profile" : "Reset to Demo World"}
          className="border-hairline-strong bg-surface-raised/60 text-ink-soft hover:bg-surface-active hover:text-ink inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 py-1 text-[10px] font-medium tracking-[0.06em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Building2 className="h-3.5 w-3.5" />
          {worldProfile === "demo" ? "Dense Coastal Profile" : "Reset to Demo World"}
        </button>
      ) : null}

      <ProfileMenu />
    </header>
  );
}
