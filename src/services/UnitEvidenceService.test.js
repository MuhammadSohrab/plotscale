import { describe, expect, it } from "vitest";
import { UnitEvidenceService } from "./UnitEvidenceService";

describe("UnitEvidenceService", () => {
  it("builds an identity-free, location-scoped allowlist payload", () => {
    const service = new UnitEvidenceService();
    const payload = service.buildPayload({
      id: "private-profile-id",
      ownerKey: "private-user-id",
      name: "Private profile name",
      packId: "in_assam_bigha_katha_lessa",
      familyId: "IN_AS_BIGHA_FAMILY",
      hierarchyMultipliers: {
        IN_AS_BIGHA_TO_KATHA: "4",
        IN_AS_KATHA_TO_LESSA: "5",
      },
      derivedFactors: {
        IN_AS_BIGHA: "267.56064",
        IN_AS_KATHA: "66.89016",
        IN_AS_LESSA: "13.378032",
      },
    }, {
      countryCode: "IN",
      nodePathIds: ["IN:AS"],
      measurementRegionIds: [],
    });
    expect(payload.countryCode).toBe("IN");
    expect(JSON.stringify(payload)).not.toContain("private-user-id");
    expect(JSON.stringify(payload)).not.toContain("Private profile name");
    expect(JSON.stringify(payload)).not.toContain("private-profile-id");
  });
});
