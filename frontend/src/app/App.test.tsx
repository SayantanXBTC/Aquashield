import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

// jsdom has no WebGL2 — the fluid backdrop bails out silently when
// getContext returns null, which is exactly what happens here.
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
// jsdom implements neither smooth scrolling nor IntersectionObserver.
vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
window.scrollTo = () => {};

// The test must not depend on whether a developer's .env.local carries a
// real Firebase config: force the "unconfigured" path.
vi.mock("@/features/auth/firebase", () => ({
  isFirebaseConfigured: false,
  MISSING_FIREBASE_CONFIG_MESSAGE: "Firebase is not configured.",
  getFirebaseAuth: () => {
    throw new Error("Firebase is not configured.");
  },
}));

describe("App", () => {
  it("renders the landing page at the root route", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "AQUASHIELD" })).toBeInTheDocument();
    expect(screen.getByText(/see the water coming/i)).toBeInTheDocument();
    // All six photographic scenes are in the document, hero first.
    expect(screen.getAllByRole("img")).toHaveLength(6);
    expect(screen.getByRole("button", { name: /sign in to explore/i })).toBeInTheDocument();
  });

  it("navigates from the landing page into the sign-in gateway", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: /^sign in$/i }));
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    // Firebase is unconfigured in tests: the card says so instead of crashing.
    expect(screen.getByRole("alert")).toHaveTextContent(/firebase is not configured/i);
  });
});
