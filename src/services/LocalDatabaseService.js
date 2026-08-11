import Dexie from "dexie";
import {
  TOOLS_REGISTRY,
  UNIT_HIERARCHY,
  UNIT_REGISTRY,
} from "../data/unitRegistry";
import {
  createBoundary,
  createMeasurement,
  createMediaReference,
  createSavedPlot,
} from "../models/localModels";
import {
  createUnitPreferences,
  createUserLocalProfile,
} from "../models/unitModels";
import {
  createCompoundDisplayRecipe,
  createCustomAreaUnit,
  createCustomMeasuringTool,
  createLocationProfile,
} from "../models/unitIntelligenceModels";
import { unitPackRegistry } from "./UnitPackRegistry";
import {
  COUNTRY_DIRECTORY,
  LOCATION_NODES,
  MEASUREMENT_REGIONS,
  RESEARCH_SUGGESTION_CATALOG_INDEX,
} from "../data/locationCatalog";

export class PlotScaleDatabase extends Dexie {
  constructor(name = "PlotScaleLocal") {
    super(name);
    this.version(1).stores({
      plots: "id, name, mode, ownerUserId, createdAt, modifiedAt",
      measurements: "id, plotId, updatedAt",
      boundaries: "plotId, updatedAt",
      media: "id, plotId, kind, createdAt",
      metadata: "key",
    });
    this.version(2).stores({
      plots: "id, name, mode, ownerUserId, createdAt, modifiedAt",
      measurements: "id, plotId, updatedAt",
      boundaries: "plotId, updatedAt",
      media: "id, plotId, kind, createdAt",
      metadata: "key",
      unitRegistry: "id, dimension, isFlexible, isCustom, ownerKey",
      unitHierarchy: "id, familyId, parentUnitId, childUnitId",
      toolsRegistry: "id, dimension, isFlexible",
      userLocalProfiles: "id, ownerKey, familyId, isDefault, updatedAt",
      unitPreferences: "ownerKey, updatedAt",
    });
    this.version(3).stores({
      plots: "id, name, mode, ownerUserId, createdAt, modifiedAt",
      measurements: "id, plotId, updatedAt",
      boundaries: "plotId, updatedAt",
      media: "id, plotId, kind, createdAt",
      metadata: "key",
      unitRegistry: "id, dimension, isFlexible, isCustom, ownerKey, packId",
      unitHierarchy: "id, familyId, parentUnitId, childUnitId, packId",
      toolsRegistry: "id, dimension, isFlexible, packId",
      userLocalProfiles: "id, ownerKey, familyId, packId, verificationState, isDefault, revision, updatedAt",
      unitPreferences: "ownerKey, updatedAt",
      unitPacks: "[id+version], id, version, tier, status, installedAt",
      packCatalog: "id, activeVersion, updatedAt",
      locationProfiles: "ownerKey, countryCode, admin1Code, updatedAt",
      customAreaUnits: "id, ownerKey, updatedAt",
      customTools: "id, ownerKey, updatedAt",
      compoundRecipes: "id, ownerKey, dimension, updatedAt",
      plotUnitSnapshots: "plotId, profileId, packId, packVersion, createdAt",
    }).upgrade(async (transaction) => {
      const preferences = await transaction.table("unitPreferences").toArray();
      await Promise.all(preferences.map((item) => {
        const next = { ...item };
        if (["BIGHA", "KANAL", "MARLA", "DISMIL", "CENT", "GUNTHA"].includes(next.primaryOutputAreaUnit)) {
          next.primaryOutputAreaUnit = "ACRE";
        }
        if (["BIGHA", "KANAL", "MARLA", "DISMIL", "CENT", "GUNTHA"].includes(next.secondaryOutputAreaUnit)) {
          next.secondaryOutputAreaUnit = "SQFT";
        }
        return transaction.table("unitPreferences").put(next);
      }));
    });
    this.version(4).stores({
      plots: "id, name, mode, ownerUserId, createdAt, modifiedAt",
      measurements: "id, plotId, updatedAt",
      boundaries: "plotId, updatedAt",
      media: "id, plotId, kind, createdAt",
      metadata: "key",
      unitRegistry: "id, dimension, isFlexible, isCustom, ownerKey, packId",
      unitHierarchy: "id, familyId, parentUnitId, childUnitId, packId",
      toolsRegistry: "id, dimension, isFlexible, packId",
      userLocalProfiles: "id, ownerKey, familyId, packId, verificationState, isDefault, revision, updatedAt",
      unitPreferences: "ownerKey, updatedAt",
      unitPacks: "[id+version], id, version, tier, status, installedAt",
      packCatalog: "id, activeVersion, updatedAt",
      locationProfiles: "ownerKey, countryCode, resolutionLevel, updatedAt",
      customAreaUnits: "id, ownerKey, updatedAt",
      customTools: "id, ownerKey, updatedAt",
      compoundRecipes: "id, ownerKey, dimension, updatedAt",
      plotUnitSnapshots: "plotId, profileId, packId, packVersion, createdAt",
      countryDirectory: "code, iso3, name, continent",
      locationNodes: "id, parentId, countryCode, [countryCode+levelIndex], typeCode, officialCode",
      measurementRegions: "id, countryCode, parentMeasurementRegionId, regionType",
      standardUnitCatalog: "id, dimension, packId",
      localSuggestionPacks: "[id+version], id, version, status",
      unitDrafts: "id, ownerKey, status, updatedAt",
      userUnitProfiles: "id, ownerKey, familyId, packId, verificationState, isDefault, revision, updatedAt",
      unitProfileRevisions: "[profileId+profileVersion], profileId, ownerKey, createdAt",
      customUnitFamilies: "id, ownerKey, dimension, updatedAt",
      standaloneCustomUnits: "id, ownerKey, dimension, updatedAt",
      customMeasuringTools: "id, ownerKey, updatedAt",
      catalogVersions: "id, activeVersion, updatedAt",
      unitSyncQueue: "++queueId, ownerKey, entityType, entityId, status, createdAt",
    }).upgrade(async (transaction) => {
      const legacyProfiles = await transaction.table("userLocalProfiles").toArray();
      const migratedProfiles = legacyProfiles.map((profile) => {
        const anchors = profile.anchors?.length
          ? profile.anchors
          : [profile.anchor ?? profile.knownBasis].filter(Boolean);
        return {
          ...profile,
          anchor: anchors[0] ?? null,
          anchors: anchors.slice(0, 1),
          verificationState: "verified_by_user",
          migrationState: anchors.length > 1 ? "needs_review_multiple_anchors" : null,
          isDefault: anchors.length > 1 ? false : profile.isDefault,
          updatedAt: new Date().toISOString(),
        };
      });
      if (migratedProfiles.length) {
        await transaction.table("userUnitProfiles").bulkPut(migratedProfiles);
      }
    });
  }
}

class LocalDatabaseService {
  constructor(database = new PlotScaleDatabase()) {
    this.db = database;
  }

  async initialize() {
    await this.db.open();
    await this.db.transaction(
      "rw",
      this.db.metadata,
      this.db.unitRegistry,
      this.db.unitHierarchy,
      this.db.toolsRegistry,
      this.db.unitPacks,
      this.db.packCatalog,
      async () => {
        const runtimePacks = unitPackRegistry.listPacks({ runtimeOnly: true });
        const installedPackRows = await this.db.unitPacks.toArray();
        const catalogRows = await this.db.packCatalog.toArray();
        const installedKeys = new Set(
          installedPackRows.map((item) => `${item.id}@${item.version}`),
        );
        const catalogById = new Map(catalogRows.map((item) => [item.id, item]));
        const now = new Date().toISOString();
        const bundledPackRows = [];
        const bundledCatalogRows = [];

        runtimePacks.forEach((pack) => {
          const key = `${pack.manifest.id}@${pack.manifest.version}`;
          const catalog = catalogById.get(pack.manifest.id);
          if (!installedKeys.has(key)) {
            bundledPackRows.push({
              id: pack.manifest.id,
              version: pack.manifest.version,
              tier: pack.manifest.tier,
              status: catalog ? "bundled_available" : "active",
              manifest: pack.manifest,
              data: pack.data,
              source: "bundled",
              installedAt: now,
            });
          }
          if (!catalog) {
            bundledCatalogRows.push({
              id: pack.manifest.id,
              activeVersion: pack.manifest.version,
              updatedAt: now,
            });
          }
        });

        await Promise.all([
          this.db.unitRegistry.filter((item) => !item.isCustom).delete(),
          this.db.unitHierarchy.clear(),
          this.db.toolsRegistry.clear(),
        ]);
        await Promise.all([
          this.db.unitRegistry.bulkPut(UNIT_REGISTRY.map((item) => ({ ...item }))),
          this.db.unitHierarchy.bulkPut(UNIT_HIERARCHY.map((item) => ({ ...item }))),
          this.db.toolsRegistry.bulkPut(TOOLS_REGISTRY.map((item) => ({ ...item }))),
          bundledPackRows.length
            ? this.db.unitPacks.bulkPut(bundledPackRows)
            : Promise.resolve(),
          bundledCatalogRows.length
            ? this.db.packCatalog.bulkPut(bundledCatalogRows)
            : Promise.resolve(),
          this.db.metadata.put({
            key: "schema",
            version: 4,
            updatedAt: now,
          }),
        ]);
      },
    );
    const activePacks = await this.listInstalledPacks();
    activePacks
      .filter((pack) => pack.source === "remote")
      .forEach((pack) => unitPackRegistry.installPack({
        manifest: pack.manifest,
        data: pack.data,
        source: "remote-cache",
      }));
    await this.db.transaction(
      "rw",
      this.db.countryDirectory,
      this.db.locationNodes,
      this.db.measurementRegions,
      this.db.standardUnitCatalog,
      this.db.localSuggestionPacks,
      async () => {
        await Promise.all([
          this.db.countryDirectory.bulkPut(COUNTRY_DIRECTORY),
          this.db.locationNodes.bulkPut(LOCATION_NODES),
          this.db.measurementRegions.bulkPut(MEASUREMENT_REGIONS),
          this.db.standardUnitCatalog.bulkPut(
            unitPackRegistry.getRuntimeUnits().map((unit) => ({ ...unit })),
          ),
          this.db.localSuggestionPacks.bulkPut(
            [
              ...unitPackRegistry.listPacks({ tiers: ["suggested"], runtimeOnly: true })
                .map((pack) => ({
                  id: pack.manifest.id,
                  version: pack.manifest.version,
                  status: "active",
                  manifest: pack.manifest,
                  data: pack.data,
                  source: "bundled_family_suggestion",
                })),
              ...RESEARCH_SUGGESTION_CATALOG_INDEX.map((pack) => ({
                id: pack.id,
                version: pack.version,
                status: "active",
                manifest: {
                  id: pack.id,
                  version: pack.version,
                  tier: pack.tier,
                  name: pack.name,
                  countries: pack.countryCodes,
                },
                data: pack,
                source: "generated_research_suggestion",
              })),
            ],
          ),
        ]);
      },
    );
  }

  async listUnitRegistry(ownerKey = "guest") {
    const [units, customAreaUnits] = await Promise.all([
      this.db.unitRegistry.toArray(),
      this.db.customAreaUnits.where("ownerKey").equals(ownerKey).toArray(),
    ]);
    return [
      ...units.filter((item) => !item.isCustom || item.ownerKey === ownerKey),
      ...customAreaUnits,
    ];
  }

  async saveCustomUnit(unit) {
    if (!unit?.isCustom) throw new Error("Only custom units can be saved here.");
    await this.db.unitRegistry.put(unit);
    return unit;
  }

  async deleteCustomUnit(ownerKey, unitId) {
    const unit = await this.db.unitRegistry.get(unitId);
    if (!unit?.isCustom || unit.ownerKey !== ownerKey) {
      throw new Error("Custom unit not found.");
    }
    await this.db.unitRegistry.delete(unitId);
  }

  async listUnitHierarchy(familyId) {
    if (!familyId) return this.db.unitHierarchy.toArray();
    return this.db.unitHierarchy.where("familyId").equals(familyId).toArray();
  }

  async listToolsRegistry() {
    return this.db.toolsRegistry.toArray();
  }

  async listToolsForOwner(ownerKey = "guest") {
    const [tools, customTools] = await Promise.all([
      this.db.toolsRegistry.toArray(),
      this.db.customTools.where("ownerKey").equals(ownerKey).toArray(),
    ]);
    return [...tools, ...customTools];
  }

  async saveUserLocalProfile(input) {
    const existing = input.id
      ? await this.db.userUnitProfiles.get(input.id) ?? await this.db.userLocalProfiles.get(input.id)
      : null;
    const profile = createUserLocalProfile({
      ...input,
      id: input.id,
      createdAt: existing?.createdAt ?? input.createdAt,
      revision: existing ? (existing.revision ?? 1) + 1 : (input.revision ?? 1),
      profileVersion: existing ? (existing.profileVersion ?? 1) + 1 : (input.profileVersion ?? 1),
    });
    if (profile.isDefault) {
      await this.db.transaction(
        "rw",
        this.db.userLocalProfiles,
        this.db.userUnitProfiles,
        this.db.unitProfileRevisions,
        async () => {
          const currentDefaults = await this.db.userUnitProfiles
            .where("ownerKey")
            .equals(profile.ownerKey)
            .filter((item) => item.isDefault)
            .toArray();
          await Promise.all(
            currentDefaults.map((item) =>
              this.db.userUnitProfiles.put({ ...item, isDefault: false }),
            ),
          );
          await this.db.userLocalProfiles.put(profile);
          await this.db.userUnitProfiles.put(profile);
          await this.db.unitProfileRevisions.put({
            ...profile,
            profileId: profile.id,
          });
        },
      );
    } else {
      await this.db.userLocalProfiles.put(profile);
      await this.db.userUnitProfiles.put(profile);
      await this.db.unitProfileRevisions.put({
        ...profile,
        profileId: profile.id,
      });
    }
    return profile;
  }

  async listUserLocalProfiles(ownerKey = "guest") {
    const modern = await this.db.userUnitProfiles
      .where("ownerKey")
      .equals(ownerKey)
      .reverse()
      .sortBy("updatedAt");
    const source = modern.length
      ? modern
      : await this.db.userLocalProfiles.where("ownerKey").equals(ownerKey).reverse().sortBy("updatedAt");
    return source.map((profile) => ({
      ...profile,
      profileVersion: profile.profileVersion ?? 1,
      revision: profile.revision ?? 1,
      verificationState: "verified_by_user",
    }));
  }

  async importUserLocalProfileSnapshot(input) {
    const profile = createUserLocalProfile({
      ...input,
      anchor: input.anchor ?? input.knownBasis,
    });
    await this.db.transaction(
      "rw",
      this.db.userLocalProfiles,
      this.db.userUnitProfiles,
      this.db.unitProfileRevisions,
      async () => {
        await this.db.userLocalProfiles.put(profile);
        await this.db.userUnitProfiles.put(profile);
        await this.db.unitProfileRevisions.put({ ...profile, profileId: profile.id });
      },
    );
    return profile;
  }

  async getUserLocalProfile(id) {
    return (await this.db.userUnitProfiles.get(id)) ?? this.db.userLocalProfiles.get(id);
  }

  async deleteUserLocalProfile(ownerKey, id) {
    const profile = await this.db.userLocalProfiles.get(id);
    if (!profile || profile.ownerKey !== ownerKey) {
      throw new Error("Local unit profile not found.");
    }
    await this.db.userLocalProfiles.delete(id);
    await this.db.userUnitProfiles.delete(id);
  }

  async listUnitProfileRevisions(profileId) {
    return this.db.unitProfileRevisions.where("profileId").equals(profileId).sortBy("profileVersion");
  }

  async resolveUnitProfileConflict(ownerKey, profileId, resolution) {
    const profile = await this.db.userUnitProfiles.get(profileId);
    if (!profile || profile.ownerKey !== ownerKey || profile.migrationState !== "conflict_review_required") {
      throw new Error("Conflicting unit profile not found.");
    }
    const resolved = {
      ...profile,
      migrationState: null,
      isArchived: resolution === "archive",
      conflictResolution: resolution,
      profileVersion: (profile.profileVersion ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.db.transaction(
      "rw",
      this.db.userLocalProfiles,
      this.db.userUnitProfiles,
      this.db.unitProfileRevisions,
      async () => {
        await this.db.userLocalProfiles.put(resolved);
        await this.db.userUnitProfiles.put(resolved);
        await this.db.unitProfileRevisions.put({ ...resolved, profileId });
      },
    );
    return resolved;
  }

  async isProfileReferenced(profileId) {
    return (await this.db.plotUnitSnapshots.where("profileId").equals(profileId).count()) > 0;
  }

  async saveUnitPreferences(ownerKey, input) {
    const preferences = createUnitPreferences({ ...input, ownerKey });
    await this.db.unitPreferences.put(preferences);
    return preferences;
  }

  async getUnitPreferences(ownerKey = "guest") {
    return (
      (await this.db.unitPreferences.get(ownerKey)) ??
      createUnitPreferences({ ownerKey })
    );
  }

  async saveLocationProfile(ownerKey, input) {
    const profile = createLocationProfile({ ...input, ownerKey });
    await this.db.locationProfiles.put(profile);
    return profile;
  }

  async getLocationProfile(ownerKey = "guest") {
    return this.db.locationProfiles.get(ownerKey);
  }

  async saveCustomArea(input) {
    const unit = createCustomAreaUnit(input);
    await this.db.customAreaUnits.put(unit);
    await this.db.standaloneCustomUnits.put(unit);
    return unit;
  }

  async listCustomAreas(ownerKey = "guest") {
    const modern = await this.db.standaloneCustomUnits
      .where("ownerKey").equals(ownerKey)
      .filter((unit) => unit.dimension === "area")
      .toArray();
    if (modern.length) return modern;
    return this.db.customAreaUnits.where("ownerKey").equals(ownerKey).toArray();
  }

  async saveCustomTool(input) {
    const tool = createCustomMeasuringTool(input);
    await this.db.customTools.put(tool);
    await this.db.customMeasuringTools.put(tool);
    return tool;
  }

  async listCustomTools(ownerKey = "guest") {
    const modern = await this.db.customMeasuringTools.where("ownerKey").equals(ownerKey).toArray();
    if (modern.length) return modern;
    return this.db.customTools.where("ownerKey").equals(ownerKey).toArray();
  }

  async saveUnitDraft(input) {
    const draft = {
      ...input,
      id: input.id ?? `DRAFT_${crypto.randomUUID()}`,
      ownerKey: input.ownerKey ?? "guest",
      status: input.status ?? "draft",
      updatedAt: new Date().toISOString(),
    };
    await this.db.unitDrafts.put(draft);
    return draft;
  }

  async listUnitDrafts(ownerKey = "guest") {
    return this.db.unitDrafts.where("ownerKey").equals(ownerKey).reverse().sortBy("updatedAt");
  }

  async getUnitDraft(ownerKey, id) {
    const draft = await this.db.unitDrafts.get(id);
    return draft?.ownerKey === ownerKey ? draft : null;
  }

  async deleteUnitDraft(ownerKey, id) {
    const draft = await this.db.unitDrafts.get(id);
    if (draft?.ownerKey === ownerKey) await this.db.unitDrafts.delete(id);
  }

  async claimUnitDraft(fromOwnerKey, toOwnerKey, id) {
    const draft = await this.db.unitDrafts.get(id);
    if (!draft || draft.ownerKey !== fromOwnerKey) {
      throw new Error("Unit setup draft not found.");
    }
    const claimed = {
      ...draft,
      ownerKey: toOwnerKey,
      claimedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.db.unitDrafts.put(claimed);
    return claimed;
  }

  async saveCustomFamily(input) {
    const family = {
      ...input,
      id: input.id ?? `CUSTOM_FAMILY_${crypto.randomUUID()}`,
      ownerKey: input.ownerKey ?? "guest",
      updatedAt: new Date().toISOString(),
    };
    await this.db.customUnitFamilies.put(family);
    return family;
  }

  async listCustomFamilies(ownerKey = "guest") {
    return this.db.customUnitFamilies.where("ownerKey").equals(ownerKey).reverse().sortBy("updatedAt");
  }

  async saveStandaloneCustomUnit(unit) {
    await this.db.standaloneCustomUnits.put(unit);
    return unit;
  }

  async listStandaloneCustomUnits(ownerKey = "guest") {
    return this.db.standaloneCustomUnits.where("ownerKey").equals(ownerKey).toArray();
  }

  async deleteStandaloneCustomUnit(ownerKey, id) {
    const unit = await this.db.standaloneCustomUnits.get(id);
    if (!unit || unit.ownerKey !== ownerKey) throw new Error("Custom unit not found.");
    const referenced = (await this.db.plotUnitSnapshots.toArray())
      .some((snapshot) => JSON.stringify(snapshot).includes(JSON.stringify(id)));
    if (referenced) {
      return {
        archived: true,
        value: await this.archiveCustomEntity(ownerKey, "unit", id),
      };
    }
    await this.db.transaction(
      "rw",
      this.db.standaloneCustomUnits,
      this.db.customAreaUnits,
      async () => {
        await this.db.standaloneCustomUnits.delete(id);
        await this.db.customAreaUnits.delete(id);
      },
    );
    return { deleted: true, archived: false };
  }

  async enqueueUnitSync(input) {
    const existing = await this.db.unitSyncQueue
      .where("ownerKey").equals(input.ownerKey)
      .filter((item) =>
        item.status === "pending"
        && item.entityType === input.entityType
        && item.entityId === input.entityId)
      .first();
    const row = {
      ...input,
      status: input.status ?? "pending",
      idempotencyKey: input.idempotencyKey ?? existing?.idempotencyKey ?? crypto.randomUUID(),
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? input.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      await this.db.unitSyncQueue.put({ ...row, queueId: existing.queueId });
      return { ...row, queueId: existing.queueId };
    }
    const queueId = await this.db.unitSyncQueue.add(row);
    return { ...row, queueId };
  }

  async listPendingUnitSync(ownerKey, { includeDeferred = false } = {}) {
    const now = Date.now();
    return this.db.unitSyncQueue
      .where("ownerKey").equals(ownerKey)
      .filter((item) =>
        item.status === "pending"
        && (includeDeferred || !item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= now))
      .toArray();
  }

  async updateUnitSync(queueId, changes) {
    await this.db.unitSyncQueue.update(queueId, changes);
  }

  async completeUnitSync(queueId) {
    await this.db.unitSyncQueue.delete(queueId);
  }

  async saveCompoundRecipe(input) {
    const recipe = createCompoundDisplayRecipe(input);
    await this.db.compoundRecipes.put(recipe);
    return recipe;
  }

  async importUnitSetupAtomic(ownerKey, data) {
    const copyId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
    return this.db.transaction(
      "rw",
      this.db.locationProfiles,
      this.db.userLocalProfiles,
      this.db.userUnitProfiles,
      this.db.unitProfileRevisions,
      this.db.customUnitFamilies,
      this.db.standaloneCustomUnits,
      this.db.customMeasuringTools,
      this.db.compoundRecipes,
      this.db.unitPreferences,
      async () => {
        if (data.location) {
          await this.db.locationProfiles.put({ ...data.location, ownerKey });
        }
        for (const source of data.profiles ?? []) {
          const exists = await this.db.userUnitProfiles.get(source.id);
          const id = exists ? copyId("IMPORTED_PROFILE") : source.id;
          const profile = {
            ...source,
            id,
            ownerKey,
            name: exists ? `${source.name} (imported copy)` : source.name,
            isDefault: false,
            updatedAt: new Date().toISOString(),
          };
          await this.db.userLocalProfiles.put(profile);
          await this.db.userUnitProfiles.put(profile);
          await this.db.unitProfileRevisions.put({ ...profile, profileId: id });
        }
        const collections = [
          ["customUnitFamilies", data.customFamilies, "IMPORTED_FAMILY"],
          ["standaloneCustomUnits", data.standaloneUnits, "IMPORTED_UNIT"],
          ["customMeasuringTools", data.tools, "IMPORTED_TOOL"],
          ["compoundRecipes", data.recipes, "IMPORTED_RECIPE"],
        ];
        for (const [tableName, records = [], prefix] of collections) {
          const table = this.db.table(tableName);
          for (const source of records) {
            const exists = await table.get(source.id);
            await table.put({
              ...source,
              id: exists ? copyId(prefix) : source.id,
              ownerKey,
              name: exists ? `${source.name} (imported copy)` : source.name,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        if (data.preferences) {
          await this.db.unitPreferences.put({
            ...data.preferences,
            ownerKey,
            activeLocalProfileId: null,
            activeCompoundRecipeId: null,
            updatedAt: new Date().toISOString(),
          });
        }
      },
    );
  }

  async listCompoundRecipes(ownerKey = "guest") {
    return this.db.compoundRecipes.where("ownerKey").equals(ownerKey).toArray();
  }

  async deleteCompoundRecipe(ownerKey, id) {
    const recipe = await this.db.compoundRecipes.get(id);
    if (!recipe || recipe.ownerKey !== ownerKey) throw new Error("Compound setup not found.");
    const referenced = (await this.db.plotUnitSnapshots.toArray())
      .some((snapshot) => snapshot.recipe?.id === id);
    if (referenced) {
      return {
        archived: true,
        value: await this.archiveCustomEntity(ownerKey, "recipe", id),
      };
    }
    await this.db.compoundRecipes.delete(id);
    return { deleted: true, archived: false };
  }

  async archiveCustomEntity(ownerKey, entityType, id) {
    const tables = {
      family: this.db.customUnitFamilies,
      unit: this.db.standaloneCustomUnits,
      tool: this.db.customMeasuringTools,
      recipe: this.db.compoundRecipes,
    };
    const table = tables[entityType];
    if (!table) throw new Error("Unsupported custom entity type.");
    const entity = await table.get(id);
    if (!entity || entity.ownerKey !== ownerKey) throw new Error("Custom unit item not found.");
    const archived = {
      ...entity,
      isArchived: true,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await table.put(archived);
    return archived;
  }

  async listInstalledPacks() {
    return this.db.unitPacks.where("status").equals("active").toArray();
  }

  async stageUnitPack({ manifest, data, stagedAt }) {
    await this.db.unitPacks.put({
      id: manifest.id,
      version: manifest.version,
      tier: manifest.tier,
      status: "staged",
      manifest,
      data,
      source: "remote",
      installedAt: stagedAt,
    });
  }

  async activateStagedUnitPack(id, version) {
    await this.db.transaction("rw", this.db.unitPacks, this.db.packCatalog, async () => {
      const staged = await this.db.unitPacks.get([id, version]);
      if (!staged || staged.status !== "staged") throw new Error("Staged unit pack not found.");
      const current = await this.db.unitPacks.where("id").equals(id)
        .filter((item) => item.status === "active")
        .first();
      if (current) await this.db.unitPacks.put({ ...current, status: "previous" });
      await this.db.unitPacks.put({ ...staged, status: "active" });
      await this.db.packCatalog.put({
        id,
        activeVersion: version,
        previousVersion: current?.version ?? null,
        updatedAt: new Date().toISOString(),
      });
    });
  }

  async rollbackUnitPack(id) {
    return this.db.transaction("rw", this.db.unitPacks, this.db.packCatalog, async () => {
      const versions = await this.db.unitPacks.where("id").equals(id).toArray();
      const current = versions.find((item) => item.status === "active");
      const previous = versions
        .filter((item) => item.status === "previous")
        .sort((a, b) => b.installedAt.localeCompare(a.installedAt))[0];
      if (!current || !previous) throw new Error("No rollback version is available.");
      await this.db.unitPacks.put({ ...current, status: "superseded" });
      await this.db.unitPacks.put({ ...previous, status: "active" });
      await this.db.packCatalog.put({
        id,
        activeVersion: previous.version,
        previousVersion: current.version,
        updatedAt: new Date().toISOString(),
      });
      return previous;
    });
  }

  async activateCatalogRelease(release) {
    await this.db.transaction(
      "rw",
      this.db.countryDirectory,
      this.db.locationNodes,
      this.db.measurementRegions,
      this.db.localSuggestionPacks,
      this.db.catalogVersions,
      async () => {
        await Promise.all([
          this.db.countryDirectory.clear(),
          this.db.locationNodes.clear(),
          this.db.measurementRegions.clear(),
        ]);
        await Promise.all([
          this.db.countryDirectory.bulkPut(release.countries),
          this.db.locationNodes.bulkPut(release.locationNodes ?? []),
          this.db.measurementRegions.bulkPut(release.measurementRegions ?? []),
          this.db.localSuggestionPacks.bulkPut(
            (release.researchSuggestionIndex ?? []).map((pack) => ({
              id: pack.id,
              version: pack.version,
              status: "active",
              manifest: pack,
              data: pack,
              source: "signed_catalog_release",
            })),
          ),
          this.db.catalogVersions.put({
            id: "unit-intelligence-catalog",
            activeVersion: release.version,
            previousVersion: (await this.db.catalogVersions.get("unit-intelligence-catalog"))
              ?.activeVersion ?? null,
            payload: release,
            updatedAt: new Date().toISOString(),
          }),
        ]);
      },
    );
  }

  async getActiveCatalogRelease() {
    return (await this.db.catalogVersions.get("unit-intelligence-catalog"))?.payload ?? null;
  }

  async savePlotUnitSnapshot(plotId, input) {
    const snapshot = {
      ...input,
      plotId,
      createdAt: new Date().toISOString(),
    };
    await this.db.plotUnitSnapshots.put(snapshot);
    return snapshot;
  }

  async getPlotUnitSnapshot(plotId) {
    return this.db.plotUnitSnapshots.get(plotId);
  }

  async savePlot(input) {
    const plot = createSavedPlot(input);
    await this.db.plots.put(plot);
    return plot;
  }

  async updatePlot(id, changes) {
    const existing = await this.db.plots.get(id);
    if (!existing) throw new Error("Plot not found.");
    const updated = {
      ...existing,
      ...changes,
      id,
      modifiedAt: new Date().toISOString(),
    };
    await this.db.plots.put(updated);
    return updated;
  }

  async getPlot(id) {
    return this.db.plots.get(id);
  }

  async listPlots(ownerUserId) {
    if (ownerUserId) {
      return this.db.plots
        .where("ownerUserId")
        .equals(ownerUserId)
        .reverse()
        .sortBy("modifiedAt");
    }
    return this.db.plots.orderBy("modifiedAt").reverse().toArray();
  }

  async saveMeasurements(plotId, input) {
    const measurement = createMeasurement(plotId, input);
    await this.db.measurements.put(measurement);
    return measurement;
  }

  async getMeasurements(plotId) {
    return this.db.measurements.where("plotId").equals(plotId).toArray();
  }

  async saveBoundary(plotId, input) {
    const boundary = createBoundary(plotId, input);
    await this.db.boundaries.put(boundary);
    return boundary;
  }

  async getBoundary(plotId) {
    return this.db.boundaries.get(plotId);
  }

  async saveMedia(plotId, input) {
    const media = createMediaReference(plotId, input);
    await this.db.media.put(media);
    return media;
  }

  async listMedia(plotId) {
    return this.db.media.where("plotId").equals(plotId).toArray();
  }

  async deleteMedia(id) {
    await this.db.media.delete(id);
  }

  async deletePlot(id) {
    await this.db.transaction(
      "rw",
      this.db.plots,
      this.db.measurements,
      this.db.boundaries,
      this.db.media,
      this.db.plotUnitSnapshots,
      async () => {
        await this.db.measurements.where("plotId").equals(id).delete();
        await this.db.boundaries.delete(id);
        await this.db.media.where("plotId").equals(id).delete();
        await this.db.plotUnitSnapshots.delete(id);
        await this.db.plots.delete(id);
      },
    );
  }

  async getStorageSummary() {
    const [plots, measurements, media] = await Promise.all([
      this.db.plots.count(),
      this.db.measurements.count(),
      this.db.media.count(),
    ]);
    return { plots, measurements, media };
  }
}

export const localDatabaseService = new LocalDatabaseService();
export { LocalDatabaseService };
