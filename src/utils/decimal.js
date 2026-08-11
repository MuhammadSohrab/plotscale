import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 40,
});

export const asDecimal = (value, label = "Value", { allowZero = true } = {}) => {
  let decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new Error(`${label} must be a valid number.`);
  }
  if (!decimal.isFinite() || (!allowZero && decimal.lte(0)) || (allowZero && decimal.lt(0))) {
    throw new Error(`${label} must be ${allowZero ? "a non-negative" : "a positive"} number.`);
  }
  return decimal;
};

export const decimalString = (value) => new Decimal(value).toFixed();
export const decimalNumber = (value) => new Decimal(value).toNumber();

