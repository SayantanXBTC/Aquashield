import { CommandButton } from "@/components/ui";

/**
 * Speed multipliers offered in the UI. These are a playback-pacing
 * convenience, not a physical/simulated timing value — see
 * `useCommandCenterSession.ts`'s `PLAYBACK_BASE_INTERVAL_MS` for how a
 * multiplier maps to an actual interval.
 */
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  frameIndex: number;
  frameCount: number;
  onScrub: (index: number) => void;
}

/**
 * Play/pause/speed/scrub controls for an already-fetched TimelineFrame[]
 * (Prompt 9). Purely client-side: no WebSocket, no backend timing — see
 * `useCommandCenterSession.ts` for the interval model this drives. Only
 * ever rendered by `SimulationStatusPanel` when `frameCount > 0`; the
 * "Awaiting playback data" empty state for a completed-but-frameless run is
 * handled entirely by the caller and untouched by this component.
 */
export function PlaybackControls({
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
  frameIndex,
  frameCount,
  onScrub,
}: PlaybackControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* A native <button> already responds to Space/Enter with its
         * default click behavior — this deliberately doesn't add its own
         * keydown handler, so Space only ever toggles playback when this
         * specific button has focus, never globally on the page. */}
        <CommandButton
          tone="accent"
          onClick={onTogglePlay}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Pause playback" : "Play playback"}
        >
          {isPlaying ? "Pause" : "Play"}
        </CommandButton>
        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          {PLAYBACK_SPEEDS.map((speed) => (
            <CommandButton
              key={speed}
              tone={speed === playbackSpeed ? "accent" : "default"}
              aria-pressed={speed === playbackSpeed}
              onClick={() => onSpeedChange(speed)}
              className="px-2 py-1"
            >
              {speed}x
            </CommandButton>
          ))}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(frameCount - 1, 0)}
        value={frameIndex}
        onChange={(event) => onScrub(Number(event.target.value))}
        aria-label="Timeline frame"
        className="accent-accent w-full"
      />
    </div>
  );
}
