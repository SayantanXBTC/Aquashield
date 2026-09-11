import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackControls } from "../components/PlaybackControls";

function renderControls(overrides: Partial<React.ComponentProps<typeof PlaybackControls>> = {}) {
  const props = {
    isPlaying: false,
    onTogglePlay: vi.fn(),
    playbackSpeed: 1,
    onSpeedChange: vi.fn(),
    frameIndex: 0,
    frameCount: 5,
    onScrub: vi.fn(),
    ...overrides,
  };
  render(<PlaybackControls {...props} />);
  return props;
}

describe("PlaybackControls", () => {
  it("shows 'Play' with aria-pressed=false when not playing, and calls onTogglePlay when clicked", async () => {
    const user = userEvent.setup();
    const props = renderControls({ isPlaying: false });

    const button = screen.getByRole("button", { name: /play playback/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Play");

    await user.click(button);
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("shows 'Pause' with aria-pressed=true when playing", () => {
    renderControls({ isPlaying: true });
    const button = screen.getByRole("button", { name: /pause playback/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Pause");
  });

  it("toggles play/pause via the keyboard (Space) when the button has focus", async () => {
    const user = userEvent.setup();
    const props = renderControls({ isPlaying: false });

    const button = screen.getByRole("button", { name: /play playback/i });
    button.focus();
    await user.keyboard(" ");

    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("renders a speed control per option and marks the active speed", () => {
    renderControls({ playbackSpeed: 2 });
    const activeButton = screen.getByRole("button", { name: "2x" });
    expect(activeButton).toHaveAttribute("aria-pressed", "true");

    const inactiveButton = screen.getByRole("button", { name: "1x" });
    expect(inactiveButton).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSpeedChange with the selected multiplier", async () => {
    const user = userEvent.setup();
    const props = renderControls({ playbackSpeed: 1 });

    await user.click(screen.getByRole("button", { name: "4x" }));
    expect(props.onSpeedChange).toHaveBeenCalledWith(4);
  });

  it("calls onScrub with the numeric frame index when the slider changes", () => {
    const props = renderControls({ frameIndex: 0, frameCount: 5 });
    const slider = screen.getByRole("slider", { name: /timeline frame/i });

    fireEvent.change(slider, { target: { value: "3" } });

    expect(props.onScrub).toHaveBeenCalledWith(3);
  });
});
