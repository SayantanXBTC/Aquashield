import { useEffect, useMemo, useSyncExternalStore } from "react";
import { PlaybackClock, type PlaybackState } from "./playbackClock";

/** Creates the clock once per command-center mount and drives it with rAF
 * (independent of the Canvas so playback keeps working if WebGL fails). */
export function usePlaybackClock(): PlaybackClock {
  const clock = useMemo(() => new PlaybackClock(), []);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const delta = Math.min(0.25, (now - last) / 1000);
      last = now;
      clock.tick(delta);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return clock;
}

export function usePlaybackState(clock: PlaybackClock): PlaybackState {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
}
