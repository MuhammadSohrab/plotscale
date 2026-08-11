import { DIMENSIONS } from "../data/dimensions";
import { asDecimal, decimalString } from "../utils/decimal";

export const PACK_TIERS = Object.freeze({
  VERIFIED: "verified",
  SUGGESTED: "suggested",
  RESEARCH: "research",
});

export const EXACTNESS = Object.freeze({
  EXACT: "exact",
  APPROXIMATE: "approximate",
  RANGE: "range",
  UNKNOWN: "unknown",
});

const requiredText = (value, label) => {
  if (!String(value ?? "").trim()) throw new Error(`${label} is required.`);
  return String(value).trim();
};

export function validatePackManifest(input) {
  const tier = requiredText(input?.tier, "Pack tier");
  if (!Object.values(PACK_TIERS).includes(tier)) throw new Error(`Unsupported pack tier: ${tier}.`);
  if (!/^\d+\.\d+\.\d+$/.test(input?.version ?? "")) {
    throw new Error("Pack version must use semantic versioning.");
  }
  if (tier === PACK_TIERS.VERIFIED && input.ownerApproval?.status !== "approved") {
    throw new Error("Verified packs require explicit owner approval.");
  }
  return {
    ...input,
    id: requiredText(input.id, "Pack id"),
    version: input.version,
    tier,
    schemaVersion: requiredText(input.schemaVersion, "Schema version"),
    minimumAppVersion: requiredText(input.minimumAppVersion, "Minimum app version"),
    dimensions: [...new Set(input.dimensions ?? [])],
    regions: (input.regions ?? []).map((region) => ({
      countryCode: requiredText(region.countryCode, "Country code").toUpperCase(),
      nodePathIds: region.nodePathIds ?? [],
      measurementRegionIds: region.measurementRegionIds ?? [],
      admin1Code: region.admin1Code ?? null,
      admin2Code: region.admin2Code ?? null,
      localityCodes: region.localityCodes ?? [],
    })),
  };
}

export function createPackUnitVariant(input, pack) {
  if (![DIMENSIONS.LENGTH, DIMENSIONS.AREA].includes(input.dimension)) {
    throw new Error(`Variant ${input.id} has an invalid dimension.`);
  }
  const exactness = input.exactness ?? EXACTNESS.UNKNOWN;
  if (!Object.values(EXACTNESS).includes(exactness)) {
    throw new Error(`Variant ${input.id} has invalid exactness.`);
  }
  const factor = input.factorToBase == null
    ? null
    : decimalString(asDecimal(input.factorToBase, `${input.name} factor`, { allowZero: false }));
  const suggestedFactor = input.suggestedFactorToBase == null
    ? null
    : decimalString(asDecimal(
      input.suggestedFactorToBase,
      `${input.name} suggested factor`,
      { allowZero: false },
    ));
  return {
    id: requiredText(input.id, "Variant id"),
    conceptId: requiredText(input.conceptId, "Concept id"),
    name: requiredText(input.name, "Variant name"),
    symbol: requiredText(input.symbol, "Variant symbol"),
    aliases: input.aliases ?? [],
    dimension: input.dimension,
    factorToBase: factor,
    suggestedFactorToBase: suggestedFactor,
    exactness,
    system: input.system ?? "local",
    status: input.status ?? "current",
    compositeLabel: input.compositeLabel ?? input.name,
    visibility: input.visibility ?? "region",
    isFlexible: factor == null,
    isCustom: false,
    packId: pack.id,
    packVersion: pack.version,
    trustTier: pack.tier,
    jurisdiction: input.jurisdiction ?? pack.regions,
    validity: input.validity ?? null,
    warnings: input.warnings ?? [],
  };
}

export function validatePackData(input, manifest) {
  const concepts = input?.concepts ?? [];
  const variants = input?.variants ?? [];
  const relationships = input?.relationships ?? [];
  const conceptIds = new Set(concepts.map((item) => item.id));
  const variantIds = new Set(variants.map((item) => item.id));

  for (const variant of variants) {
    if (!conceptIds.has(variant.conceptId)) {
      throw new Error(`${manifest.id}: variant ${variant.id} references an unknown concept.`);
    }
    if (manifest.tier === PACK_TIERS.SUGGESTED && variant.factorToBase != null) {
      throw new Error(`${manifest.id}: suggested variants cannot provide runtime factors.`);
    }
  }
  for (const relation of relationships) {
    if (!variantIds.has(relation.parentUnitId) || !variantIds.has(relation.childUnitId)) {
      throw new Error(`${manifest.id}: relationship ${relation.id} references an unknown variant.`);
    }
    asDecimal(relation.multiplier, `${relation.id} multiplier`, { allowZero: false });
  }
  if (
    manifest.tier === PACK_TIERS.SUGGESTED
    && (input.tools ?? []).some((tool) => tool.factorToBase != null)
  ) {
    throw new Error(`${manifest.id}: suggested tools cannot provide runtime factors.`);
  }
  return {
    concepts,
    variants,
    relationships,
    familyTemplates: input.familyTemplates ?? [],
    tools: input.tools ?? [],
    sources: input.sources ?? [],
    warnings: input.warnings ?? [],
    outputRecipes: input.outputRecipes ?? [],
    qaIssues: input.qaIssues ?? [],
  };
}
