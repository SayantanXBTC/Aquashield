import "@testing-library/jest-dom/vitest";

// jsdom implements neither matchMedia nor ResizeObserver. Both are used
// broadly by this phase's real code (usePrefersReducedMotion; Anime.js's
// ScrollObserver, which watches its scroll container's size) — every test
// that mounts a component using them needs these, not just one feature's
// tests, so they're installed globally here rather than per-test-file.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!("ResizeObserver" in window)) {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  // @ts-expect-error -- jsdom has no ResizeObserver; this is a minimal test-only stand-in
  window.ResizeObserver = MockResizeObserver;
}

// jsdom has no Web Animations API. framer-motion drives scroll-linked
// transforms (the landing page's `useScroll` + `useTransform` values)
// through `element.animate()` without feature-detecting it first, so mount
// would throw. This inert stand-in makes those animations no-ops in tests.
if (typeof Element.prototype.animate !== "function") {
  Element.prototype.animate = function animate() {
    const stub = {
      currentTime: 0,
      startTime: 0,
      playbackRate: 1,
      playState: "idle",
      timeline: null,
      onfinish: null,
      effect: { getComputedTiming: () => ({ duration: 0 }), updateTiming: () => {} },
      play: () => {},
      pause: () => {},
      cancel: () => {},
      finish: () => {},
      commitStyles: () => {},
      finished: Promise.resolve(),
    };
    return stub as unknown as Animation;
  };
}
