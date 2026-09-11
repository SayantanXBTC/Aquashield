import type { RefObject } from "react";
import type { LandingBeat } from "./landingAssets";
import { getSceneDrift, getSceneOpacity, getSceneScale } from "./sceneProgress";

interface ImageStageProps {
  beats: LandingBeat[];
  imageRefs: RefObject<(HTMLDivElement | null)[]>;
}

/**
 * The six narrative images, stacked in the same full-bleed rect rather than
 * six separate scroll cards. CinematicScroll's rAF loop writes
 * opacity/transform to these refs directly every scroll tick; the inline
 * defaults here only cover the first paint (before that loop has run once)
 * so there's no flash of the wrong scene.
 *
 * All six sit in the same viewport rect, so native `loading="lazy"` can't
 * defer by scroll position here the way it would for stacked sections —
 * fetch priority does the deferring instead (only the first scene is
 * "high").
 */
export function ImageStage({ beats, imageRefs }: ImageStageProps) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {beats.map((beat, index) => (
        <div
          key={beat.id}
          ref={(el) => {
            imageRefs.current[index] = el;
          }}
          className="absolute inset-0 will-change-[opacity,transform]"
          style={{
            opacity: getSceneOpacity(0, index, beats.length),
            transform: `scale(${getSceneScale(0, index, beats.length)}) translateY(${getSceneDrift(0, index, beats.length) * 0.4}px)`,
          }}
        >
          <img
            src={beat.src}
            alt={beat.alt}
            className="h-full w-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index === 0 ? "high" : "low"}
          />
        </div>
      ))}
    </div>
  );
}
