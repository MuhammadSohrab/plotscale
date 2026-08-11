import { cloudSyncService } from "./CloudSyncService";
import { localDatabaseService } from "./LocalDatabaseService";
import { isCloudConfigured } from "./supabaseClient";

export class UnitProfileRepository {
  constructor({
    local = localDatabaseService,
    cloud = cloudSyncService,
  } = {}) {
    this.local = local;
    this.cloud = cloud;
  }

  async save(profile, { sync = false } = {}) {
    const saved = await this.local.saveUserLocalProfile(profile);
    if (!sync || profile.ownerKey === "guest" || !isCloudConfigured) {
      return { value: saved, synced: false, pending: false };
    }
    try {
      await this.cloud.saveUnitProfile(profile.ownerKey, saved);
      return { value: saved, synced: true, pending: false };
    } catch (error) {
      await this.local.enqueueUnitSync({
        ownerKey: profile.ownerKey,
        entityType: "unit_profile",
        entityId: saved.id,
        payload: saved,
      });
      return { value: saved, synced: false, pending: true, error };
    }
  }

  async list(ownerKey = "guest") {
    return this.local.listUserLocalProfiles(ownerKey);
  }

  async pullAndMerge(ownerKey) {
    if (!ownerKey || ownerKey === "guest" || !isCloudConfigured) {
      return { imported: 0, conflicts: 0 };
    }
    const bundle = await this.cloud.getUnitBundle(ownerKey);
    const localProfiles = await this.local.listUserLocalProfiles(ownerKey);
    let imported = 0;
    let conflicts = 0;
    for (const remote of bundle.profiles ?? []) {
      const local = localProfiles.find((profile) => profile.id === remote.id);
      if (!local) {
        await this.local.importUserLocalProfileSnapshot({ ...remote, ownerKey });
        imported += 1;
        continue;
      }
      const same = JSON.stringify({
        factors: local.derivedFactors,
        ratios: local.hierarchyMultipliers,
        anchor: local.anchor,
      }) === JSON.stringify({
        factors: remote.derivedFactors,
        ratios: remote.hierarchyMultipliers,
        anchor: remote.anchor ?? remote.knownBasis,
      });
      if (same) continue;
      await this.local.importUserLocalProfileSnapshot({
        ...remote,
        id: crypto.randomUUID(),
        ownerKey,
        name: `${remote.name} — cloud conflict`,
        isDefault: false,
        migrationState: "conflict_review_required",
      });
      conflicts += 1;
    }
    const configuration = bundle.configuration ?? {};
    for (const family of configuration.customFamilies ?? []) {
      await this.local.saveCustomFamily({ ...family, ownerKey });
    }
    for (const unit of configuration.standaloneUnits ?? []) {
      await this.local.saveStandaloneCustomUnit({ ...unit, ownerKey });
    }
    for (const tool of configuration.customTools ?? []) {
      await this.local.saveCustomTool({ ...tool, ownerKey });
    }
    const userData = bundle.userData ?? {};
    for (const recipe of userData.compoundRecipes ?? []) {
      await this.local.saveCompoundRecipe({ ...recipe, ownerKey });
    }
    if (userData.locationProfile?.countryCode) {
      await this.local.saveLocationProfile(ownerKey, userData.locationProfile);
    }
    if (configuration.preferences) {
      await this.local.saveUnitPreferences(ownerKey, configuration.preferences);
    }
    return { imported, conflicts };
  }

  async snapshotForPlot(plotId, profile, recipe = null) {
    if (!profile) return null;
    return this.local.savePlotUnitSnapshot(plotId, {
      profileId: profile.id,
      profileVersion: profile.profileVersion,
      packId: profile.packId,
      packVersion: profile.packVersion,
      derivedFactors: { ...profile.derivedFactors },
      hierarchyMultipliers: { ...profile.hierarchyMultipliers },
      recipe: recipe ? { ...recipe } : null,
    });
  }

  async syncUserData(ownerKey) {
    if (ownerKey === "guest" || !isCloudConfigured) {
      return { synced: false, pending: false };
    }
    const [
      locationProfile,
      customAreaUnits,
      customTools,
      compoundRecipes,
      customFamilies,
      standaloneUnits,
      preferences,
    ] = await Promise.all([
      this.local.getLocationProfile(ownerKey),
      this.local.listCustomAreas(ownerKey),
      this.local.listCustomTools(ownerKey),
      this.local.listCompoundRecipes(ownerKey),
      this.local.listCustomFamilies(ownerKey),
      this.local.listStandaloneCustomUnits(ownerKey),
      this.local.getUnitPreferences(ownerKey),
    ]);
    try {
      await this.cloud.saveUnitUserData(ownerKey, {
        locationProfile,
        customAreaUnits,
        customTools,
        compoundRecipes,
      });
      await this.cloud.saveUnitConfiguration(ownerKey, {
        customFamilies,
        standaloneUnits,
        customTools,
        preferences,
      });
      return { synced: true, pending: false };
    } catch (error) {
      await this.local.enqueueUnitSync({
        ownerKey,
        entityType: "unit_configuration",
        entityId: ownerKey,
        payload: {
          locationProfile,
          customAreaUnits,
          customTools,
          compoundRecipes,
          customFamilies,
          standaloneUnits,
          preferences,
        },
      });
      return { synced: false, pending: true, error };
    }
  }
}

export const unitProfileRepository = new UnitProfileRepository();
