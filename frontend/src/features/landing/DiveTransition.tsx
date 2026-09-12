import { useEffect } from "react";
import { motion } from "framer-motion";

interface DiveTransitionProps {
  /** Viewport point the dive expands from (usually the clicked button). */
  origin: { x: number; y: number };
  reducedMotion: boolean;
  /** Called once the screen is fully covered — the moment to swap routes. */
  onComplete: () => void;
  durationMs?: number;
}

/**
 * Landing → sign-in "dive": a ring of accent light expands from the button
 * the operator pressed, followed by a void-coloured disc that swallows the
 * page, so the gateway can fade in on a blank field (ExploreGatewayPage
 * picks up with its own entrance when routed with `state.entrance = "dive"`).
 * Pure CSS clip-path — no canvas, no three.js, safe in the initial bundle.
 */
export function DiveTransition({ origin, reducedMotion, onComplete, durationMs = 760 }: DiveTransitionProps) {
  const total = reducedMotion ? 220 : durationMs;

  useEffect(() => {
    const id = window.setTimeout(onComplete, total);
    return () => window.clearTimeout(id);
  }, [onComplete, total]);

  if (reducedMotion) {
    return <motion.div className="bg-void fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} />;
  }

  const reach = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y)) * 1.05;
  const at = `${origin.x}px ${origin.y}px`;

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      {/* The disc that swallows the page. */}
      <motion.div
        className="bg-void absolute inset-0"
        initial={{ clipPath: `circle(0px at ${at})` }}
        animate={{ clipPath: `circle(${reach}px at ${at})` }}
        transition={{ duration: (durationMs / 1000) * 0.92, delay: 0.06, ease: [0.7, 0, 0.3, 1] }}
      />
      <motion.div
        className="absolute rounded-full border"
        style={{ left: origin.x, top: origin.y, borderColor: "var(--color-accent-strong)", x: "-50%", y: "-50%" }}
        initial={{ width: 0, height: 0, opacity: 1 }}
        animate={{ width: reach * 2, height: reach * 2, opacity: 0 }}
        transition={{ duration: durationMs / 1000, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}
