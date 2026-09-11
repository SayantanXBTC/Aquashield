import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LANDING_BEATS } from "./landingAssets";

const reducedMotionState = { value: false };

vi.mock("@/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}));

import { CinematicScroll } from "./CinematicScroll";

afterEach(() => {
  cleanup();
  reducedMotionState.value = false;
  vi.restoreAllMocks();
});

describe("CinematicScroll — reduced motion", () => {
  it("renders every scene's headline statically, with no scroll-driven mechanism attached", () => {
    reducedMotionState.value = true;
    const addSpy = vi.spyOn(window, "addEventListener");

    render(<CinematicScroll />);

    for (const beat of LANDING_BEATS) {
      expect(screen.getByRole("heading", { name: beat.headline })).toBeInTheDocument();
    }
    expect(addSpy.mock.calls.some(([type]) => type === "scroll")).toBe(false);
  });
});

describe("CinematicScroll — full motion", () => {
  it("renders the sticky cinematic stage and all six headlines up front", () => {
    render(<CinematicScroll />);

    for (const beat of LANDING_BEATS) {
      expect(screen.getByRole("heading", { name: beat.headline })).toBeInTheDocument();
    }
    // Only the first scene starts fully visible; the rest wait for scroll.
    const first = screen.getByRole("heading", { name: LANDING_BEATS[0].headline });
    const second = screen.getByRole("heading", { name: LANDING_BEATS[1].headline });
    expect(first.closest("div")?.parentElement).toHaveStyle({ opacity: "1" });
    expect(second.closest("div")?.parentElement).toHaveStyle({ opacity: "0" });
  });

  it("attaches a scroll listener on mount and removes it on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<CinematicScroll />);
    expect(addSpy.mock.calls.some(([type]) => type === "scroll")).toBe(true);

    unmount();
    expect(removeSpy.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });
});
