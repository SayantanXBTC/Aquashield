import { useEffect, useRef } from "react";
import { LiquidMetalButton } from "@/components/ui";
import { cleanupAnimations } from "@/animations/cleanup";
import { revealText } from "@/animations/transitions";
import { onSectionInView } from "@/animations/scroll";
import backdrop from "@/assets/landing/image5.jpg";

interface ExploreTransitionProps {
  onExplore: () => void;
}

/**
 * The deliberate gateway screen between the scroll sequence and the
 * command center — its own full-viewport beat, not a fake placeholder.
 * Backed by the same cyclone-from-orbit asset used in the landing scroll
 * (`landingAssets.ts`'s "cyclone" beat, `image5.jpg`) rather than a flat
 * void, so the gateway still reads as part of one continuous visual world
 * instead of dropping to a bare text screen — no new or substitute image.
 */
export function ExploreTransition({ onExplore }: ExploreTransitionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const text = textRef.current;
    if (!section || !text) return;
    const observer = onSectionInView(section, { onEnter: () => revealText(text) });
    return () => cleanupAnimations(observer);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-void relative flex h-screen w-full flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center"
    >
      <img
        src={backdrop}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40"
        loading="eager"
        decoding="async"
      />
      <div className="from-void via-void/85 absolute inset-0 bg-gradient-to-t to-transparent" aria-hidden="true" />
      <div className="from-void/60 absolute inset-0 bg-gradient-to-b to-transparent" aria-hidden="true" />

      <div ref={textRef} className="relative z-10 flex flex-col items-center gap-3 opacity-0">
        <span className="text-accent-strong text-xs font-semibold tracking-[0.3em] uppercase">
          Explore the possibilities
        </span>
        <h2 className="text-ink font-display max-w-lg text-2xl font-semibold md:text-4xl">
          Enter the AQUASHIELD command center
        </h2>
      </div>
      <LiquidMetalButton label="Explore" onClick={onExplore} />
    </section>
  );
}
