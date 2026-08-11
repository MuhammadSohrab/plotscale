import { DEFAULT_UNIT_PREFERENCES, DIMENSIONS } from "../data/unitRegistry";
import { asDecimal, decimalString } from "../utils/decimal";
import { requireSingleAnchor } from "./unitEngineModels";

const requirePositive = (value, label) => {
  return decimalString(asDecimal(value, label, { allowZero: false }));
};

export function createUnitRegistryEntry(input) {
  if (!input?.name?.trim() || !input?.symbol?.trim()) {
    throw new Error("A custom unit name and symbol are required.");
  }
  if (![DIMENSIONS.LENGTH, DIMENSIONS.AREA].includes(input.dimension)) {
    throw new Error("A custom unit must be a length or area unit.");
  }

  return {
    id: input.id ?? `CUSTOM_${crypto.randomUUID()}`,
    name: input.name.trim(),
    symbol: input.symbol.trim(),
    dimension: input.dimension,
    factorToBase: decimalString(requirePositive(input.factorToBase, "Factor to base")),
    isFlexible: false,
    isCustom: true,
    ownerKey: input.ownerKey ?? "guest",
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createUserLocalProfile(input) {
  if (!input?.name?.trim()) throw new Error("A local profile name is required.");
  if (!input?.familyId) throw new Error("A unit family is required.");
  const anchor = requireSingleAnchor(input);
  if (!anchor?.referenceId || !anchor?.sourceUnitId) {
    throw new Error("A known calibration basis is required.");
  }

  const hierarchyMultipliers = Object.fromEntries(
    Object.entries(input.hierarchyMultipliers ?? {}).map(([id, value]) => [
      id,
      decimalString(requirePositive(value, "Hierarchy multiplier")),
    ]),
  );

  const now = new Date().toISOString();
  const normalizedAnchor = {
    kind: anchor.kind,
    referenceId: anchor.referenceId,
    value: decimalString(requirePositive(anchor.value, "Known value")),
    sourceUnitId: anchor.sourceUnitId,
  };
  return {
    id: input.id ?? crypto.randomUUID(),
    ownerKey: input.ownerKey ?? "guest",
    name: input.name.trim(),
    familyId: input.familyId,
    packId: input.packId ?? null,
    packVersion: input.packVersion ?? null,
    profileVersion: input.profileVersion ?? 1,
    revision: input.revision ?? 1,
    verificationState: input.verificationState ?? "verified_by_user",
    sourceTrustTier: input.sourceTrustTier ?? "suggestion",
    knownBasis: normalizedAnchor,
    anchor: normalizedAnchor,
    anchors: [normalizedAnchor],
    hierarchyMultipliers,
    derivedFactors: Object.fromEntries(
      Object.entries(input.derivedFactors ?? {}).map(([id, value]) => [id, decimalString(value)]),
    ),
    packSnapshot: input.packSnapshot ?? null,
    warnings: input.warnings ?? [],
    isDefault: Boolean(input.isDefault),
    isArchived: Boolean(input.isArchived),
    migrationState: input.migrationState ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function createUnitPreferences(input = {}) {
  return {
    ...DEFAULT_UNIT_PREFERENCES,
    ...input,
    ownerKey: input.ownerKey ?? "guest",
    updatedAt: new Date().toISOString(),
  };
}
