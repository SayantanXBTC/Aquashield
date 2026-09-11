import { useEffect, useRef } from "react";
import { LiquidMetalButton } from "@/components/ui";
import { cleanupAnimations } from "@/animations/cleanup";
import { revealText } from "@/animations/transitions";
import { onSectionInView } from "@/animations/scroll";

interface ExploreTransitionProps {
  onExplore: () => void;
}

/** The deliberate gateway screen between the scroll sequence and the
 * command center — its own full-viewport beat, not a fake placeholder. */
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
      className="bg-void relative flex h-screen w-full flex-col items-center justify-center gap-8 px-6 text-center"
    >
      <div ref={textRef} className="flex flex-col items-center gap-3 opacity-0">
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
