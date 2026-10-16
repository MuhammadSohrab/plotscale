import { describe, expect, it } from "vitest";
import { lngLatToWorldPixel } from "./satelliteSnapshot";

describe("satellite snapshot projection", () => {
  it("projects the equator and prime meridian to the world centre", () => {
    const point = lngLatToWorldPixel(0, 0, 1);
    expect(point.x).toBe(256);
    expect(point.y).toBe(256);
  });

  it("keeps projected coordinates inside the web mercator world", () => {
    const point = lngLatToWorldPixel(26.759715, 83.339869, 18);
    expect(point.x).toBeGreaterThan(0);
    expect(point.x).toBeLessThan(point.worldSize);
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(point.worldSize);
  });
});
