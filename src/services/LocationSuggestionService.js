// Backward-compatible adapter for pre-v4 callers. New code uses LocationService
// and LocationSelection directly; fixed admin field matching no longer lives
// here.
import { PACK_TIERS } from "../models/unitPackModels";
import { locationService } from "./LocationService";
import { unitPackRegistry } from "./UnitPackRegistry";

export class LocationSuggestionService {
  constructor({
    locations = locationService,
    registry = unitPackRegistry,
  } = {}) {
    this.locations = locations;
    this.registry = registry;
  }

  suggest(location) {
    if (!location?.countryCode) return { verified: [], suggested: [] };
    const nodeId = location.admin1Code
      ? `${String(location.countryCode).toUpperCase()}:${location.admin1Code}`
      : null;
    const measurementId = ["TERAI", "HILLS"].includes(location.admin1Code)
      ? `${String(location.countryCode).toUpperCase()}:${location.admin1Code}`
      : null;
    const resolved = this.locations.resolveSuggestions({
      countryCode: location.countryCode,
      nodePathIds: nodeId && !measurementId ? [nodeId] : [],
      measurementRegionIds: measurementId ? [measurementId] : [],
      resolutionLevel: location.admin1Code ? 1 : 0,
      confirmedByUser: true,
      source: "legacy_adapter",
    });
    return {
      verified: this.registry.listPacks({
        tiers: [PACK_TIERS.VERIFIED],
        runtimeOnly: true,
      }),
      suggested: resolved.suggested,
      broaderCandidates: resolved.broaderCandidates,
      researchCandidates: resolved.researchCandidates,
    };
  }
}

export const locationSuggestionService = new LocationSuggestionService();
