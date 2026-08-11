import { BUNDLED_UNIT_PACKS } from "../data/unit-packs";
import {
  PACK_TIERS,
  createPackUnitVariant,
  validatePackData,
  validatePackManifest,
} from "../models/unitPackModels";

const tierOrder = {
  [PACK_TIERS.VERIFIED]: 0,
  [PACK_TIERS.SUGGESTED]: 1,
  [PACK_TIERS.RESEARCH]: 2,
};

export class UnitPackRegistry {
  constructor(packs = BUNDLED_UNIT_PACKS) {
    this.packs = new Map();
    packs.forEach((item) => this.installBundledPack(item));
  }

  installBundledPack({ manifest: rawManifest, data: rawData }) {
    return this.installPack({ manifest: rawManifest, data: rawData, source: "bundled" });
  }

  installPack({ manifest: rawManifest, data: rawData, source = "remote" }) {
    const manifest = validatePackManifest(rawManifest);
    const data = validatePackData(rawData, manifest);
    this.packs.set(manifest.id, { manifest, data, source });
    return this.packs.get(manifest.id);
  }

  listPacks({ tiers = Object.values(PACK_TIERS), runtimeOnly = false } = {}) {
    return [...this.packs.values()]
      .filter((pack) => tiers.includes(pack.manifest.tier))
      .filter((pack) => !runtimeOnly || pack.manifest.tier !== PACK_TIERS.RESEARCH)
      .sort((left, right) =>
        tierOrder[left.manifest.tier] - tierOrder[right.manifest.tier] ||
        left.manifest.name.localeCompare(right.manifest.name));
  }

  getPack(packId) {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Unknown unit pack: ${packId}.`);
    return pack;
  }

  getRuntimeUnits({
    packIds,
    includeSuggested = false,
    includeHistorical = false,
  } = {}) {
    const allowedTiers = includeSuggested
      ? [PACK_TIERS.VERIFIED, PACK_TIERS.SUGGESTED]
      : [PACK_TIERS.VERIFIED];
    return this.listPacks({ tiers: allowedTiers, runtimeOnly: true })
      .filter((pack) => !packIds || packIds.includes(pack.manifest.id))
      .flatMap((pack) => pack.data.variants
        .filter((variant) => includeHistorical || variant.status !== "historical")
        .map((variant) => createPackUnitVariant(variant, pack.manifest)));
  }

  getRuntimeRelationships({ packIds, includeSuggested = false } = {}) {
    const tiers = includeSuggested
      ? [PACK_TIERS.VERIFIED, PACK_TIERS.SUGGESTED]
      : [PACK_TIERS.VERIFIED];
    return this.listPacks({ tiers, runtimeOnly: true })
      .filter((pack) => !packIds || packIds.includes(pack.manifest.id))
      .flatMap((pack) => pack.data.relationships.map((relationship) => ({
        ...relationship,
        packId: pack.manifest.id,
        packVersion: pack.manifest.version,
        trustTier: pack.manifest.tier,
      })));
  }

  getTools({ packIds, includeSuggested = false } = {}) {
    const tiers = includeSuggested
      ? [PACK_TIERS.VERIFIED, PACK_TIERS.SUGGESTED]
      : [PACK_TIERS.VERIFIED];
    return this.listPacks({ tiers, runtimeOnly: true })
      .filter((pack) => !packIds || packIds.includes(pack.manifest.id))
      .flatMap((pack) => pack.data.tools.map((tool) => ({
        ...tool,
        factorToBase: tool.factorToBase ?? null,
        packId: pack.manifest.id,
        packVersion: pack.manifest.version,
        trustTier: pack.manifest.tier,
      })));
  }

  getFamilyTemplate(familyId) {
    for (const pack of this.listPacks({ runtimeOnly: true })) {
      const template = pack.data.familyTemplates.find((item) => item.id === familyId);
      if (template) return { ...template, pack: pack.manifest };
    }
    throw new Error(`Unknown unit family: ${familyId}.`);
  }

  snapshot(packIds) {
    return packIds.map((id) => {
      const { manifest } = this.getPack(id);
      return { id, version: manifest.version, tier: manifest.tier };
    });
  }
}

export const unitPackRegistry = new UnitPackRegistry();
