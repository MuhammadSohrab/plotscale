import { DIMENSIONS } from "../data/dimensions";
import { asDecimal, decimalString } from "../utils/decimal";
import {
  createLocationSelection,
  createStandaloneCustomUnit,
} from "./unitEngineModels";

const required = (value, label) => {
  if (!String(value ?? "").trim()) throw new Error(`${label} is required.`);
  return String(value).trim();
};

export function createLocationProfile(input = {}) {
  if (input.nodePathIds || input.measurementRegionIds) {
    return {
      ownerKey: input.ownerKey ?? "guest",
      ...createLocationSelection(input),
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ownerKey: input.ownerKey ?? "guest",
    countryCode: required(input.countryCode, "Country"),
    nodePathIds: [
      input.admin1Code ? `${String(input.countryCode).toUpperCase()}:${input.admin1Code.trim()}` : null,
      input.admin2Code ? `${String(input.countryCode).toUpperCase()}:${input.admin1Code?.trim()}:${input.admin2Code.trim()}` : null,
      input.localityCode ? `${String(input.countryCode).toUpperCase()}:${input.localityCode.trim()}` : null,
    ].filter(Boolean),
    measurementRegionIds: ["TERAI", "HILLS"].includes(input.admin1Code?.trim())
      ? [`${String(input.countryCode).toUpperCase()}:${input.admin1Code.trim()}`]
      : [],
    resolutionLevel: [input.admin1Code, input.admin2Code, input.localityCode].filter(Boolean).length,
    // Read-only compatibility fields for pre-v4 consumers. Dynamic location
    // resolution never depends on these fixed names.
    admin1Code: input.admin1Code?.trim() || null,
    admin2Code: input.admin2Code?.trim() || null,
    localityCode: input.localityCode?.trim() || null,
    source: input.source ?? "manual",
    confirmedByUser: input.confirmedByUser !== false,
    updatedAt: new Date().toISOString(),
  };
}

export function createCustomAreaUnit(input) {
  return {
    ...createStandaloneCustomUnit({ ...input, dimension: DIMENSIONS.AREA }),
    conceptId: input.conceptId ?? null,
    customKind: "standalone_unit",
  };
}

export function createCustomMeasuringTool(input) {
  return {
    id: input.id ?? `CUSTOM_TOOL_${crypto.randomUUID()}`,
    ownerKey: input.ownerKey ?? "guest",
    name: required(input.name, "Tool name"),
    symbol: required(input.symbol, "Tool symbol"),
    note: input.note?.trim() || "",
    dimension: DIMENSIONS.LENGTH,
    factorToBase: decimalString(asDecimal(input.factorToBase, "Tool length", { allowZero: false })),
    isFlexible: false,
    isCustom: true,
    customKind: "measuring_tool",
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createCompoundDisplayRecipe(input) {
  const unitIds = [...new Set(input.unitIds ?? [])];
  if (unitIds.length < 2) throw new Error("A compound recipe needs at least two units.");
  const precision = Number(input.precision ?? 2);
  if (!Number.isInteger(precision) || precision < 0 || precision > 10) {
    throw new Error("Recipe precision must be an integer from 0 to 10.");
  }
  return {
    id: input.id ?? `RECIPE_${crypto.randomUUID()}`,
    ownerKey: input.ownerKey ?? "guest",
    name: required(input.name, "Recipe name"),
    dimension: input.dimension ?? DIMENSIONS.AREA,
    unitIds,
    precision,
    separator: input.separator ?? " ",
    isCustom: true,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
