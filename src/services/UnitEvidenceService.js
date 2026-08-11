import { requireSupabase } from "./supabaseClient";
import { unitPackRegistry } from "./UnitPackRegistry";

export class UnitEvidenceService {
  buildPayload(profile, location) {
    if (!location?.countryCode) throw new Error("Confirm a location before contributing evidence.");
    if (!profile?.packId) {
      throw new Error("Evidence submission currently requires a location-matched suggestion profile.");
    }
    const pack = unitPackRegistry.getPack(profile.packId);
    const relationships = pack.data.relationships
      .filter((relationship) =>
        Object.hasOwn(profile.hierarchyMultipliers ?? {}, relationship.id))
      .map((relationship) => ({
        parentUnitId: relationship.parentUnitId,
        childUnitId: relationship.childUnitId,
        multiplier: String(profile.hierarchyMultipliers[relationship.id]),
      }));
    if (!relationships.length) throw new Error("This profile has no confirmed relationships to contribute.");
    return {
      countryCode: location.countryCode,
      locationPathIds: location.nodePathIds ?? [],
      measurementRegionIds: location.measurementRegionIds ?? [],
      family: {
        familyId: profile.familyId,
        dimension: pack.data.variants.find((variant) =>
          Object.hasOwn(profile.derivedFactors ?? {}, variant.id))?.dimension ?? "area",
        memberIds: Object.keys(profile.derivedFactors ?? {}).sort(),
      },
      relationships,
      factors: Object.fromEntries(
        Object.entries(profile.derivedFactors ?? {}).map(([id, factor]) => [id, String(factor)]),
      ),
    };
  }

  async submit(profile, location, { optedIn = false } = {}) {
    if (!optedIn) throw new Error("Explicit evidence contribution consent is required.");
    const client = requireSupabase();
    const payload = this.buildPayload(profile, location);
    const { data, error } = await client.functions.invoke("submit-unit-evidence", {
      body: payload,
    });
    if (error) throw error;
    return data;
  }
}

export const unitEvidenceService = new UnitEvidenceService();
