import { describe, expect, it } from "vitest";
import { unitConversionService } from "../services/UnitConversionService";
import { compositeOutputFormatter } from "./CompositeOutputFormatter";

const localProfile = unitConversionService.deriveFamily({
  name: "Test profile",
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

describe("CompositeOutputFormatter", () => {
  it("formats a custom display recipe without creating a new unit", () => {
    const base = unitConversionService.toBase(1, "ACRE") +
      unitConversionService.toBase(12, "SQFT");
    expect(compositeOutputFormatter.formatRecipe(base, {
      unitIds: ["ACRE", "SQFT"],
      precision: 2,
    }).text).toBe("1 Acre 12 Sq Ft");
  });

  it("formats the imperial Acre, Square Yard and Square Foot hierarchy", () => {
    const base =
      unitConversionService.toBase(1, "ACRE") +
      unitConversionService.toBase(2, "SQYD") +
      unitConversionService.toBase(3, "SQFT");
    expect(compositeOutputFormatter.formatImperial(base).text)
      .toBe("1 Acre, 2 Sq Yard, 3 Sq Ft");
  });

  it("formats calibrated Bigha, Katha and Dhur output", () => {
    const base = 1.65 * localProfile.derivedFactors.BIGHA;
    expect(compositeOutputFormatter.formatSouthAsian(base, {
      runtimeFactors: localProfile.derivedFactors,
      includeZeroParts: true,
    }).text).toBe("1 Bigha, 13 Katha, 0 Dhur");
  });
});
