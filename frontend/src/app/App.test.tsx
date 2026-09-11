import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders the app shell heading and the scenario list", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /^aquashield$/i, level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /scenarios/i })).toBeInTheDocument();
  });
});
