import type { RefObject } from "react";
import { SectionLabel } from "@/components/ui";
import type { LandingBeat } from "./landingAssets";
import { getSceneDrift, getSceneOpacity } from "./sceneProgress";

interface NarrativeTypographyProps {
  beats: LandingBeat[];
  textRefs: RefObject<(HTMLDivElement | null)[]>;
}

/**
 * The per-scene eyebrow/headline/body, stacked and crossfaded on the same
 * curve as ImageStage (one shared transition language across image and
 * text, per Prompt 8.1 "typography transitions with scenes" — not a
 * separately-timed effect).
 */
export function NarrativeTypography({ beats, textRefs }: NarrativeTypographyProps) {
  return (
    <div className="relative z-10 h-full w-full">
      {beats.map((beat, index) => (
        <div
          key={beat.id}
          ref={(el) => {
            textRefs.current[index] = el;
          }}
          className="absolute inset-0 flex items-end px-6 pb-24 will-change-[opacity,transform] md:items-center md:pb-0 md:pl-16"
          style={{
            opacity: getSceneOpacity(0, index, beats.length),
            transform: `translateY(${getSceneDrift(0, index, beats.length)}px)`,
          }}
        >
          <div className="max-w-xl">
            <SectionLabel>{beat.eyebrow}</SectionLabel>
            <h2 className="text-ink font-display mt-3 text-3xl leading-[1.1] font-semibold md:text-5xl">
              {beat.headline}
            </h2>
            <p className="text-ink-soft mt-4 max-w-md text-sm md:text-base">{beat.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
