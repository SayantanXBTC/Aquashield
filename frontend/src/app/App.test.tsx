import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

// R3F's <Canvas> needs a real WebGL context, unavailable in jsdom — mocked
// out here since this is a smoke test of the Vitest/RTL pipeline, not the
// 3D subsystem (which has no application scene to test yet).
vi.mock("@/three/core/BootstrapCanvas", () => ({
  BootstrapCanvas: () => null,
}));

describe("App", () => {
  it("renders the bootstrap heading", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /aquashield — bootstrap/i }),
    ).toBeInTheDocument();
  });
});
