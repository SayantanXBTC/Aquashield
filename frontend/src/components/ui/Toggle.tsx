import type { ReactNode } from "react";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: ReactNode;
  /** A short, real value (a count, a source name) shown under the label.
   * Never a fabricated statistic — callers pass `undefined` when unknown. */
  detail?: string;
  disabled?: boolean;
}

/**
 * A labelled data-layer switch. Uses `role="switch"` + `aria-checked` (not a
 * pressed button) because that's what it is semantically, and the whole row
 * is the hit target so the touch area clears 44px in height rather than
 * being limited to the 34px track.
 *
 * State is conveyed by the track position AND the track/label color, never
 * by color alone.
 */
export function Toggle({ label, checked, onChange, icon, detail, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="group hover:bg-surface-raised/70 flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2 text-left transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon ? (
        <span className={`shrink-0 ${checked ? "text-accent-strong" : "text-ink-faint"}`}>{icon}</span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate text-xs font-medium ${checked ? "text-ink" : "text-ink-faint"}`}>{label}</span>
        {detail ? <span className="text-ink-faint truncate font-mono text-[10px]">{detail}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-4 w-8 shrink-0 rounded-full border transition-colors duration-[var(--duration-fast)] ${
          checked ? "border-accent-soft bg-accent/35" : "border-hairline-strong bg-surface-raised"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[10px] w-[10px] rounded-full transition-all duration-[var(--duration-fast)] ${
            checked ? "left-[18px] bg-accent-strong" : "left-[2px] bg-ink-faint"
          }`}
        />
      </span>
    </button>
  );
}
