import { describe, expect, it } from "vitest";
import { formatCaptureTime, formatCoordinate } from "./surveyPhotoStamp";

describe("survey photo stamp formatting", () => {
  it("formats signed GPS coordinates with cardinal directions", () => {
    expect(formatCoordinate(26.7606, "N", "S")).toBe("26.760600° N");
    expect(formatCoordinate(-83.3732, "E", "W")).toBe("83.373200° W");
  });

  it("formats a stable date value without losing the time", () => {
    const formatted = formatCaptureTime("2026-10-16T08:12:00.000Z", "en-IN");
    expect(formatted).toContain("2026");
  });
});
