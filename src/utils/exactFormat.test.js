import { describe, expect, it } from "vitest";
import { formatDecimalExact } from "./exactFormat";

describe("formatDecimalExact", () => {
  it("formats values beyond Number range without Infinity", () => {
    const value = formatDecimalExact("1e50", { maximumFractionDigits: 2 });
    expect(value.startsWith("10,00,00")).toBe(true);
    expect(value).not.toContain("Infinity");
  });

  it("rounds only at the display boundary", () => {
    expect(formatDecimalExact("4046.8564224", { maximumFractionDigits: 4 }))
      .toBe("4,046.8564");
  });
});
