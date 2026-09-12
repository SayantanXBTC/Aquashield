import { CommandButton, IconButton } from "@/components/ui";
import { IconPause, IconPlay, IconSkipStart } from "@/components/ui/icons";
import { PLAYBACK_SPEEDS, type PlaybackClock } from "../playback/playbackClock";
import { usePlaybackState } from "../playback/usePlaybackClock";

interface PlaybackBarProps {
  clock: PlaybackClock;
  disabled: boolean;
  /** Recorded-run key events (sim minutes) to mark on the scrubber. */
  markers?: number[];
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Transport + scrubber for the simulation clock. Purely client-side; speed
 * multipliers are a UI pacing convenience (playback/playbackClock.ts). */
export function PlaybackBar({ clock, disabled, markers = [] }: PlaybackBarProps) {
  const state = usePlaybackState(clock);
  const progress = state.durationMinutes > 0 ? state.elapsedMinutes / state.durationMinutes : 0;

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-[8px] border border-white/[0.07] bg-[rgba(9,14,20,0.66)] px-3 py-2.5 shadow-[0_18px_48px_-18px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <div className="relative">
        <input
          type="range"
          min={0}
          max={state.durationMinutes}
          step={0.5}
          value={state.elapsedMinutes}
          disabled={disabled}
          aria-label="Simulation clock"
          onChange={(e) => clock.seek(Number(e.target.value))}
          className="relative z-10 disabled:opacity-40"
        />
        {/* Progress fill + key-event ticks under the native track. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full">
          <div className="bg-accent/70 h-full rounded-full" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          {markers.map((m) => (
            <span
              key={m}
              className="bg-status-critical absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full"
              style={{ left: `${Math.min(100, (m / state.durationMinutes) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <IconButton label="Restart" icon={<IconSkipStart size={14} />} disabled={disabled} onClick={() => clock.restart()} />
        <CommandButton
          tone="accent"
          disabled={disabled}
          onClick={() => clock.toggle()}
          aria-pressed={state.playing}
          aria-label={state.playing ? "Pause" : "Play"}
          className="px-4"
        >
          {state.playing ? <IconPause size={14} /> : <IconPlay size={14} />}
          {state.playing ? "Pause" : "Play"}
        </CommandButton>
        <span className="text-ink ml-1 font-mono text-[12px]">
          T+{fmt(state.elapsedMinutes)}
          <span className="text-ink-faint"> / {fmt(state.durationMinutes)}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          {PLAYBACK_SPEEDS.map((speed) => (
            <CommandButton
              key={speed}
              size="sm"
              tone={state.speed === speed ? "accent" : "ghost"}
              aria-pressed={state.speed === speed}
              disabled={disabled}
              onClick={() => clock.setSpeed(speed)}
            >
              {speed}x
            </CommandButton>
          ))}
        </div>
      </div>
    </div>
  );
}
