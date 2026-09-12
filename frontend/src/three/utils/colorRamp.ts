import { Color } from "three";

/** Linear color interpolation for intensity-driven hazard visuals — a
 * rendering convenience shared by every disaster visualizer, not a
 * scientific color scale. */
export function rampColor(colorA: string, colorB: string, t: number): string {
  const a = new Color(colorA);
  const b = new Color(colorB);
  const out = new Color();
  out.lerpColors(a, b, Math.max(0, Math.min(1, t)));
  return `#${out.getHexString()}`;
}
