import type { HTMLAttributes, ReactNode } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** "floating" (command overlay panels) vs "flush" (edge-to-edge bars). */
  variant?: "floating" | "flush";
}

/**
 * The base translucent surface every command-center overlay is built on —
 * one definition of "glass" so panels don't each invent their own blur/
 * border/shadow combination.
 */
export function GlassPanel({ children, variant = "floating", className = "", ...rest }: GlassPanelProps) {
  const shape = variant === "floating" ? "rounded-[var(--radius-panel)] border" : "border-b";
  return (
    <div
      className={`bg-surface/80 border-hairline backdrop-blur-md shadow-[var(--shadow-panel)] ${shape} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
