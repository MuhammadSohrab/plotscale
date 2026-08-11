import { describe, expect, it } from "vitest";
import { localFamilyCalibrationService } from "./LocalFamilyCalibrationService";
import { unitConversionService } from "./UnitConversionService";

describe("LocalFamilyCalibrationService", () => {
  it("derives the Assam family from one user-confirmed Katha size and confirmed ratios", () => {
    const profile = localFamilyCalibrationService.derive({
      name: "My Assam units",
      packId: "in_assam_bigha_katha_lessa",
      familyId: "IN_AS_BIGHA_FAMILY",
      anchors: [{
        kind: "unit_area",
        referenceId: "IN_AS_KATHA",
        value: "720",
        sourceUnitId: "SQFT",
      }],
      hierarchyMultipliers: {
        IN_AS_BIGHA_TO_KATHA: "4",
        IN_AS_KATHA_TO_LESSA: "5",
      },
    });
    expect(unitConversionService.fromBase(profile.derivedFactors.IN_AS_BIGHA, "SQFT"))
      .toBeCloseTo(2880, 8);
    expect(unitConversionService.fromBase(profile.derivedFactors.IN_AS_LESSA, "SQFT"))
      .toBeCloseTo(144, 8);
    expect(profile.verificationState).toBe("verified_by_user");
  });

  it("rejects the quarantined legacy Assam 20×5 interpretation", () => {
    const profile = localFamilyCalibrationService.derive({
      name: "Edited Assam units",
      packId: "in_assam_bigha_katha_lessa",
      familyId: "IN_AS_BIGHA_FAMILY",
      anchors: [{
        kind: "unit_area",
        referenceId: "IN_AS_LESSA",
        value: "144",
        sourceUnitId: "SQFT",
      }],
      hierarchyMultipliers: {
        IN_AS_BIGHA_TO_KATHA: "4",
        IN_AS_KATHA_TO_LESSA: "5",
      },
    });
    expect(unitConversionService.fromBase(profile.derivedFactors.IN_AS_BIGHA, "SQFT"))
      .not.toBeCloseTo(14400, 2);
  });

  it("forbids multiple anchors even when both values could be compared", () => {
    expect(() => localFamilyCalibrationService.derive({
      name: "Conflict",
      packId: "in_assam_bigha_katha_lessa",
      familyId: "IN_AS_BIGHA_FAMILY",
      anchors: [
        { kind: "unit_area", referenceId: "IN_AS_KATHA", value: "720", sourceUnitId: "SQFT" },
        { kind: "unit_area", referenceId: "IN_AS_BIGHA", value: "14400", sourceUnitId: "SQFT" },
      ],
      hierarchyMultipliers: {
        IN_AS_BIGHA_TO_KATHA: "4",
        IN_AS_KATHA_TO_LESSA: "5",
      },
    })).toThrow("Only one known calibration value is allowed");
  });
});
