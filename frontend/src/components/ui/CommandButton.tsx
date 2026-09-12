import type { ButtonHTMLAttributes } from "react";

interface CommandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "accent" | "ghost";
  /** Dense console control (speed multipliers, transport buttons). */
  size?: "sm" | "md";
}

/**
 * The console's standard control. Flat fill + hairline border + a solid
 * hover/active state — no glow, no gradient, no scale transform (a control
 * that resizes on press shifts the row it sits in). Disabled state is
 * carried by opacity *and* the native `disabled` attribute, never by color
 * alone.
 */
export function CommandButton({
  tone = "default",
  size = "md",
  className = "",
  children,
  ...rest
}: CommandButtonProps) {
  const toneClass =
    tone === "accent"
      ? "border-accent-soft bg-accent/12 text-accent-strong hover:bg-accent/20 aria-pressed:bg-accent/20"
      : tone === "ghost"
        ? "border-transparent text-ink-soft hover:bg-surface-raised hover:text-ink"
        : "border-hairline-strong bg-surface-raised/60 text-ink-soft hover:bg-surface-active hover:text-ink";
  const sizeClass = size === "sm" ? "min-h-7 px-2 py-1 text-[11px]" : "min-h-8 px-3 py-1.5 text-xs";
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] border font-medium tracking-[0.04em] transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-40 ${toneClass} ${sizeClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
