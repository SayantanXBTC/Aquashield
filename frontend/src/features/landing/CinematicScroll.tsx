import { useRef, useState } from "react";
import { SectionLabel } from "@/components/ui";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ImageStage } from "./ImageStage";
import { LANDING_BEATS } from "./landingAssets";
import { NarrativeTypography } from "./NarrativeTypography";
import { OverlayGradient } from "./OverlayGradient";
import { ProgressIndicator } from "./ProgressIndicator";
import { useScrollDriver } from "./ScrollDriver";
import { getActiveIndex, getSceneDrift, getSceneOpacity, getSceneScale } from "./sceneProgress";

const SCENE_COUNT = LANDING_BEATS.length;
// Extra scroll distance per scene beyond one viewport height, so the
// crossfade window (sceneProgress.ts) has room to play out instead of
// snapping between scenes on a single wheel tick.
const SCROLL_HEIGHT_VH = SCENE_COUNT * 140;

/**
 * The cinematic scroll-driven landing stage (Prompt 8.1 §5): one sticky
 * viewport whose image/text/progress children are driven by a single
 * normalized scroll progress value, replacing the earlier stacked-section
 * parallax (`ScrollSequence`/`LandingBeatSection`, removed). Progress is
 * applied by direct style mutation on refs, not React state, so a scroll
 * frame never triggers a re-render — see ScrollDriver.ts and
 * sceneProgress.ts for the two halves of that pipeline.
 *
 * Under `prefers-reduced-motion`, the whole scroll-linked mechanism is
 * skipped in favor of a plain stacked, always-visible layout — no
 * scroll-scrubbed transforms, nothing conveyed only through motion.
 */
export function CinematicScroll() {
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useScrollDriver(containerRef, (progress) => {
    for (let i = 0; i < SCENE_COUNT; i++) {
      const opacity = getSceneOpacity(progress, i, SCENE_COUNT);
      const drift = getSceneDrift(progress, i, SCENE_COUNT);

      const image = imageRefs.current[i];
      if (image) {
        const scale = getSceneScale(progress, i, SCENE_COUNT);
        image.style.opacity = String(opacity);
        image.style.transform = `scale(${scale}) translateY(${drift * 0.4}px)`;
      }

      const text = textRefs.current[i];
      if (text) {
        text.style.opacity = String(opacity);
        text.style.transform = `translateY(${drift}px)`;
      }
    }

    if (lineRef.current) lineRef.current.style.width = `${progress * 100}%`;

    const nextIndex = getActiveIndex(progress, SCENE_COUNT);
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }
  });

  if (reducedMotion) {
    return (
      <div className="bg-void">
        {LANDING_BEATS.map((beat) => (
          <section
            key={beat.id}
            className="relative flex h-screen w-full items-end overflow-hidden md:items-center"
            aria-label={`${beat.eyebrow}: ${beat.headline}`}
          >
            <img
              src={beat.src}
              alt={beat.alt}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="from-void/90 via-void/50 absolute inset-0 bg-gradient-to-t to-transparent" aria-hidden="true" />
            <div className="relative z-10 max-w-xl px-6 pb-16 md:px-16 md:pb-0">
              <SectionLabel>{beat.eyebrow}</SectionLabel>
              <h2 className="text-ink font-display mt-3 text-3xl leading-[1.1] font-semibold md:text-5xl">
                {beat.headline}
              </h2>
              <p className="text-ink-soft mt-4 max-w-md text-sm md:text-base">{beat.body}</p>
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ height: `${SCROLL_HEIGHT_VH}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <ImageStage beats={LANDING_BEATS} imageRefs={imageRefs} />
        <OverlayGradient />
        <NarrativeTypography beats={LANDING_BEATS} textRefs={textRefs} />
        <ProgressIndicator activeIndex={activeIndex} count={SCENE_COUNT} lineRef={lineRef} />
      </div>
    </div>
  );
}
