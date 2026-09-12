import type { DisasterType } from "@shared/types";
import { DISASTER_ICON, IconAlert } from "./icons";
import { hazardLabel } from "./hazardLabel";

/** The disaster type, as a compact chip. Icon + text together — the glyph is
 * decorative reinforcement, the label is the meaning. */
export function HazardBadge({ disasterType }: { disasterType: DisasterType }) {
  const Icon = DISASTER_ICON[disasterType] ?? IconAlert;
  return (
    <span className="border-accent-soft text-accent-strong bg-accent/10 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-2 py-0.5 text-[11px] font-medium tracking-[0.06em]">
      <Icon size={13} />
      {hazardLabel(disasterType)}
    </span>
  );
}
