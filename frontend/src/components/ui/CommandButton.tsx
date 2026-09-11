import type { ButtonHTMLAttributes } from "react";

interface CommandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "accent";
}

export function CommandButton({ tone = "default", className = "", children, ...rest }: CommandButtonProps) {
  const toneClass =
    tone === "accent"
      ? "border-accent-soft/60 text-accent-strong hover:bg-accent/10"
      : "border-hairline-strong text-ink-soft hover:bg-surface-raised hover:text-ink";
  return (
    <button
      className={`rounded-[var(--radius-control)] border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors duration-[var(--duration-fast)] focus-visible:ring-accent-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:outline-none ${toneClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
