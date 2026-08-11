import { DIMENSIONS } from "./dimensions";
import { unitPackRegistry } from "../services/UnitPackRegistry";

export { DIMENSIONS };

const compatibilityUnit = (id, name, symbol) => Object.freeze({
  id,
  conceptId: `legacy.${id.toLowerCase()}`,
  name,
  compositeLabel: name.replace(" (legacy profile)", ""),
  symbol,
  dimension: DIMENSIONS.AREA,
  factorToBase: null,
  isFlexible: true,
  isCustom: false,
  visibility: "legacy_profile_only",
  trustTier: "legacy",
  warnings: ["Available only to preserve an existing calibrated profile."],
});

export const UNIT_REGISTRY = Object.freeze([
  ...unitPackRegistry.getRuntimeUnits({ includeHistorical: true }),
  compatibilityUnit("BIGHA", "Bigha (legacy profile)", "bigha"),
  compatibilityUnit("KATHA", "Katha (legacy profile)", "katha"),
  compatibilityUnit("DHUR", "Dhur (legacy profile)", "dhur"),
  compatibilityUnit("KANAL", "Kanal (legacy profile)", "kanal"),
  compatibilityUnit("MARLA", "Marla (legacy profile)", "marla"),
  compatibilityUnit("DISMIL", "Dismil (legacy profile)", "dismil"),
  compatibilityUnit("CENT", "Cent (legacy profile)", "cent"),
  compatibilityUnit("GUNTHA", "Guntha (legacy profile)", "gun"),
]);

export const UNIT_HIERARCHY = Object.freeze([
  ...unitPackRegistry.getRuntimeRelationships(),
  Object.freeze({
    id: "BIGHA_TO_KATHA",
    familyId: "BIGHA_KATHA_DHUR",
    parentUnitId: "BIGHA",
    childUnitId: "KATHA",
    multiplier: "20",
    editable: true,
    trustTier: "legacy",
  }),
  Object.freeze({
    id: "KATHA_TO_DHUR",
    familyId: "BIGHA_KATHA_DHUR",
    parentUnitId: "KATHA",
    childUnitId: "DHUR",
    multiplier: "20",
    editable: true,
    trustTier: "legacy",
  }),
]);

export const TOOLS_REGISTRY = Object.freeze([
  ...unitPackRegistry.getTools(),
  Object.freeze({
    id: "LAGGI",
    name: "Laggi (legacy profile)",
    symbol: "laggi",
    dimension: DIMENSIONS.LENGTH,
    factorToBase: null,
    isFlexible: true,
    derivesAreaUnitId: "DHUR",
    areaPower: 2,
    visibility: "legacy_profile_only",
    trustTier: "legacy",
  }),
]);

export const DEFAULT_UNIT_PREFERENCES = Object.freeze({
  defaultInputLengthUnit: "FOOT",
  primaryOutputAreaUnit: "ACRE",
  secondaryOutputAreaUnit: "SQFT",
  compositeOutput: true,
  activeLocalProfileId: null,
  activeCompoundRecipeId: null,
  advancedUnitsEnabled: false,
  contributeUnitEvidence: false,
});

export const LEGACY_UNIT_ID_MIGRATIONS = Object.freeze({
  BIGHA: "profile_required",
  KATHA: "profile_required",
  DHUR: "profile_required",
  KANAL: "profile_required",
  MARLA: "profile_required",
  DISMIL: "profile_required",
  CENT: "profile_required",
  GUNTHA: "profile_required",
});
