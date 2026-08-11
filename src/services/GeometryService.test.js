import { describe, expect, it } from "vitest";
import {
  calculateCustomShape,
  calculateIrregularPlot,
  calculateRegularShape,
  calculateTriangleRows,
  GeometryError,
  triangleAreaBySides,
} from "./GeometryService";

describe("GeometryService", () => {
  it("calculates a 3-4-5 triangle with Heron's formula", () => {
    expect(triangleAreaBySides(3, 4, 5)).toBeCloseTo(6, 10);
  });

  it("rejects an impossible triangle", () => {
    expect(() => triangleAreaBySides(1, 2, 10)).toThrow(GeometryError);
  });

  it("calculates an exact four-side plot from Corner 1 to Corner 3", () => {
    const result = calculateIrregularPlot([10, 10, 10, 10], Math.sqrt(200));
    expect(result.areaSqm).toBeCloseTo(100, 8);
    expect(result.exactness).toBe("confirmed");
  });

  it("labels a side-only four-side result as approximate", () => {
    const result = calculateIrregularPlot([10, 10, 10, 10]);
    expect(result.areaSqm).toBeCloseTo(100, 8);
    expect(result.exactness).toBe("approximate");
  });

  it("requires a complete custom fan when any diagonal is supplied", () => {
    expect(() => calculateCustomShape([5, 5, 5, 5, 5], [8, 0]))
      .toThrow(/all 2 fan diagonals/i);
  });

  it("calculates regular square and multiple triangles", () => {
    expect(calculateRegularShape("square", [10]).areaSqm).toBe(100);
    expect(calculateTriangleRows([
      { sidesMeters: [3, 4, 5] },
      { sidesMeters: [3, 4, 5] },
    ]).areaSqm).toBeCloseTo(12, 8);
  });
});
