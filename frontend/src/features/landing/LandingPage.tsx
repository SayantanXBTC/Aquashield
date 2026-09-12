import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { IconShield } from "@/components/ui/icons";
import { LiquidMetalButton } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { FluidBackdrop } from "./FluidBackdrop";

const FEATURES = [
  { label: "Simulate", detail: "Demo models, deterministic" },
  { label: "Visualize", detail: "Live 3D shoreline" },
  { label: "Respond", detail: "Telemetry to landfall" },
] as const;

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/** The landing route ("/"). One screen: a fluid WebGL backdrop, a wordmark,
 * a four-word headline, one line of copy, one CTA. Nothing here imports
 * three/ or the command-center feature — this is the initial bundle
 * (CLAUDE.md §27). */
export function LandingPage() {
  const { status } = useAuth();
  const target = status === "signed-in" ? "/command-center" : "/explore";

  return (
    <main className="bg-void relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0">
        <FluidBackdrop />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,8,11,0)_0%,rgba(5,8,11,0.55)_70%,rgba(5,8,11,0.9)_100%)]" />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <span className="text-ink flex items-center gap-2.5">
          <IconShield size={18} className="text-accent" />
          <span className="text-xs font-bold tracking-[0.26em]">AQUASHIELD</span>
        </span>
        <Link
          to={target}
          className="border-hairline-strong bg-surface/70 text-ink hover:bg-surface-active rounded-[var(--radius-control)] border px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase backdrop-blur-sm transition-colors"
        >
          {status === "signed-in" ? "Console" : "Sign in"}
        </Link>
      </header>

      <section className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.span {...fade(0.1)} className="text-accent-strong text-[11px] font-semibold tracking-[0.3em] uppercase">
          Water disaster intelligence
        </motion.span>
        <motion.h1
          {...fade(0.25)}
          className="text-ink font-display mt-5 max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.02em] text-balance md:text-6xl"
        >
          See the water coming.
        </motion.h1>
        <motion.p {...fade(0.4)} className="text-ink-soft mt-5 max-w-md text-sm md:text-base">
          Place a hazard. Tune it. Watch it reach the shore.
        </motion.p>
        <motion.div {...fade(0.55)} className="mt-9">
          <Link to={target}>
            <LiquidMetalButton label={status === "signed-in" ? "Enter console" : "Enter"} />
          </Link>
        </motion.div>

        <motion.ul {...fade(0.8)} className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {FEATURES.map(({ label, detail }) => (
            <li key={label} className="flex flex-col items-center leading-tight">
              <span className="text-ink text-[11px] font-semibold tracking-[0.2em] uppercase">{label}</span>
              <span className="text-ink-faint mt-1 text-[11px]">{detail}</span>
            </li>
          ))}
        </motion.ul>
      </section>

      <footer className="text-ink-faint absolute inset-x-0 bottom-0 z-10 px-6 py-4 text-center text-[10px] tracking-[0.14em] uppercase">
        Simplified demonstration models — not an official forecast
      </footer>
    </main>
  );
}
