import { describe, expect, it } from "vitest";
import { formatRunFrameSummary, formatRunOptionLabel, formatRunTimestamp } from "../utils/runFormatting";

describe("formatRunFrameSummary", () => {
  it("shows the real frame count for a completed run with frames", () => {
    expect(formatRunFrameSummary({ status: "completed", frame_count: 25 })).toBe("25 frames");
  });

  it("uses singular phrasing for exactly one frame", () => {
    expect(formatRunFrameSummary({ status: "completed", frame_count: 1 })).toBe("1 frame");
  });

  it("never fabricates a count for a completed run with zero frames", () => {
    expect(formatRunFrameSummary({ status: "completed", frame_count: 0 })).toBe("No playback data available");
  });

  it("never fabricates a count for a completed run with a null frame_count", () => {
    expect(formatRunFrameSummary({ status: "completed", frame_count: null })).toBe("No playback data available");
  });

  it("reads 'No playback data available' for a pending run", () => {
    expect(formatRunFrameSummary({ status: "pending", frame_count: null })).toBe("No playback data available");
  });

  it("reads 'No playback data available' for a running run", () => {
    expect(formatRunFrameSummary({ status: "running", frame_count: null })).toBe("No playback data available");
  });

  it("reads 'No playback data available' for a failed run", () => {
    expect(formatRunFrameSummary({ status: "failed", frame_count: null })).toBe("No playback data available");
  });
});

describe("formatRunOptionLabel", () => {
  it("combines the uppercased status with the frame summary", () => {
    expect(formatRunOptionLabel({ status: "completed", frame_count: 25 })).toBe("COMPLETED · 25 frames");
    expect(formatRunOptionLabel({ status: "pending", frame_count: null })).toBe(
      "PENDING · No playback data available",
    );
  });
});

describe("formatRunTimestamp", () => {
  it("formats a real created_at into a short human-readable string", () => {
    const result = formatRunTimestamp({ id: "run-1", created_at: "2026-09-12T05:16:35Z" });
    expect(result).not.toBe("");
    expect(result).toMatch(/\d/);
  });

  it("falls back to a short id fragment when created_at is missing", () => {
    expect(formatRunTimestamp({ id: "abcdef1234567890" })).toBe("#abcdef12");
  });
});
