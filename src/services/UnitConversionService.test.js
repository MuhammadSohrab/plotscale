import { describe, expect, it } from "vitest";
import {
  UnitConversionService,
  unitConversionService,
} from "./UnitConversionService";

describe("UnitConversionService", () => {
  it("normalizes length to meters and area to square meters", () => {
    expect(unitConversionService.toBase(1, "FOOT")).toBe(0.3048);
    expect(unitConversionService.toBase(1, "ACRE")).toBe(4046.8564224);
    expect(unitConversionService.convert(1, "ACRE", "SQFT")).toBeCloseTo(43560, 8);
  });

  it("rejects conversions across dimensions", () => {
    expect(() => unitConversionService.convert(1, "FOOT", "SQFT"))
      .toThrow("Cannot convert length to area");
  });

  it("uses a versioned profile factor before a stale registry factor", () => {
    const service = new UnitConversionService({
      units: [{
        id: "LOCAL",
        name: "Local",
        symbol: "local",
        dimension: "area",
        factorToBase: "500",
      }],
      hierarchies: [],
      tools: [],
    });
    expect(service.toBaseExact("2", "LOCAL", { LOCAL: "100" })).toBe("200");
  });

  it("derives the complete local family from a calibrated Laggi", () => {
    const profile = unitConversionService.deriveFamily({
      name: "Regional profile",
      familyId: "BIGHA_KATHA_DHUR",
      knownBasis: {
        kind: "tool_length",
        referenceId: "LAGGI",
        value: 8.25,
        sourceUnitId: "FOOT",
      },
      hierarchyMultipliers: {
        BIGHA_TO_KATHA: 20,
        KATHA_TO_DHUR: 20,
      },
    });

    expect(unitConversionService.fromBase(profile.derivedFactors.DHUR, "SQFT"))
      .toBeCloseTo(68.0625, 8);
    expect(unitConversionService.fromBase(profile.derivedFactors.KATHA, "SQFT"))
      .toBeCloseTo(1361.25, 8);
    expect(unitConversionService.fromBase(profile.derivedFactors.BIGHA, "SQFT"))
      .toBeCloseTo(27225, 8);
  });

  it("propagates in both directions from a known Katha area", () => {
    const profile = unitConversionService.deriveFamily({
      name: "Known Katha",
      familyId: "BIGHA_KATHA_DHUR",
      knownBasis: {
        kind: "unit_area",
        referenceId: "KATHA",
        value: 1361.25,
        sourceUnitId: "SQFT",
      },
      hierarchyMultipliers: {
        BIGHA_TO_KATHA: 20,
        KATHA_TO_DHUR: 20,
      },
    });
    expect(Number(profile.derivedFactors.BIGHA)).toBeCloseTo(Number(profile.derivedFactors.KATHA) * 20);
    expect(Number(profile.derivedFactors.DHUR)).toBeCloseTo(Number(profile.derivedFactors.KATHA) / 20);
  });

  it("creates a custom unit from an exact standard-unit equation", () => {
    const guntha = unitConversionService.createCustomUnit({
      name: "Guntha",
      symbol: "gun",
      dimension: "area",
      equivalentValue: 1089,
      equivalentUnitId: "SQFT",
      ownerKey: "guest",
    });
    expect(Number(guntha.factorToBase)).toBeCloseTo(101.17141056, 10);
    expect(guntha.isCustom).toBe(true);
  });
});
