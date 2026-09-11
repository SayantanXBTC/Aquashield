import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { LANDING_BEATS } from "@/features/landing/landingAssets";

describe("App", () => {
  it("renders the landing experience at the root route", () => {
    render(<App />);
    expect(screen.getAllByText("AQUASHIELD").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: LANDING_BEATS[0].headline })).toBeInTheDocument();
  });

  it("navigates from the landing page into the explore gateway", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: /continue/i }));

    expect(await screen.findByText(/explore the possibilities/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explore/i })).toBeInTheDocument();
  });
});
