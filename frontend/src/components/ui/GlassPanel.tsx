import type { HTMLAttributes, ReactNode } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** "floating" (command overlay panels) vs "flush" (edge-to-edge bars). */
  variant?: "floating" | "flush";
}

/**
 * The base instrument surface every command-center panel is built on — one
 * definition of "panel" so components don't each invent their own border/
 * shadow combination.
 *
 * Prompt 11 revision: this is now a near-opaque flat surface with a single
 * hairline rule and a neutral drop shadow, NOT a heavily-blurred translucent
 * "glass card" with a colored halo. A 96%-opaque background keeps panel text
 * at full contrast over the 3D viewport (body text below 4.5:1 was the real
 * cost of the previous 80% translucency), and no accent-tinted shadow is
 * used anywhere — glow is a banned effect in this design language, not a
 * dialled-down one. The component name is kept because it's referenced
 * across the feature and in docs; the visual treatment is what changed.
 */
export function GlassPanel({ children, variant = "floating", className = "", ...rest }: GlassPanelProps) {
  const shape = variant === "floating" ? "rounded-[var(--radius-panel)] border" : "border-b";
  return (
    <div
      className={`bg-surface/96 border-hairline shadow-[var(--shadow-panel)] backdrop-blur-sm ${shape} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
