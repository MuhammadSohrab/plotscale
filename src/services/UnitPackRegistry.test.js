import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { BUNDLED_UNIT_PACKS } from "../data/unit-packs";
import { canonicalJson } from "./PackUpdateService";
import { unitPackRegistry } from "./UnitPackRegistry";

describe("UnitPackRegistry", () => {
  it("loads verified standards but excludes local suggested units by default", () => {
    const units = unitPackRegistry.getRuntimeUnits();
    expect(units.some((unit) => unit.id === "ACRE")).toBe(true);
    expect(units.some((unit) => unit.id === "IN_AS_BIGHA")).toBe(false);
    expect(units.some((unit) => unit.id === "KANAL")).toBe(false);
  });

  it("never exposes research catalog records as runtime units", () => {
    const packs = unitPackRegistry.listPacks({ runtimeOnly: true });
    expect(packs.every((pack) => pack.manifest.tier !== "research")).toBe(true);
  });

  it("ships every bundled pack with a matching canonical data checksum", () => {
    BUNDLED_UNIT_PACKS.forEach(({ manifest, data }) => {
      const checksum = createHash("sha256")
        .update(canonicalJson(data))
        .digest("hex");
      expect(checksum, manifest.id).toBe(manifest.checksum);
    });
  });
});
