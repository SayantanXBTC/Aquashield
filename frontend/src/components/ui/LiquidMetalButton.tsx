import type { ButtonHTMLAttributes } from "react";

interface LiquidMetalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/**
 * The primary cinematic CTA — a slow-rotating conic-gradient "liquid metal"
 * border around a glass center, in AQUASHIELD's own restrained cyan/aqua
 * palette (not a literal port of any third-party component's code —
 * see docs/development/command-center.md "Landing" for the interaction
 * this was built from: a metallic glowing border with a fluid hover state).
 * The rotation respects `prefers-reduced-motion` via Tailwind's
 * `motion-safe:`/`motion-reduce:` variants.
 */
export function LiquidMetalButton({ label, className = "", ...rest }: LiquidMetalButtonProps) {
  return (
    <button
      className={`group focus-visible:ring-accent-strong relative isolate inline-flex h-14 items-center justify-center rounded-full px-10 transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:outline-none ${className}`}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="motion-safe:animate-[spin_5s_linear_infinite] group-hover:motion-safe:animate-[spin_2.2s_linear_infinite] absolute inset-0 rounded-full opacity-90 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "conic-gradient(from 0deg, var(--color-accent-soft), var(--color-accent-strong), var(--color-ink), var(--color-accent), var(--color-accent-soft))",
          filter: "blur(6px) saturate(140%)",
        }}
      />
      <span
        aria-hidden="true"
        className="bg-abyss-2 absolute inset-[2px] rounded-full shadow-[0_0_30px_-8px_var(--color-accent)] transition-shadow duration-300 group-hover:shadow-[0_0_44px_-6px_var(--color-accent-strong)]"
      />
      <span className="text-ink relative z-10 text-sm font-semibold tracking-[0.08em] uppercase">
        {label}
      </span>
    </button>
  );
}
