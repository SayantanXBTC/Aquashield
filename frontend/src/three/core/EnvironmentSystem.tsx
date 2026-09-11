/**
 * Atmosphere without a network-fetched HDRI: a flat deep-space-blue
 * background plus exponential fog, so distant geometry fades into
 * atmosphere instead of clipping hard at the far plane. Self-contained —
 * no remote asset dependency, so scene load never depends on a third-party
 * CDN being reachable.
 */
export function EnvironmentSystem() {
  return (
    <>
      <color attach="background" args={["#04080d"]} />
      <fogExp2 attach="fog" args={["#050b12", 0.012]} />
    </>
  );
}
