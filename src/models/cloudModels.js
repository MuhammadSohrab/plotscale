export const DEFAULT_APP_SETTINGS = Object.freeze({
  theme: "system",
  language: "en",
  defaultCalculationMode: "manual",
});

export const DEFAULT_UNIT_SETUP = Object.freeze({
  defaultInputLengthUnit: "METER",
  defaultOutputAreaUnit: "SQM",
});

export function createUserProfile(user, name = "") {
  return {
    userId: user.id,
    name: name || user.user_metadata?.name || "",
    email: user.email ?? "",
    registeredAt: user.created_at ?? new Date().toISOString(),
    subscriptionStatus: "free",
    creditBalance: 0,
  };
}

export function createAppSettings(userId, overrides = {}) {
  return {
    userId,
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
    updatedAt: new Date().toISOString(),
  };
}

export function createUnitProfile(userId, input) {
  if (!input?.name?.trim()) throw new Error("A unit profile name is required.");
  return {
    id: input.id ?? crypto.randomUUID(),
    userId,
    name: input.name.trim(),
    defaultInputLengthUnit:
      input.defaultInputLengthUnit ?? DEFAULT_UNIT_SETUP.defaultInputLengthUnit,
    defaultOutputAreaUnit:
      input.defaultOutputAreaUnit ?? DEFAULT_UNIT_SETUP.defaultOutputAreaUnit,
    laggiMeters: input.laggiMeters ?? null,
    hierarchyMultipliers: input.hierarchyMultipliers ?? {},
    packId: input.packId ?? null,
    packVersion: input.packVersion ?? null,
    profileVersion: input.profileVersion ?? 1,
    revision: input.revision ?? 1,
    familyId: input.familyId ?? null,
    verificationState: input.verificationState ?? "user_calibrated",
    sourceTrustTier: input.sourceTrustTier ?? "legacy",
    anchors: input.anchors ?? [],
    derivedFactors: input.derivedFactors ?? {},
    packSnapshot: input.packSnapshot ?? null,
    warnings: input.warnings ?? [],
    ownerKey: userId,
    isDefault: Boolean(input.isDefault),
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
