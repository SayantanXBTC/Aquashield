import type { DisasterType } from "@shared/types";
import { hazardLabel } from "./hazardLabel";

export function HazardBadge({ disasterType }: { disasterType: DisasterType }) {
  return (
    <span className="border-accent-soft/50 text-accent-strong bg-accent/10 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide">
      {hazardLabel(disasterType)}
    </span>
  );
}
