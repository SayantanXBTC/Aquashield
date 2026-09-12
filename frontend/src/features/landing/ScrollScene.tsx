import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import type { LandingScene } from "./scenes";

interface ScrollSceneProps {
  scene: LandingScene;
  index: number;
  total: number;
  reducedMotion: boolean;
  /** Extra content rendered under the copy (the final scene's CTA). */
  children?: ReactNode;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * One full-viewport photographic scene in the landing scroll.
 *
 * Layout trick: the outer "slot" is a normal 100vh block in the flow; the
 * inner panel is `position: sticky; top: 0`. Because every panel sticks to
 * the same top edge and later siblings paint over earlier ones, each new
 * scene slides up and *covers* the previous one instead of pushing it away.
 * All scroll maths is measured against the slot (never the sticky panel,
 * whose rect moves while stuck), so the numbers stay stable on resize.
 *
 * Progress for a scene runs 0 → 1 from "slot top enters at viewport bottom"
 * to "slot bottom leaves at viewport top":
 *   0.0 – 0.5  the scene rises into place
 *   0.5 – 1.0  the next scene rises over it (this one recedes and darkens)
 * The hero (index 0) is already in place on load, so it only recedes.
 */
export function ScrollScene({ scene, index, total, reducedMotion, children }: ScrollSceneProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: slotRef, offset: ["start end", "end start"] });
  const isHero = index === 0;
  const isLast = index === total - 1;

  // Image: settles from a slight zoom while entering, then pushes back and
  // drifts upward while being covered — a cheap parallax that reads as depth.
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [isHero ? 1 : 1.18, 1, 1.12]);
  const imageY = useTransform(scrollYProgress, [0.5, 1], ["0%", "-12%"]);
  const shade = useTransform(scrollYProgress, [0.5, 0.85], [0, 0.78]);

  // Text: rises in a beat after the image, holds, then fades as it's covered.
  const textOpacity = useTransform(scrollYProgress, isHero ? [0.5, 0.7] : [0.32, 0.5, 0.62, 0.8], isHero ? [1, 0] : [0, 1, 1, 0]);
  const textY = useTransform(scrollYProgress, isHero ? [0.5, 0.8] : [0.32, 0.5, 0.7, 0.9], isHero ? [0, -60] : [56, 0, 0, -40]);
  // Rim: the thin bright edge that leads each incoming scene.
  const rimOpacity = useTransform(scrollYProgress, [0.05, 0.42, 0.5], [0.9, 0.9, 0]);

  const still = reducedMotion ? { scale: 1, y: "0%" } : undefined;

  return (
    <div ref={slotRef} id={scene.id} className="relative h-screen" style={{ zIndex: index + 1 }}>
      <section
        aria-label={scene.eyebrow}
        className="bg-void sticky top-0 h-screen w-full overflow-hidden"
        style={{ boxShadow: "0 -40px 80px rgba(5,8,11,0.55)" }}
      >
        <motion.div
          className="absolute inset-0"
          initial={isHero && !reducedMotion ? { scale: 1.12, filter: "brightness(0.3)" } : false}
          animate={isHero && !reducedMotion ? { scale: 1, filter: "brightness(1)" } : undefined}
          transition={{ duration: 2.6, ease: EASE_OUT }}
        >
          <motion.img
            src={scene.image}
            alt={scene.alt}
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover will-change-transform"
            style={{ objectPosition: scene.focus, scale: imageScale, y: imageY, ...still }}
          />
        </motion.div>

        {/* Legibility grade: bottom-weighted vignette plus a cool tint that
            pulls every photograph toward the console's palette. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,8,11,0.55) 0%, rgba(5,8,11,0.08) 32%, rgba(5,8,11,0.18) 60%, rgba(5,8,11,0.92) 100%)",
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{ background: "rgba(10, 40, 56, 0.28)" }} />
        {/* Darkens as the next scene covers this one. */}
        <motion.div aria-hidden="true" className="bg-void pointer-events-none absolute inset-0" style={{ opacity: shade }} />
        {/* Leading edge. */}
        {!isHero ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ opacity: rimOpacity, background: "linear-gradient(90deg, transparent, var(--color-accent-strong) 30%, var(--color-accent-strong) 70%, transparent)" }}
          />
        ) : null}

        {isHero ? (
          <HeroCopy scene={scene} reducedMotion={reducedMotion} opacity={textOpacity} y={textY} />
        ) : (
          <motion.div
            className={`absolute inset-x-0 ${isLast ? "bottom-[14vh]" : "bottom-[12vh]"} z-10 flex flex-col items-start px-6 md:px-16 lg:px-24`}
            style={{ opacity: textOpacity, y: textY }}
          >
            <span className="text-accent-strong text-[11px] font-semibold tracking-[0.32em] uppercase">{scene.eyebrow}</span>
            <h2 className="text-ink font-display mt-4 max-w-4xl text-4xl leading-[1.02] font-semibold tracking-[-0.025em] text-balance md:text-6xl lg:text-7xl">
              {scene.title}
            </h2>
            <p className="text-ink-soft mt-5 max-w-xl text-sm leading-relaxed md:text-lg">{scene.copy}</p>
            {children ? <div className="mt-9">{children}</div> : null}
          </motion.div>
        )}

        <span className="text-ink-faint absolute right-6 bottom-6 z-10 font-mono text-[11px] tracking-[0.2em] md:right-10">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </section>
    </div>
  );
}

interface HeroCopyProps {
  scene: LandingScene;
  reducedMotion: boolean;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}

/** The opening frame: the wordmark, letter by letter, then the strapline. */
function HeroCopy({ scene, reducedMotion, opacity, y }: HeroCopyProps) {
  const letters = Array.from(scene.title);
  const reveal = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.9, delay, ease: EASE_OUT },
        };

  return (
    <motion.div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center" style={{ opacity, y }}>
      <motion.span {...reveal(0.5)} className="text-accent-strong text-[11px] font-semibold tracking-[0.34em] uppercase md:text-xs">
        {scene.eyebrow}
      </motion.span>
      <h1
        className="text-ink font-display mt-6 flex text-[13vw] leading-none font-bold tracking-[0.18em] md:text-[9vw] lg:text-[8vw]"
        aria-label={scene.title}
      >
        {letters.map((letter, i) => (
          <motion.span
            key={`${letter}-${i}`}
            aria-hidden="true"
            className="inline-block"
            {...(reducedMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 40, filter: "blur(10px)" },
                  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                  transition: { duration: 1.1, delay: 0.7 + i * 0.07, ease: EASE_OUT },
                })}
          >
            {letter}
          </motion.span>
        ))}
      </h1>
      <motion.p {...reveal(1.6)} className="text-ink-soft mt-6 text-base md:text-xl">
        {scene.copy}
      </motion.p>
      <motion.div {...reveal(2.2)} className="absolute bottom-10 flex flex-col items-center gap-3">
        <span className="text-ink-faint text-[10px] tracking-[0.3em] uppercase">Scroll</span>
        <span className="relative block h-12 w-px overflow-hidden bg-white/15">
          <motion.span
            className="bg-accent-strong absolute inset-x-0 top-0 h-5"
            animate={reducedMotion ? undefined : { y: ["-100%", "260%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </motion.div>
    </motion.div>
  );
}
