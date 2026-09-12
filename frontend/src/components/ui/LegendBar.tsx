interface LegendBarProps {
  title: string;
  /** Ordered tick labels under the ramp. These are the *visual* mapping's
   * own stops (three/utils/colorRamp.ts / the disaster visualizer), not a
   * measured data range — a caller must not pass real-looking values it
   * doesn't have. */
  stops: string[];
  from: string;
  to: string;
}

/**
 * The viewport's color-ramp key. Every continuous color mapping shown in the
 * 3D scene has to be readable off a legend — a color with no key is an
 * unlabelled measurement.
 */
export function LegendBar({ title, stops, from, to }: LegendBarProps) {
  return (
    <div className="flex min-w-[168px] flex-col gap-1.5">
      <span className="text-ink-faint text-[10px] tracking-[0.12em] uppercase">{title}</span>
      <div
        className="border-hairline h-1.5 w-full rounded-full border"
        style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
      <div className="text-ink-faint flex justify-between font-mono text-[9px]">
        {stops.map((stop) => (
          <span key={stop}>{stop}</span>
        ))}
      </div>
    </div>
  );
}
