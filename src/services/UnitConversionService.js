import Decimal from "decimal.js";
import {
  DIMENSIONS,
  TOOLS_REGISTRY,
  UNIT_HIERARCHY,
  UNIT_REGISTRY,
} from "../data/unitRegistry";
import { createUnitRegistryEntry, createUserLocalProfile } from "../models/unitModels";
import {
  createCustomAreaUnit,
  createCustomMeasuringTool,
} from "../models/unitIntelligenceModels";
import { asDecimal, decimalString } from "../utils/decimal";

const positiveDecimal = (value, label = "Value") =>
  asDecimal(value, label, { allowZero: false });

export class UnitConversionService {
  constructor({
    units = UNIT_REGISTRY,
    hierarchies = UNIT_HIERARCHY,
    tools = TOOLS_REGISTRY,
  } = {}) {
    this.units = units;
    this.hierarchies = hierarchies;
    this.tools = tools;
  }

  getUnit(unitId, extraUnits = []) {
    const unit = [...extraUnits, ...this.units].find((item) => item.id === unitId);
    if (!unit) throw new Error(`Unknown unit: ${unitId}.`);
    return unit;
  }

  getTool(toolId) {
    const tool = this.tools.find((item) => item.id === toolId);
    if (!tool) throw new Error(`Unknown measuring tool: ${toolId}.`);
    return tool;
  }

  resolveFactor(unitId, runtimeFactors = {}, extraUnits = []) {
    const unit = this.getUnit(unitId, extraUnits);
    const factor = runtimeFactors[unitId] ?? unit.factorToBase;
    let decimal;
    try {
      decimal = new Decimal(factor);
    } catch {
      decimal = null;
    }
    if (!decimal?.isFinite() || decimal.lte(0)) {
      throw new Error(`${unit.name} requires an active local calibration profile.`);
    }
    return decimal.toFixed();
  }

  toBaseExact(value, unitId, runtimeFactors = {}, extraUnits = []) {
    return decimalString(
      asDecimal(value).times(this.resolveFactor(unitId, runtimeFactors, extraUnits)),
    );
  }

  toBase(value, unitId, runtimeFactors = {}, extraUnits = []) {
    return Number(this.toBaseExact(value, unitId, runtimeFactors, extraUnits));
  }

  fromBaseExact(baseValue, unitId, runtimeFactors = {}, extraUnits = []) {
    return decimalString(
      asDecimal(baseValue).div(this.resolveFactor(unitId, runtimeFactors, extraUnits)),
    );
  }

  fromBase(baseValue, unitId, runtimeFactors = {}, extraUnits = []) {
    return Number(this.fromBaseExact(baseValue, unitId, runtimeFactors, extraUnits));
  }

  convertExact(value, fromUnitId, toUnitId, runtimeFactors = {}, extraUnits = []) {
    const from = this.getUnit(fromUnitId, extraUnits);
    const to = this.getUnit(toUnitId, extraUnits);
    if (from.dimension !== to.dimension) {
      throw new Error(`Cannot convert ${from.dimension} to ${to.dimension}.`);
    }
    return this.fromBaseExact(
      this.toBaseExact(value, fromUnitId, runtimeFactors, extraUnits),
      toUnitId,
      runtimeFactors,
      extraUnits,
    );
  }

  convert(value, fromUnitId, toUnitId, runtimeFactors = {}, extraUnits = []) {
    return Number(this.convertExact(value, fromUnitId, toUnitId, runtimeFactors, extraUnits));
  }

  deriveFamily(profileInput) {
    const profile = createUserLocalProfile(profileInput);
    const familyEdges = this.hierarchies
      .filter((edge) => edge.familyId === profile.familyId)
      .map((edge) => ({
        ...edge,
        multiplier:
          profile.hierarchyMultipliers[edge.id] ?? edge.multiplier,
      }));
    if (!familyEdges.length) throw new Error(`Unknown unit family: ${profile.familyId}.`);

    const factors = {};
    const basis = profile.knownBasis;

    if (basis.kind === "unit_area") {
      const knownUnit = this.getUnit(basis.referenceId);
      const sourceUnit = this.getUnit(basis.sourceUnitId);
      if (knownUnit.dimension !== DIMENSIONS.AREA || sourceUnit.dimension !== DIMENSIONS.AREA) {
        throw new Error("Area calibration requires two area units.");
      }
      factors[basis.referenceId] = this.toBaseExact(basis.value, basis.sourceUnitId);
    } else if (basis.kind === "tool_length") {
      const tool = this.getTool(basis.referenceId);
      const sourceUnit = this.getUnit(basis.sourceUnitId);
      if (tool.dimension !== DIMENSIONS.LENGTH || sourceUnit.dimension !== DIMENSIONS.LENGTH) {
        throw new Error("Tool calibration requires a length unit.");
      }
      if (!tool.derivesAreaUnitId || tool.areaPower !== 2) {
        throw new Error(`${tool.name} has no configured area derivation.`);
      }
      const toolMeters = new Decimal(this.toBaseExact(basis.value, basis.sourceUnitId));
      factors[tool.derivesAreaUnitId] = decimalString(toolMeters.pow(2));
      factors[tool.id] = decimalString(toolMeters);
    } else {
      throw new Error("Unsupported calibration basis.");
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of familyEdges) {
        const multiplier = positiveDecimal(edge.multiplier, "Hierarchy multiplier");
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

    const familyUnitIds = new Set(
      familyEdges.flatMap((edge) => [edge.parentUnitId, edge.childUnitId]),
    );
    for (const unitId of familyUnitIds) {
      if (!factors[unitId]) throw new Error(`Unable to derive ${unitId}.`);
    }

    return {
      ...profile,
      derivedFactors: factors,
      hierarchyMultipliers: Object.fromEntries(
        familyEdges.map((edge) => [edge.id, edge.multiplier]),
      ),
    };
  }

  createCustomUnit({
    name,
    symbol,
    dimension,
    equivalentValue,
    equivalentUnitId,
    ownerKey,
  }, extraUnits = []) {
    const equivalentUnit = this.getUnit(equivalentUnitId, extraUnits);
    if (equivalentUnit.dimension !== dimension) {
      throw new Error("The reference unit must use the same dimension.");
    }
    return createUnitRegistryEntry({
      name,
      symbol,
      dimension,
      ownerKey,
      factorToBase: this.toBaseExact(equivalentValue, equivalentUnitId, {}, extraUnits),
    });
  }

  createCustomArea({
    name,
    symbol,
    note,
    equivalentValue,
    equivalentUnitId,
    ownerKey,
  }, extraUnits = []) {
    const equivalentUnit = this.getUnit(equivalentUnitId, extraUnits);
    if (equivalentUnit.dimension !== DIMENSIONS.AREA) {
      throw new Error("A custom area unit requires an area reference unit.");
    }
    return createCustomAreaUnit({
      name,
      symbol,
      note,
      ownerKey,
      factorToBase: this.toBaseExact(equivalentValue, equivalentUnitId, {}, extraUnits),
    });
  }

  createCustomTool({
    name,
    symbol,
    note,
    equivalentValue,
    equivalentUnitId,
    ownerKey,
  }, extraUnits = []) {
    const equivalentUnit = this.getUnit(equivalentUnitId, extraUnits);
    if (equivalentUnit.dimension !== DIMENSIONS.LENGTH) {
      throw new Error("A custom measuring tool requires a length reference unit.");
    }
    return createCustomMeasuringTool({
      name,
      symbol,
      note,
      ownerKey,
      factorToBase: this.toBaseExact(equivalentValue, equivalentUnitId, {}, extraUnits),
    });
  }
}

export const unitConversionService = new UnitConversionService();
