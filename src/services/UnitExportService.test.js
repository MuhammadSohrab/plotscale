import { describe, expect, it, vi } from "vitest";
import { UNIT_ERROR_CODES } from "./UnitErrors";
import { UnitExportService } from "./UnitExportService";

const emptyDatabase = () => ({
  getLocationProfile: vi.fn(async () => null),
  listUserLocalProfiles: vi.fn(async () => []),
  listCustomFamilies: vi.fn(async () => []),
  listStandaloneCustomUnits: vi.fn(async () => []),
  listCustomTools: vi.fn(async () => []),
  listCompoundRecipes: vi.fn(async () => []),
  getUnitPreferences: vi.fn(async () => ({ ownerKey: "guest" })),
  importUnitSetupAtomic: vi.fn(async () => undefined),
});

describe("UnitExportService", () => {
  it("seals, validates and atomically applies a portable unit setup", async () => {
    const database = emptyDatabase();
    const service = new UnitExportService(database);
    const exported = await service.createExport("guest");
    const serialized = service.serialize(exported);
    const analysis = await service.importExport("user-1", serialized);
    expect(analysis.recordCount).toBe(0);
    expect(database.importUnitSetupAtomic).toHaveBeenCalledOnce();
  });

  it("rejects tampering and oversized input before applying anything", async () => {
    const database = emptyDatabase();
    const service = new UnitExportService(database);
    const exported = await service.createExport("guest");
    const tampered = JSON.stringify({
      ...exported,
      data: { ...exported.data, preferences: { ownerKey: "attacker" } },
    });
    await expect(service.importExport("user-1", tampered))
      .rejects.toMatchObject({ code: UNIT_ERROR_CODES.IMPORT_INVALID });
    await expect(service.parse("x".repeat(5 * 1024 * 1024 + 1)))
      .rejects.toMatchObject({ code: UNIT_ERROR_CODES.IMPORT_INVALID });
    expect(database.importUnitSetupAtomic).not.toHaveBeenCalled();
  });
});
