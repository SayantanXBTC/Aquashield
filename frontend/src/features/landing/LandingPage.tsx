import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { IconShield } from "@/components/ui/icons";
import { LiquidMetalButton } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { DiveTransition } from "./DiveTransition";
import { LANDING_SCENES } from "./scenes";
import { ScrollScene } from "./ScrollScene";
import { WarpTransition } from "./WarpTransition";

type Departure = { kind: "dive"; origin: { x: number; y: number } } | { kind: "warp" } | null;

/**
 * The landing route ("/"): six full-viewport photographic scenes that stack
 * as the operator scrolls — the wordmark first, then one scene per stage of
 * the platform, ending on the sign-in call to action. The final button
 * dives into the sign-in gateway, or warps straight into the command center
 * when a session is already active. Nothing here imports three/ or the
 * command-center feature — this is the initial bundle (CLAUDE.md §27).
 */
export function LandingPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const signedIn = status === "signed-in";
  const [departure, setDeparture] = useState<Departure>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(LANDING_SCENES.length - 1, Math.round(value * (LANDING_SCENES.length - 1)));
    setActive((current) => (current === next ? current : next));
  });

  // The page starts at the hero (even after a soft navigation back) unless
  // the URL names a scene by hash — the scenes mount after the browser's own
  // hash scroll has already run, so it's repeated here.
  useEffect(() => {
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) target.scrollIntoView({ behavior: "auto" });
    else window.scrollTo({ top: 0 });
  }, []);

  const depart = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (departure) return;
      if (signedIn) {
        setDeparture({ kind: "warp" });
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      setDeparture({ kind: "dive", origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } });
    },
    [departure, signedIn],
  );

  const handleDiveComplete = useCallback(() => navigate("/explore", { state: { entrance: "dive" } }), [navigate]);
  const handleWarpComplete = useCallback(() => navigate("/command-center", { state: { entrance: "warp" } }), [navigate]);

  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

  return (
    <main className="bg-void text-ink relative">
      <div className="relative">
        {LANDING_SCENES.map((scene, index) => (
          <ScrollScene key={scene.id} scene={scene} index={index} total={LANDING_SCENES.length} reducedMotion={reducedMotion}>
            {index === LANDING_SCENES.length - 1 ? (
              <div className="flex flex-col items-start gap-5">
                <LiquidMetalButton
                  label={signedIn ? "Enter the console" : "Sign in to explore"}
                  onClick={depart}
                  disabled={departure !== null}
                  aria-busy={departure !== null}
                />
                <span className="text-ink-faint text-[10px] tracking-[0.18em] uppercase">
                  Simplified demonstration models — not an official forecast
                </span>
              </div>
            ) : null}
          </ScrollScene>
        ))}
      </div>

      {/* Chrome: fixed above every scene. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 md:px-10">
        <button
          type="button"
          onClick={() => jumpTo("hero")}
          className="text-ink pointer-events-auto flex cursor-pointer items-center gap-2.5"
          aria-label="Back to top"
        >
          <IconShield size={18} className="text-accent" />
          <span className="text-xs font-bold tracking-[0.26em]">AQUASHIELD</span>
        </button>
        <Link
          to={signedIn ? "/command-center" : "/explore"}
          className="border-hairline-strong bg-surface/60 text-ink hover:bg-surface-active pointer-events-auto rounded-[var(--radius-control)] border px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase backdrop-blur-sm transition-colors"
        >
          {signedIn ? "Console" : "Sign in"}
        </Link>
      </header>

      {/* Progress: a hairline that fills with the scroll, and one dot per scene. */}
      <motion.div aria-hidden="true" className="bg-accent-strong fixed top-0 left-0 z-40 h-px w-full origin-left" style={{ scaleX: progress }} />
      <nav aria-label="Scenes" className="fixed top-1/2 right-5 z-40 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        {LANDING_SCENES.map((scene, index) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => jumpTo(scene.id)}
            aria-label={scene.eyebrow}
            aria-current={active === index ? "true" : undefined}
            className="group flex cursor-pointer items-center justify-end gap-2"
          >
            <span
              className={`text-[10px] tracking-[0.2em] uppercase transition-opacity ${active === index ? "text-ink opacity-100" : "text-ink-faint opacity-0 group-hover:opacity-100"}`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`block h-px transition-all duration-300 ${active === index ? "bg-accent-strong w-7" : "bg-ink-faint/60 w-3 group-hover:w-5"}`}
            />
          </button>
        ))}
      </nav>

      {departure?.kind === "dive" ? (
        <DiveTransition origin={departure.origin} reducedMotion={reducedMotion} onComplete={handleDiveComplete} />
      ) : null}
      {departure?.kind === "warp" ? <WarpTransition onComplete={handleWarpComplete} /> : null}
    </main>
  );
}
