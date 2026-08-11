import { describe, expect, it } from "vitest";
import { entitlementService } from "./EntitlementService";

describe("EntitlementService", () => {
  it("honours a seven-day offline grace receipt but locks after it expires", () => {
    const expiredAt = "2026-07-01T00:00:00.000Z";
    const graceUntil = "2026-07-08T00:00:00.000Z";
    expect(entitlementService.getCapabilities({
      subscriptionStatus: "active",
      validUntil: expiredAt,
      offlineGraceUntil: graceUntil,
      now: new Date("2026-07-05T00:00:00.000Z").getTime(),
    }).canUseLocalProfiles).toBe(true);
    expect(entitlementService.getCapabilities({
      subscriptionStatus: "active",
      validUntil: expiredAt,
      offlineGraceUntil: graceUntil,
      now: new Date("2026-07-09T00:00:00.000Z").getTime(),
    }).canUseLocalProfiles).toBe(false);
  });

  it("never grants paid capabilities to a guest", () => {
    expect(entitlementService.getCapabilities({
      subscriptionStatus: "active",
      isGuest: true,
    }).canSaveLocalProfiles).toBe(false);
  });
});
