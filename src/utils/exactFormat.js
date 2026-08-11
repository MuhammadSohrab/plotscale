import Decimal from "decimal.js";

const groupInteger = (value, locale = "en-IN") => {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  if (locale !== "en-IN") {
    return `${negative ? "-" : ""}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }
  if (digits.length <= 3) return `${negative ? "-" : ""}${digits}`;
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${head},${tail}`;
};

export const formatDecimalExact = (
  value,
  { maximumFractionDigits = 8, minimumFractionDigits = 0, locale = "en-IN" } = {},
) => {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error("Display value must be finite.");
  const fixed = decimal.toDecimalPlaces(maximumFractionDigits).toFixed(maximumFractionDigits);
  const [integer, rawFraction = ""] = fixed.split(".");
  let fraction = rawFraction;
  while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }
  return `${groupInteger(integer, locale)}${fraction ? `.${fraction}` : ""}`;
};

