import { useEffect, useRef } from "react";
import { cleanupAnimations } from "@/animations/cleanup";
import { onSectionInView, linkScrollProgress } from "@/animations/scroll";
import { staggerIn, staggerOut } from "@/animations/stagger";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SectionLabel } from "@/components/ui";
import type { LandingBeat } from "./landingAssets";

interface LandingBeatSectionProps {
  beat: LandingBeat;
  index: number;
}

/**
 * One full-viewport beat of the cinematic scroll sequence: a scroll-scrubbed
 * background parallax scale (Anime.js `linkScrollProgress`) plus a
 * threshold-triggered text stagger reveal (`onSectionInView`). Every
 * ScrollObserver/animation this creates is reverted on unmount — see
 * animations/cleanup.ts.
 */
export function LandingBeatSection({ beat, index }: LandingBeatSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    const text = textRef.current;
    if (!section || !image || !text) return;

    const textItems = text.querySelectorAll("[data-reveal]");
    const revealDistance = reducedMotion ? 0 : 16;
    const scrollObserver = reducedMotion
      ? null
      : linkScrollProgress(image, section, { scale: [1.12, 1] });
    const sectionObserver = onSectionInView(section, {
      onEnter: () => staggerIn(textItems, { delayEach: 80, distance: revealDistance }),
      onLeave: () => staggerOut(textItems, { delayEach: 30, distance: revealDistance }),
    });

    // The first beat is already on screen at load — it won't receive a
    // scroll "enter" event, so reveal it directly rather than leaving it
    // stuck at opacity 0 until the user scrolls away and back.
    if (index === 0) {
      staggerIn(textItems, { delayEach: 80, distance: revealDistance, startDelay: 200 });
    }

    return () => cleanupAnimations(scrollObserver, sectionObserver);
  }, [reducedMotion, index]);

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen w-full items-end overflow-hidden md:items-center"
      aria-label={`${beat.eyebrow}: ${beat.headline}`}
    >
      <div ref={imageRef} className="absolute inset-0">
        <img
          src={beat.src}
          alt={beat.alt}
          className="h-full w-full object-cover"
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index === 0 ? "high" : "auto"}
        />
        <div className="from-void/90 via-void/40 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="from-void/70 absolute inset-0 bg-gradient-to-r to-transparent" />
      </div>

      <div ref={textRef} className="relative z-10 max-w-xl px-6 pb-16 md:px-16 md:pb-0">
        <div data-reveal className="opacity-0">
          <SectionLabel>{beat.eyebrow}</SectionLabel>
        </div>
        <h2 data-reveal className="text-ink font-display mt-3 text-3xl leading-[1.1] font-semibold opacity-0 md:text-5xl">
          {beat.headline}
        </h2>
        <p data-reveal className="text-ink-soft mt-4 max-w-md text-sm opacity-0 md:text-base">
          {beat.body}
        </p>
      </div>
    </section>
  );
}
