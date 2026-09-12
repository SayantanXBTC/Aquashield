import type { ButtonHTMLAttributes } from "react";

interface LiquidMetalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/**
 * The primary cinematic CTA.
 *
 * Prompt 11 revision: the previous version was a blurred, saturated conic
 * gradient plus two colored `box-shadow` halos — the exact "glowing border"
 * effect this design language now bans. What replaced it is a *machined*
 * treatment: a 1px metallic rim (an unblurred conic gradient masked to the
 * border via `padding-box`/`border-box` layering), a flat dark face, and a
 * single static sheen line. The rim rotates slowly on hover only, and the
 * whole animation is gated behind `motion-safe:`.
 */
export function LiquidMetalButton({ label, className = "", ...rest }: LiquidMetalButtonProps) {
  return (
    <button
      className={`group relative isolate inline-flex h-12 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-control)] px-10 ${className}`}
      {...rest}
    >
      {/* The rim. No blur, no colored shadow — a hairline of brushed metal. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[var(--radius-control)] opacity-80 transition-opacity duration-300 group-hover:opacity-100 motion-safe:group-hover:animate-[spin_6s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 140deg, #2b3a45, var(--color-accent-soft), #8aa2b0, var(--color-accent), #2b3a45)",
        }}
      />
      {/* The face, inset by 1px so only the rim shows through. */}
      <span
        aria-hidden="true"
        className="bg-abyss group-hover:bg-abyss-2 absolute inset-[1px] rounded-[calc(var(--radius-control)-1px)] transition-colors duration-300"
      />
      {/* A single static specular line across the upper third. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-[1px] top-[1px] h-[45%] rounded-t-[calc(var(--radius-control)-1px)] bg-gradient-to-b from-white/8 to-transparent"
      />
      <span className="text-ink relative z-10 text-xs font-semibold tracking-[0.22em] uppercase">{label}</span>
    </button>
  );
}
