/**
 * The command center's playback clock — a tiny external store (no React
 * state) so the 3D scene can read `elapsedMinutes` every frame while the
 * HUD subscribes at a throttled rate.
 *
 * Pacing is a UI convenience, not a physical claim: at 1x, one real second
 * advances the simulation clock by SIM_MINUTES_PER_REAL_SECOND minutes.
 */
export const SIM_MINUTES_PER_REAL_SECOND = 2;
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;
const NOTIFY_INTERVAL_MS = 100;

export interface PlaybackState {
  elapsedMinutes: number;
  durationMinutes: number;
  playing: boolean;
  speed: number;
}

type Listener = () => void;

export class PlaybackClock {
  private state: PlaybackState = { elapsedMinutes: 0, durationMinutes: 360, playing: false, speed: 1 };
  private listeners = new Set<Listener>();
  private lastNotify = 0;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PlaybackState => this.state;

  /** Frame-rate read for the scene — no allocation, no subscription. */
  get elapsedMinutes(): number {
    return this.state.elapsedMinutes;
  }

  private set(next: Partial<PlaybackState>, force = true): void {
    this.state = { ...this.state, ...next };
    const now = performance.now();
    if (force || now - this.lastNotify > NOTIFY_INTERVAL_MS) {
      this.lastNotify = now;
      for (const l of this.listeners) l();
    }
  }

  /** Advance by real seconds; auto-pauses at the end. */
  tick(deltaSeconds: number): void {
    if (!this.state.playing) return;
    const next = this.state.elapsedMinutes + deltaSeconds * this.state.speed * SIM_MINUTES_PER_REAL_SECOND;
    if (next >= this.state.durationMinutes) {
      this.set({ elapsedMinutes: this.state.durationMinutes, playing: false });
    } else {
      this.set({ elapsedMinutes: next }, false);
    }
  }

  play(): void {
    if (this.state.elapsedMinutes >= this.state.durationMinutes) this.set({ elapsedMinutes: 0 });
    this.set({ playing: true });
  }
  pause(): void {
    this.set({ playing: false });
  }
  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }
  seek(minutes: number): void {
    this.set({ elapsedMinutes: Math.max(0, Math.min(this.state.durationMinutes, minutes)) });
  }
  restart(): void {
    this.set({ elapsedMinutes: 0 });
  }
  setSpeed(speed: number): void {
    this.set({ speed });
  }
  setDuration(minutes: number): void {
    const durationMinutes = Math.max(1, minutes);
    this.set({ durationMinutes, elapsedMinutes: Math.min(this.state.elapsedMinutes, durationMinutes) });
  }
}
