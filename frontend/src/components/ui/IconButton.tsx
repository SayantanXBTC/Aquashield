import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
}

/** Icon-only button — `label` is required and becomes the accessible name
 * (aria-label + title), never left icon-only for a screen reader. */
export function IconButton({ label, icon, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`text-ink-soft hover:bg-surface-raised hover:text-ink focus-visible:ring-accent-strong flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:outline-none ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
