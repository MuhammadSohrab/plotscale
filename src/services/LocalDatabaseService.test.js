import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalDatabaseService,
  PlotScaleDatabase,
} from "./LocalDatabaseService";

let database;
let service;

beforeEach(async () => {
  database = new PlotScaleDatabase(`PlotScaleTest-${crypto.randomUUID()}`);
  service = new LocalDatabaseService(database);
  await service.initialize();
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("LocalDatabaseService", () => {
  it("stores a plot and its normalized square-meter measurement separately", async () => {
    const plot = await service.savePlot({ name: "North field", mode: "manual" });
    await service.saveMeasurements(plot.id, {
      sideLengthsMeters: [10, 20, 10, 20],
      calculatedAreaSqm: 200,
    });

    expect((await service.getPlot(plot.id)).name).toBe("North field");
    expect((await service.getMeasurements(plot.id))[0].calculatedAreaSqm).toBe(200);
  });

  it("lists only the current account's saved plots when an owner is provided", async () => {
    await service.savePlot({ name: "Owner A field", ownerUserId: "user-a" });
    await service.savePlot({ name: "Owner B field", ownerUserId: "user-b" });

    const plots = await service.listPlots("user-a");

    expect(plots.map((plot) => plot.name)).toEqual(["Owner A field"]);
  });

  it("deletes all plot-owned heavy records transactionally", async () => {
    const plot = await service.savePlot({ name: "Local plot", mode: "image" });
    await service.saveMeasurements(plot.id, {});
    await service.saveBoundary(plot.id, { north: "Road" });
    await service.saveMedia(plot.id, { fileName: "snapshot.webp" });

    await service.deletePlot(plot.id);

    expect(await service.getPlot(plot.id)).toBeUndefined();
    expect(await service.getMeasurements(plot.id)).toEqual([]);
    expect(await service.getBoundary(plot.id)).toBeUndefined();
    expect(await service.listMedia(plot.id)).toEqual([]);
  });

  it("seeds verified packs, keeps legacy local IDs hidden, and persists a versioned profile", async () => {
    const [units, hierarchy, packs] = await Promise.all([
      service.listUnitRegistry("guest"),
      service.listUnitHierarchy("BIGHA_KATHA_DHUR"),
      service.listInstalledPacks(),
    ]);

    expect(units.find((item) => item.id === "BIGHA").factorToBase).toBeNull();
    expect(hierarchy).toHaveLength(2);
    expect(packs.some((item) => item.id === "global_si_metric")).toBe(true);
    expect(packs.some((item) => item.tier === "research")).toBe(false);

    const saved = await service.saveUserLocalProfile({
      ownerKey: "guest",
      name: "Local",
      familyId: "BIGHA_KATHA_DHUR",
      knownBasis: {
        kind: "tool_length",
        referenceId: "LAGGI",
        value: 8.25,
        sourceUnitId: "FOOT",
      },
      derivedFactors: { BIGHA: 1, KATHA: 0.05, DHUR: 0.0025 },
      hierarchyMultipliers: {
        BIGHA_TO_KATHA: 20,
        KATHA_TO_DHUR: 20,
      },
      isDefault: true,
    });

    expect((await service.listUserLocalProfiles("guest"))[0].id).toBe(saved.id);
    expect(saved.profileVersion).toBe(1);
  });

  it("stores location, custom area/tool and compound recipes separately", async () => {
    await service.saveLocationProfile("guest", { countryCode: "IN", admin1Code: "AS" });
    await service.saveCustomArea({
      ownerKey: "guest",
      name: "Village unit",
      symbol: "vu",
      factorToBase: "10",
    });
    await service.saveCustomTool({
      ownerKey: "guest",
      name: "Village rope",
      symbol: "rope",
      factorToBase: "3",
    });
    await service.saveCompoundRecipe({
      ownerKey: "guest",
      name: "Acre mix",
      unitIds: ["ACRE", "SQFT"],
    });
    expect((await service.getLocationProfile("guest")).admin1Code).toBe("AS");
    expect(await service.listCustomAreas("guest")).toHaveLength(1);
    expect(await service.listCustomTools("guest")).toHaveLength(1);
    expect(await service.listCompoundRecipes("guest")).toHaveLength(1);
  });

  it("removes obsolete universal local-unit rows while preserving custom units", async () => {
    await service.db.unitRegistry.bulkPut([
      {
        id: "KANAL",
        name: "Unsafe universal Kanal",
        symbol: "kanal",
        dimension: "area",
        factorToBase: "505.8570528",
        isCustom: false,
      },
      {
        id: "CUSTOM_KEEP",
        name: "My area",
        symbol: "mine",
        dimension: "area",
        factorToBase: "12",
        isCustom: true,
        ownerKey: "guest",
      },
    ]);

    await service.initialize();

    expect(await service.db.unitRegistry.get("KANAL")).toMatchObject({
      factorToBase: null,
      visibility: "legacy_profile_only",
      trustTier: "legacy",
    });
    expect(await service.db.unitRegistry.get("CUSTOM_KEEP")).toMatchObject({
      isCustom: true,
      ownerKey: "guest",
    });
  });

  it("supports CRUD for standalone custom units and compound setups", async () => {
    await service.saveStandaloneCustomUnit({
      id: "CUSTOM_TEST",
      ownerKey: "guest",
      name: "First name",
      symbol: "ct",
      dimension: "area",
      factorToBase: "10",
      isCustom: true,
    });
    await service.saveStandaloneCustomUnit({
      id: "CUSTOM_TEST",
      ownerKey: "guest",
      name: "Updated name",
      symbol: "ct",
      dimension: "area",
      factorToBase: "12",
      isCustom: true,
    });
    expect((await service.listStandaloneCustomUnits("guest"))[0]).toMatchObject({
      name: "Updated name",
      factorToBase: "12",
    });
    expect(await service.deleteStandaloneCustomUnit("guest", "CUSTOM_TEST"))
      .toMatchObject({ deleted: true });
    expect(await service.listStandaloneCustomUnits("guest")).toHaveLength(0);

    const recipe = await service.saveCompoundRecipe({
      ownerKey: "guest",
      name: "First recipe",
      unitIds: ["ACRE", "SQFT"],
    });
    await service.saveCompoundRecipe({
      ...recipe,
      name: "Updated recipe",
      unitIds: ["ACRE", "SQYD", "SQFT"],
    });
    expect((await service.listCompoundRecipes("guest"))[0].name).toBe("Updated recipe");
    expect(await service.deleteCompoundRecipe("guest", recipe.id))
      .toMatchObject({ deleted: true });
    expect(await service.listCompoundRecipes("guest")).toHaveLength(0);
  });
});
