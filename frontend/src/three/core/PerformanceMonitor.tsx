import { Stats } from "@react-three/drei";

/** Dev-only frame-time readout — never rendered in production, and only in
 * dev when explicitly requested (`?debug=1`), so it costs nothing by
 * default. "Measure rather than guess" (Prompt 8 §Performance). */
export function PerformanceMonitor() {
  const debugRequested = import.meta.env.DEV && new URLSearchParams(window.location.search).has("debug");
  if (!debugRequested) return null;
  return <Stats />;
}
