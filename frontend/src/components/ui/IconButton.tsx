import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
}

/** Icon-only button — `label` is required and becomes the accessible name
 * (aria-label + title), never left icon-only for a screen reader. The 32px
 * box plus the surrounding rail padding keeps the effective hit area at or
 * above the 44px target in the layouts these appear in. */
export function IconButton({ label, icon, active = false, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent-soft bg-accent/15 text-accent-strong"
          : "border-hairline-strong bg-surface/90 text-ink-soft hover:bg-surface-active hover:text-ink"
      } ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
