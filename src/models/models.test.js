import { describe, expect, it } from "vitest";
import { createUnitProfile } from "./cloudModels";
import {
  createBoundary,
  createMeasurement,
  createSavedPlot,
} from "./localModels";

describe("Part 1 data models", () => {
  it("keeps area explicitly normalized to square meters", () => {
    const measurement = createMeasurement("plot-1", { calculatedAreaSqm: 125.5 });
    expect(measurement.calculatedAreaSqm).toBe(125.5);
  });

  it("supports directional and arbitrary-side boundary records", () => {
    const boundary = createBoundary("plot-1", {
      north: "Public road",
      sides: [{ sideIndex: 4, description: "Canal" }],
    });
    expect(boundary.north).toBe("Public road");
    expect(boundary.sides).toHaveLength(1);
  });

  it("rejects unknown plot modes", () => {
    expect(() => createSavedPlot({ mode: "unsupported" })).toThrow("Unsupported plot mode");
  });

  it("creates calibrated local unit profiles without calculating them", () => {
    const profile = createUnitProfile("user-1", {
      name: "Village standard",
      laggiMeters: 2.1,
      hierarchyMultipliers: { dhurPerKatha: 20, kathaPerBigha: 20 },
    });
    expect(profile.laggiMeters).toBe(2.1);
    expect(profile.hierarchyMultipliers.kathaPerBigha).toBe(20);
  });
});
