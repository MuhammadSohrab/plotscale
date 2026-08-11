import { UNIT_ERROR_CODES, unitError } from "./UnitErrors";

const PAID_STATUSES = new Set(["active", "trial"]);
const asTime = (value) => value ? new Date(value).getTime() : null;

export class EntitlementService {
  getCapabilities({
    subscriptionStatus = "free",
    isGuest = false,
    validUntil = null,
    offlineGraceUntil = null,
    now = Date.now(),
  } = {}) {
    const validTime = asTime(validUntil);
    const graceTime = asTime(offlineGraceUntil);
    const withinTimeLimit = (!validTime || now <= validTime) || (graceTime && now <= graceTime);
    const paid = !isGuest && PAID_STATUSES.has(subscriptionStatus) && Boolean(withinTimeLimit);
    return Object.freeze({
      canUseStandardUnits: true,
      canPreviewLocalSetup: true,
      canSaveLocalProfiles: paid,
      canUseLocalProfiles: paid,
      canManageCustomUnits: paid,
      canSyncUnitProfiles: paid,
      canContributeUnitEvidence: paid,
    });
  }

  require(capability, context) {
    const capabilities = this.getCapabilities(context);
    if (!capabilities[capability]) {
      throw unitError(
        UNIT_ERROR_CODES.ENTITLEMENT_REQUIRED,
        "A PlotScale subscription is required to save and use local or custom units.",
        { capability },
      );
    }
    return true;
  }
}

export const entitlementService = new EntitlementService();
