import Decimal from "decimal.js";
import { DIMENSIONS } from "../data/dimensions";
import { createPackUnitVariant } from "../models/unitPackModels";
import { createUserLocalProfile } from "../models/unitModels";
import { asDecimal, decimalString } from "../utils/decimal";
import { unitPackRegistry } from "./UnitPackRegistry";
import { unitConversionService } from "./UnitConversionService";
import { requireSingleAnchor } from "../models/unitEngineModels";

const deriveFromSeed = (seed, relationships) => {
  const factors = { ...seed };
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of relationships) {
      const multiplier = asDecimal(edge.multiplier, "Hierarchy multiplier", { allowZero: false });
      if (factors[edge.childUnitId] && !factors[edge.parentUnitId]) {
        factors[edge.parentUnitId] = decimalString(
          new Decimal(factors[edge.childUnitId]).times(multiplier),
        );
        changed = true;
      }
      if (factors[edge.parentUnitId] && !factors[edge.childUnitId]) {
        factors[edge.childUnitId] = decimalString(
          new Decimal(factors[edge.parentUnitId]).div(multiplier),
        );
        changed = true;
      }
    }
  }
  return factors;
};

export class LocalFamilyCalibrationService {
  constructor({
    registry = unitPackRegistry,
    conversion = unitConversionService,
    relativeTolerance = "0.00000001",
  } = {}) {
    this.registry = registry;
    this.conversion = conversion;
    this.relativeTolerance = new Decimal(relativeTolerance);
  }

  derive(input) {
    const pack = this.registry.getPack(input.packId);
    if (pack.manifest.tier === "research") throw new Error("Research packs cannot be calibrated.");
    const template = pack.data.familyTemplates.find((item) => item.id === input.familyId);
    if (!template) throw new Error(`Unknown unit family: ${input.familyId}.`);
    const relationships = pack.data.relationships
      .filter((edge) => template.relationshipIds.includes(edge.id))
      .map((edge) => ({
        ...edge,
        multiplier: input.hierarchyMultipliers?.[edge.id] ?? edge.multiplier,
      }));
    const variants = pack.data.variants.map((variant) =>
      createPackUnitVariant(variant, pack.manifest));
    const tools = pack.data.tools;
    const anchor = requireSingleAnchor(input);
    const factorSets = [anchor].map((anchorItem) => {
      let seed;
      if (anchorItem.kind === "unit_area") {
        const target = variants.find((unit) => unit.id === anchorItem.referenceId);
        if (!target || target.dimension !== DIMENSIONS.AREA) {
          throw new Error("Area calibration anchor must be a member of this family.");
        }
        seed = {
          [target.id]: this.conversion.toBaseExact(
            anchorItem.value,
            anchorItem.sourceUnitId,
            {},
            input.extraUnits ?? [],
          ),
        };
      } else if (anchorItem.kind === "tool_length") {
        const tool = [...tools, ...(input.extraTools ?? [])]
          .find((candidate) => candidate.id === anchorItem.referenceId);
        if (!tool?.derivedArea) throw new Error("This tool has no explicit area derivation.");
        const length = new Decimal(this.conversion.toBaseExact(
          anchorItem.value,
          anchorItem.sourceUnitId,
          {},
          input.extraUnits ?? [],
        ));
        const area = length.pow(tool.derivedArea.power ?? 2)
          .times(tool.derivedArea.multiplier ?? 1);
        seed = {
          [tool.id]: decimalString(length),
          [tool.derivedArea.unitId]: decimalString(area),
        };
      } else {
        throw new Error("Unsupported calibration anchor.");
      }
      return deriveFromSeed(seed, relationships);
    });

    const expectedIds = new Set(template.unitIds);
    for (const factors of factorSets) {
      for (const unitId of expectedIds) {
        if (!factors[unitId]) throw new Error(`Unable to derive ${unitId}.`);
      }
    }
    return createUserLocalProfile({
      ...input,
      packId: pack.manifest.id,
      packVersion: pack.manifest.version,
      sourceTrustTier: pack.manifest.tier,
      verificationState: "verified_by_user",
      derivedFactors: factorSets[0],
      anchor,
      hierarchyMultipliers: Object.fromEntries(
        relationships.map((edge) => [edge.id, decimalString(edge.multiplier)]),
      ),
      packSnapshot: {
        id: pack.manifest.id,
        version: pack.manifest.version,
        tier: pack.manifest.tier,
        evidenceGrade: pack.manifest.evidenceGrade,
      },
      warnings: [...pack.data.warnings],
    });
  }
}

export const localFamilyCalibrationService = new LocalFamilyCalibrationService();
