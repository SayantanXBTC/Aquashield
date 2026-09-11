import { LANDING_BEATS } from "./landingAssets";
import { LandingBeatSection } from "./LandingBeatSection";

/** The six-beat cinematic scroll sequence — native document scroll, not
 * scroll-jacked, so it stays keyboard/screen-reader/reduced-motion
 * friendly by default. */
export function ScrollSequence() {
  return (
    <div>
      {LANDING_BEATS.map((beat, index) => (
        <LandingBeatSection key={beat.id} beat={beat} index={index} />
      ))}
    </div>
  );
}
