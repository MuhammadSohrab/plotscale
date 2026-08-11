import { create } from "zustand";
import {
  DEFAULT_UNIT_PREFERENCES,
  LEGACY_UNIT_ID_MIGRATIONS,
} from "../data/unitRegistry";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { packUpdateService } from "../services/PackUpdateService";
import { unitPackRegistry } from "../services/UnitPackRegistry";
import { unitProfileRepository } from "../services/UnitProfileRepository";
import { unitConversionService } from "../services/UnitConversionService";
import { compositeOutputFormatter } from "../utils/CompositeOutputFormatter";
import { entitlementService } from "../services/EntitlementService";
import { locationService } from "../services/LocationService";
import { unitEngine } from "../services/UnitEngine";
import { createStandaloneCustomUnit } from "../models/unitEngineModels";
import { createUserLocalProfile } from "../models/unitModels";
import { unitEvidenceService } from "../services/UnitEvidenceService";

const initialState = {
  status: "idle",
  ownerKey: "guest",
  units: [],
  hierarchies: [],
  tools: [],
  installedPacks: [],
  locationProfile: null,
  locationSuggestions: { verified: [], suggested: [], researchCandidates: [] },
  profiles: [],
  customAreaUnits: [],
  customTools: [],
  customFamilies: [],
  standaloneCustomUnits: [],
  drafts: [],
  compoundRecipes: [],
  cloudSyncStatus: "local",
  packUpdateStatus: "idle",
  preferences: { ...DEFAULT_UNIT_PREFERENCES },
  activeProfile: null,
  runtimeFactors: {},
  entitlementContext: { subscriptionStatus: "free", isGuest: true },
  capabilities: entitlementService.getCapabilities({ subscriptionStatus: "free", isGuest: true }),
  error: null,
};

export const useUnitStore = create((set, get) => ({
  ...initialState,

  hydrate: async (ownerKey = "guest", entitlementContext = null) => {
    const effectiveEntitlement = entitlementContext ?? get().entitlementContext;
    const capabilities = entitlementService.getCapabilities(effectiveEntitlement);
    set({
      status: "loading",
      ownerKey,
      entitlementContext: effectiveEntitlement,
      capabilities,
      error: null,
    });
    try {
      await localDatabaseService.initialize();
      const [
        storedUnits,
        storedHierarchies,
        tools,
        profiles,
        preferences,
        installedPacks,
        locationProfile,
        customAreaUnits,
        customTools,
        compoundRecipes,
        customFamilies,
        standaloneCustomUnits,
        drafts,
      ] =
        await Promise.all([
          localDatabaseService.listUnitRegistry(ownerKey),
          localDatabaseService.listUnitHierarchy(),
          localDatabaseService.listToolsForOwner(ownerKey),
          localDatabaseService.listUserLocalProfiles(ownerKey),
          localDatabaseService.getUnitPreferences(ownerKey),
          localDatabaseService.listInstalledPacks(),
          localDatabaseService.getLocationProfile(ownerKey),
          localDatabaseService.listCustomAreas(ownerKey),
          localDatabaseService.listCustomTools(ownerKey),
          localDatabaseService.listCompoundRecipes(ownerKey),
          localDatabaseService.listCustomFamilies(ownerKey),
          localDatabaseService.listStandaloneCustomUnits(ownerKey),
          localDatabaseService.listUnitDrafts(ownerKey),
        ]);
      const eligibleProfiles = profiles.filter((item) => !item.isArchived && !item.migrationState);
      const activeProfile = capabilities.canUseLocalProfiles
        ? eligibleProfiles.find((item) => item.id === preferences.activeLocalProfileId) ??
          eligibleProfiles.find((item) => item.isDefault) ??
          eligibleProfiles[0] ??
          null
        : null;
      const profileUnits = activeProfile?.packId
        ? unitPackRegistry.getRuntimeUnits({
          packIds: [activeProfile.packId],
          includeSuggested: true,
          includeHistorical: true,
        })
        : [];
      const profileRelationships = activeProfile?.packId
        ? unitPackRegistry.getRuntimeRelationships({
          packIds: [activeProfile.packId],
          includeSuggested: true,
        })
        : [];
      const verifiedRuntimeUnits = unitPackRegistry.getRuntimeUnits();
      const normalizedStoredUnits = storedUnits.map((unit) =>
        Object.hasOwn(LEGACY_UNIT_ID_MIGRATIONS, unit.id)
          ? {
            ...unit,
            factorToBase: null,
            visibility: "legacy_profile_only",
            trustTier: "legacy",
          }
          : unit);
      const units = [
        ...normalizedStoredUnits.filter((unit) =>
          unit.visibility !== "legacy_profile_only" ||
          Object.hasOwn(activeProfile?.derivedFactors ?? {}, unit.id)),
        ...verifiedRuntimeUnits.filter((unit) =>
          !normalizedStoredUnits.some((stored) => stored.id === unit.id)),
        ...profileUnits.filter((unit) =>
          !normalizedStoredUnits.some((stored) => stored.id === unit.id)),
        ...standaloneCustomUnits.filter((unit) => !unit.isArchived),
        ...customFamilies.filter((family) => !family.isArchived).flatMap((family) => family.members.map((member) => ({
          ...member,
          familyId: family.familyId ?? family.id,
          factorToBase: activeProfile?.derivedFactors?.[member.id] ?? null,
          isCustom: true,
          customKind: "family_member",
        }))),
      ];
      const resolvedSuggestions = locationProfile
        ? locationService.resolveSuggestions(locationProfile)
        : { suggested: [], broaderCandidates: [], researchCandidates: [] };
      const suggestions = {
        verified: [],
        suggested: [
          ...resolvedSuggestions.suggested,
          ...resolvedSuggestions.broaderCandidates,
        ].filter((pack, index, all) =>
          all.findIndex((candidate) => candidate.manifest.id === pack.manifest.id) === index),
        warning: resolvedSuggestions.warning ?? null,
        requiresRefinement: resolvedSuggestions.requiresRefinement ?? false,
        researchCandidates: resolvedSuggestions.researchCandidates ?? [],
      };
      set({
        status: "ready",
        units,
        hierarchies: [...storedHierarchies, ...profileRelationships],
        tools,
        installedPacks,
        locationProfile,
        locationSuggestions: suggestions,
        profiles,
        customAreaUnits,
        customTools,
        compoundRecipes,
        customFamilies,
        standaloneCustomUnits,
        drafts,
        preferences,
        activeProfile,
        runtimeFactors: activeProfile?.derivedFactors ?? {},
      });
    } catch (error) {
      set({ status: "error", error: error.message });
    }
  },

  savePreferences: async (changes) => {
    const { ownerKey, preferences } = get();
    const saved = await localDatabaseService.saveUnitPreferences(ownerKey, {
      ...preferences,
      ...changes,
    });
    set({ preferences: saved });
    if (ownerKey !== "guest" && get().capabilities.canSyncUnitProfiles) {
      const syncResult = await unitProfileRepository.syncUserData(ownerKey);
      set({
        cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
      });
    }
    return saved;
  },

  saveLocalProfile: async (input) => {
    const { ownerKey, preferences, entitlementContext } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    const derived = unitConversionService.deriveFamily({ ...input, ownerKey });
    const syncResult = await unitProfileRepository.save(derived, {
      sync: ownerKey !== "guest" && get().capabilities.canSyncUnitProfiles,
    });
    const saved = syncResult.value;
    const profiles = await localDatabaseService.listUserLocalProfiles(ownerKey);
    const nextPreferences = await localDatabaseService.saveUnitPreferences(ownerKey, {
      ...preferences,
      activeLocalProfileId: saved.id,
    });
    set({
      profiles,
      preferences: nextPreferences,
      activeProfile: saved,
      runtimeFactors: saved.derivedFactors,
      cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
    });
    return saved;
  },

  calibrateSuggestedFamily: async (input) => {
    const { ownerKey, preferences, entitlementContext } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    const draft = input.draft ?? unitEngine.createDraftFromSuggestion(input.packId, input.familyId);
    const profile = unitEngine.derivePreview(
      {
        ...draft,
        relationships: draft.relationships.map((relationship) => ({
          ...relationship,
          multiplier: input.hierarchyMultipliers?.[relationship.id] ?? relationship.multiplier,
          confirmedByUser: true,
        })),
      },
      input.anchor ?? input.anchors?.[0] ?? input.knownBasis,
    );
    const savableProfile = {
      ...profile,
      ownerKey,
      isDefault: input.isDefault ?? true,
    };
    const syncResult = await unitProfileRepository.save(savableProfile, {
      sync: ownerKey !== "guest" && get().capabilities.canSyncUnitProfiles,
    });
    const saved = syncResult.value;
    const nextPreferences = await localDatabaseService.saveUnitPreferences(ownerKey, {
      ...preferences,
      activeLocalProfileId: saved.id,
    });
    await get().hydrate(ownerKey);
    set({
      preferences: nextPreferences,
      cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
    });
    return saved;
  },

  saveLocation: async (input) => {
    const { ownerKey } = get();
    const locationProfile = await localDatabaseService.saveLocationProfile(ownerKey, input);
    const resolved = locationService.resolveSuggestions(locationProfile);
    const locationSuggestions = {
      verified: [],
      suggested: [...resolved.suggested, ...resolved.broaderCandidates]
        .filter((pack, index, all) =>
          all.findIndex((candidate) => candidate.manifest.id === pack.manifest.id) === index),
      warning: resolved.warning,
      requiresRefinement: resolved.requiresRefinement,
      researchCandidates: resolved.researchCandidates ?? [],
    };
    const syncResult = get().capabilities.canSyncUnitProfiles
      ? await unitProfileRepository.syncUserData(ownerKey)
      : { synced: false, pending: false };
    set({
      locationProfile,
      locationSuggestions,
      cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
    });
    return locationProfile;
  },

  setActiveProfile: async (profileId) => {
    const profile = get().profiles.find((item) => item.id === profileId);
    if (!profile || profile.isArchived || profile.migrationState) {
      throw new Error("An active, reviewed local unit profile is required.");
    }
    entitlementService.require("canUseLocalProfiles", get().entitlementContext);
    await get().savePreferences({ activeLocalProfileId: profileId });
    set({
      activeProfile: profile,
      runtimeFactors: profile.derivedFactors,
    });
  },

  duplicateProfile: async (profileId) => {
    const { ownerKey, entitlementContext } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    const source = get().profiles.find((item) => item.id === profileId);
    if (!source) throw new Error("Unit profile not found.");
    const copy = createUserLocalProfile({
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} copy`,
      isDefault: false,
      profileVersion: 1,
      revision: 1,
      createdAt: undefined,
      anchor: source.anchor ?? source.knownBasis,
    });
    const saved = await unitProfileRepository.save(copy, {
      sync: ownerKey !== "guest" && get().capabilities.canSyncUnitProfiles,
    });
    await get().hydrate(ownerKey, entitlementContext);
    return saved.value;
  },

  archiveProfile: async (profileId) => {
    const { ownerKey, entitlementContext, preferences } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    const source = get().profiles.find((item) => item.id === profileId);
    if (!source) throw new Error("Unit profile not found.");
    const saved = await localDatabaseService.saveUserLocalProfile({
      ...source,
      isDefault: false,
      isArchived: true,
      anchor: source.anchor ?? source.knownBasis,
    });
    if (preferences.activeLocalProfileId === profileId) {
      const next = get().profiles.find(
        (item) => item.id !== profileId && !item.isArchived && !item.migrationState,
      );
      await localDatabaseService.saveUnitPreferences(ownerKey, {
        ...preferences,
        activeLocalProfileId: next?.id ?? null,
      });
    }
    await get().hydrate(ownerKey, entitlementContext);
    return saved;
  },

  setDefaultProfile: async (profileId) => {
    const { ownerKey, entitlementContext } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    const source = get().profiles.find(
      (item) => item.id === profileId && !item.isArchived && !item.migrationState,
    );
    if (!source) throw new Error("Unit profile not found.");
    const saved = await unitProfileRepository.save({
      ...source,
      isDefault: true,
      anchor: source.anchor ?? source.knownBasis,
    }, {
      sync: ownerKey !== "guest" && get().capabilities.canSyncUnitProfiles,
    });
    await get().hydrate(ownerKey, entitlementContext);
    return saved.value;
  },

  saveCustomUnit: async (input) => {
    const { ownerKey, units, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    const customUnit = unitConversionService.createCustomUnit(
      { ...input, ownerKey },
      units.filter((item) => item.isCustom),
    );
    await localDatabaseService.saveCustomUnit(customUnit);
    set({ units: [...units, customUnit] });
    return customUnit;
  },

  saveCustomArea: async (input) => {
    const { ownerKey, units, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    const custom = unitConversionService.createCustomArea(
      { ...input, ownerKey },
      units,
    );
    await localDatabaseService.saveCustomArea(custom);
    await get().hydrate(ownerKey);
    const syncResult = await unitProfileRepository.syncUserData(ownerKey);
    set({
      cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
    });
    return custom;
  },

  saveCustomTool: async (input) => {
    const { ownerKey, units, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    const custom = unitConversionService.createCustomTool(
      { ...input, ownerKey },
      units,
    );
    await localDatabaseService.saveCustomTool(custom);
    await get().hydrate(ownerKey);
    const syncResult = await unitProfileRepository.syncUserData(ownerKey);
    set({
      cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
    });
    return custom;
  },

  saveCompoundRecipe: async (input) => {
    const { ownerKey, units, runtimeFactors, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    compositeOutputFormatter.validateRecipe(input, { extraUnits: units, runtimeFactors });
    const saved = await localDatabaseService.saveCompoundRecipe({ ...input, ownerKey });
    const compoundRecipes = await localDatabaseService.listCompoundRecipes(ownerKey);
    const syncResult = await unitProfileRepository.syncUserData(ownerKey);
    set({
      compoundRecipes,
      cloudSyncStatus: syncResult.pending ? "pending" : syncResult.synced ? "synced" : "local",
    });
    return saved;
  },

  deleteCompoundRecipe: async (id) => {
    const { ownerKey, entitlementContext, preferences } = get();
    const result = await localDatabaseService.deleteCompoundRecipe(ownerKey, id);
    if (preferences.activeCompoundRecipeId === id) {
      await localDatabaseService.saveUnitPreferences(ownerKey, {
        ...preferences,
        activeCompoundRecipeId: null,
      });
    }
    await get().hydrate(ownerKey, entitlementContext);
    await unitProfileRepository.syncUserData(ownerKey);
    return result;
  },

  saveDraft: async (input) => {
    const { ownerKey } = get();
    const saved = await localDatabaseService.saveUnitDraft({ ...input, ownerKey });
    set({ drafts: await localDatabaseService.listUnitDrafts(ownerKey) });
    return saved;
  },

  discardDraft: async (draftId) => {
    const { ownerKey } = get();
    await localDatabaseService.deleteUnitDraft(ownerKey, draftId);
    set({ drafts: await localDatabaseService.listUnitDrafts(ownerKey) });
  },

  claimGuestDraft: async (draftId) => {
    const { ownerKey, entitlementContext } = get();
    if (ownerKey === "guest") throw new Error("Log in before claiming a guest draft.");
    const saved = await localDatabaseService.claimUnitDraft("guest", ownerKey, draftId);
    await get().hydrate(ownerKey, entitlementContext);
    return saved;
  },

  contributeEvidence: async (profileId) => {
    const { profiles, locationProfile, preferences, capabilities } = get();
    if (!capabilities.canContributeUnitEvidence) {
      throw new Error("An active subscription is required to contribute unit evidence.");
    }
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("Unit profile not found.");
    return unitEvidenceService.submit(profile, locationProfile, {
      optedIn: preferences.contributeUnitEvidence === true,
    });
  },

  archiveCustomEntity: async (entityType, id) => {
    const { ownerKey, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    await localDatabaseService.archiveCustomEntity(ownerKey, entityType, id);
    const preferences = get().preferences;
    if (entityType === "recipe" && preferences.activeCompoundRecipeId === id) {
      await localDatabaseService.saveUnitPreferences(ownerKey, {
        ...preferences,
        activeCompoundRecipeId: null,
      });
    }
    await get().hydrate(ownerKey, entitlementContext);
  },

  resolveProfileConflict: async (profileId, resolution) => {
    const { ownerKey, entitlementContext } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    await localDatabaseService.resolveUnitProfileConflict(ownerKey, profileId, resolution);
    await get().hydrate(ownerKey, entitlementContext);
  },

  saveStandaloneUnit: async (input) => {
    const { ownerKey, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    const unit = createStandaloneCustomUnit({ ...input, ownerKey });
    await localDatabaseService.saveStandaloneCustomUnit(unit);
    await get().hydrate(ownerKey, entitlementContext);
    await unitProfileRepository.syncUserData(ownerKey);
    return unit;
  },

  deleteStandaloneUnit: async (id) => {
    const { ownerKey, entitlementContext } = get();
    const result = await localDatabaseService.deleteStandaloneCustomUnit(ownerKey, id);
    await get().hydrate(ownerKey, entitlementContext);
    await unitProfileRepository.syncUserData(ownerKey);
    return result;
  },

  saveCustomFamily: async (input) => {
    const { ownerKey, entitlementContext } = get();
    entitlementService.require("canManageCustomUnits", entitlementContext);
    unitEngine.validateDraft(input);
    const saved = await localDatabaseService.saveCustomFamily({ ...input, ownerKey });
    await get().hydrate(ownerKey, entitlementContext);
    return saved;
  },

  activateCustomFamily: async ({ draft, anchor, isDefault = true }) => {
    const { ownerKey, entitlementContext, preferences } = get();
    entitlementService.require("canSaveLocalProfiles", entitlementContext);
    const preview = unitEngine.derivePreview(draft, anchor);
    const family = await localDatabaseService.saveCustomFamily({
      ...draft,
      ownerKey,
      status: "active",
    });
    const profile = createUserLocalProfile({
      ownerKey,
      name: draft.name,
      familyId: draft.familyId,
      sourceTrustTier: "custom",
      verificationState: "verified_by_user",
      anchor,
      hierarchyMultipliers: Object.fromEntries(
        draft.relationships.map((edge) => [edge.id, edge.multiplier]),
      ),
      derivedFactors: preview.derivedFactors,
      packSnapshot: null,
      isDefault,
    });
    const syncResult = await unitProfileRepository.save(profile, {
      sync: ownerKey !== "guest" && get().capabilities.canSyncUnitProfiles,
    });
    if (get().capabilities.canSyncUnitProfiles) {
      await unitProfileRepository.syncUserData(ownerKey);
    }
    await localDatabaseService.saveUnitPreferences(ownerKey, {
      ...preferences,
      activeLocalProfileId: syncResult.value.id,
    });
    await get().hydrate(ownerKey, entitlementContext);
    return { family, profile: syncResult.value };
  },

  checkPackUpdates: async (catalogUrl) => {
    set({ packUpdateStatus: "checking" });
    try {
      const updates = await packUpdateService.checkForUpdates(catalogUrl);
      set({ packUpdateStatus: updates.length ? "available" : "current" });
      return updates;
    } catch (error) {
      set({ packUpdateStatus: "error", error: error.message });
      throw error;
    }
  },

  installPackUpdate: async (packUrl) => {
    const { ownerKey } = get();
    set({ packUpdateStatus: "installing" });
    try {
      const result = await packUpdateService.installFromUrl(packUrl);
      await get().hydrate(ownerKey);
      set({ packUpdateStatus: "current" });
      return result;
    } catch (error) {
      set({ packUpdateStatus: "error", error: error.message });
      throw error;
    }
  },

  reset: () => set({ ...initialState }),
}));
