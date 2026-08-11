import Decimal from "decimal.js";
import { unitConversionService } from "../services/UnitConversionService";
import { decimalString } from "./decimal";
import { formatDecimalExact } from "./exactFormat";

const cleanExact = (value, precision) =>
  decimalString(new Decimal(value).toDecimalPlaces(precision));

export class CompositeOutputFormatter {
  constructor(conversionService = unitConversionService) {
    this.conversion = conversionService;
  }

  breakdown(baseValueInput, unitIds, {
    runtimeFactors = {},
    extraUnits = [],
    precision = 2,
    includeZeroParts = false,
    separator = ", ",
  } = {}) {
    let baseValue;
    try {
      baseValue = new Decimal(baseValueInput);
    } catch {
      baseValue = null;
    }
    if (!baseValue?.isFinite() || baseValue.lt(0)) {
      throw new Error("Base value must be a non-negative number.");
    }
    if (!unitIds?.length) throw new Error("At least one output unit is required.");

    const units = unitIds.map((id) => this.conversion.getUnit(id, extraUnits));
    const dimension = units[0]?.dimension;
    if (!dimension || units.some((unit) => unit.dimension !== dimension)) {
      throw new Error("Composite output units must use the same dimension.");
    }
    const factors = unitIds.map((id) =>
      new Decimal(this.conversion.resolveFactor(id, runtimeFactors, extraUnits)));
    for (let index = 1; index < factors.length; index += 1) {
      if (factors[index].gte(factors[index - 1])) {
        throw new Error("Composite units must be ordered from largest to smallest.");
      }
    }

    let remainder = baseValue;
    const parts = unitIds.map((unitId, index) => {
      const isLast = index === unitIds.length - 1;
      const raw = remainder.div(factors[index]);
      const exactPart = isLast ? raw.toDecimalPlaces(precision) : raw.floor();
      const value = cleanExact(exactPart, precision);
      remainder = Decimal.max(0, remainder.minus(factors[index].times(exactPart)));
      return {
        unitId,
        value,
        exactValue: decimalString(exactPart),
        label: units[index].compositeLabel ?? units[index].name,
        symbol: units[index].symbol,
      };
    });

    const visibleParts = includeZeroParts
      ? parts
      : parts.filter((part, index) =>
        !new Decimal(part.value).isZero()
        || (index === parts.length - 1
          && !parts.some((item) => !new Decimal(item.value).isZero())));

    return {
      parts,
      baseValue: decimalString(baseValue),
      text: visibleParts
        .map((part) => `${formatDecimalExact(part.value, {
          maximumFractionDigits: precision,
        })} ${part.label}`)
        .join(separator),
    };
  }

  formatImperial(baseAreaSqm, options = {}) {
    return this.breakdown(baseAreaSqm, ["ACRE", "SQYD", "SQFT"], options);
  }

  formatAcreDismil(baseAreaSqm, options = {}) {
    return this.breakdown(baseAreaSqm, ["ACRE", "DISMIL"], options);
  }

  formatSouthAsian(baseAreaSqm, options = {}) {
    return this.breakdown(baseAreaSqm, ["BIGHA", "KATHA", "DHUR"], options);
  }

  validateRecipe(recipe, options = {}) {
    this.breakdown(0, recipe.unitIds, {
      ...options,
      precision: recipe.precision ?? 2,
    });
    return true;
  }

  formatRecipe(baseAreaSqm, recipe, options = {}) {
    return this.breakdown(baseAreaSqm, recipe.unitIds, {
      ...options,
      precision: recipe.precision ?? 2,
      separator: recipe.separator ?? " ",
    });
  }
}

export const compositeOutputFormatter = new CompositeOutputFormatter();
