import {
  COUNTRY_DIRECTORY,
  LOCATION_NODES,
  LOCATION_TYPE_LABELS,
  MEASUREMENT_REGIONS,
  RESEARCH_SUGGESTION_CATALOG_INDEX,
} from "../data/locationCatalog";
import { PACK_TIERS } from "../models/unitPackModels";
import { createLocationSelection } from "../models/unitEngineModels";
import { unitPackRegistry } from "./UnitPackRegistry";
import { UNIT_ERROR_CODES, unitError } from "./UnitErrors";

const normalize = (value) => String(value ?? "").trim().toUpperCase();

export class LocationService {
  constructor({
    registry = unitPackRegistry,
    countries = COUNTRY_DIRECTORY,
    nodes = LOCATION_NODES,
    measurementRegions = MEASUREMENT_REGIONS,
    researchSuggestionIndex = RESEARCH_SUGGESTION_CATALOG_INDEX,
  } = {}) {
    this.registry = registry;
    this.countries = countries;
    this.nodes = nodes;
    this.measurementRegions = measurementRegions;
    this.researchSuggestionIndex = researchSuggestionIndex;
  }

  listCountries() {
    return this.countries;
  }

  replaceCatalog({
    countries,
    nodes,
    measurementRegions,
    researchSuggestionIndex,
  } = {}) {
    if (countries?.length) this.countries = countries;
    if (Array.isArray(nodes)) this.nodes = nodes;
    if (Array.isArray(measurementRegions)) this.measurementRegions = measurementRegions;
    if (Array.isArray(researchSuggestionIndex)) {
      this.researchSuggestionIndex = researchSuggestionIndex;
    }
  }

  getNode(id) {
    return this.nodes.find((item) => item.id === id) ?? null;
  }

  getMeasurementRegion(id) {
    return this.measurementRegions.find((item) => item.id === id) ?? null;
  }

  getLegacyPath(selection) {
    const nodes = (selection.nodePathIds ?? []).map((id) => this.getNode(id)).filter(Boolean);
    const measurementRegions = (selection.measurementRegionIds ?? [])
      .map((id) => this.getMeasurementRegion(id))
      .filter(Boolean);
    return {
      countryCode: normalize(selection.countryCode),
      admin1Code: nodes[0]?.officialCode ?? measurementRegions[0]?.legacyAdminCode ?? null,
      admin2Code: nodes[1]?.officialCode ?? null,
      localityCode: nodes[2]?.officialCode ?? null,
    };
  }

  getCountryPacks(countryCode) {
    const code = normalize(countryCode);
    return this.registry.listPacks({
      tiers: [PACK_TIERS.SUGGESTED],
      runtimeOnly: true,
    }).filter((pack) =>
      pack.manifest.regions.some((region) => normalize(region.countryCode) === code));
  }

  getNextLocationStep(currentPath) {
    if (!currentPath?.countryCode) {
      return {
        label: "Country or territory",
        typeCode: "country",
        options: this.listCountries().map((country) => ({
          id: country.code,
          code: country.code,
          label: country.name,
        })),
        requiredForSuggestionMatching: true,
        allowSkip: false,
      };
    }
    const selection = createLocationSelection(currentPath);
    const packs = this.getCountryPacks(selection.countryCode);
    if (!packs.length) return null;
    const nextDynamicNodeIds = new Set();
    const nextMeasurementRegionIds = new Set();
    for (const pack of packs) {
      for (const region of pack.manifest.regions) {
        if (normalize(region.countryCode) !== normalize(selection.countryCode)) continue;
        const requiredPath = region.nodePathIds ?? [];
        const currentIsPrefix = selection.nodePathIds.every(
          (id, index) => requiredPath[index] === id,
        );
        if (currentIsPrefix && requiredPath.length > selection.nodePathIds.length) {
          nextDynamicNodeIds.add(requiredPath[selection.nodePathIds.length]);
        }
        for (const regionId of region.measurementRegionIds ?? []) {
          if (!selection.measurementRegionIds.includes(regionId)) {
            nextMeasurementRegionIds.add(regionId);
          }
        }
      }
    }
    const dynamicNodeOptions = [...nextDynamicNodeIds]
      .map((id) => this.getNode(id))
      .filter(Boolean)
      .map((item) => ({ id: item.id, code: item.officialCode, label: item.localizedNames.en }));
    const dynamicMeasurementOptions = [...nextMeasurementRegionIds]
      .map((id) => this.getMeasurementRegion(id))
      .filter(Boolean)
      .map((item) => ({ id: item.id, code: item.legacyAdminCode, label: item.name }));
    if (dynamicNodeOptions.length || dynamicMeasurementOptions.length) {
      const typeCode = dynamicMeasurementOptions.length && !dynamicNodeOptions.length
        ? "measurement_region"
        : this.getNode(dynamicNodeOptions[0]?.id)?.typeCode ?? "region";
      return {
        label: LOCATION_TYPE_LABELS[typeCode] ?? "Region",
        typeCode,
        options: [...dynamicNodeOptions, ...dynamicMeasurementOptions],
        requiredForSuggestionMatching: true,
        allowSkip: true,
      };
    }
    const legacy = this.getLegacyPath(selection);
    const unresolvedAdminCodes = new Set();
    for (const pack of packs) {
      for (const region of pack.manifest.regions) {
        if (normalize(region.countryCode) !== normalize(selection.countryCode)) continue;
        if (region.admin1Code && !legacy.admin1Code) unresolvedAdminCodes.add(normalize(region.admin1Code));
      }
    }
    if (!unresolvedAdminCodes.size) return null;

    const administrativeOptions = this.nodes
      .filter((item) =>
        item.countryCode === selection.countryCode
        && item.levelIndex === selection.nodePathIds.length + 1
        && unresolvedAdminCodes.has(normalize(item.officialCode)))
      .map((item) => ({ id: item.id, code: item.officialCode, label: item.localizedNames.en }));
    const measurementOptions = this.measurementRegions
      .filter((item) =>
        item.countryCode === selection.countryCode
        && unresolvedAdminCodes.has(normalize(item.legacyAdminCode)))
      .map((item) => ({ id: item.id, code: item.legacyAdminCode, label: item.name }));
    const options = [...administrativeOptions, ...measurementOptions];
    if (!options.length) return null;
    const typeCode = measurementOptions.length && !administrativeOptions.length
      ? "measurement_region"
      : this.getNode(administrativeOptions[0]?.id)?.typeCode ?? "region";
    return {
      label: LOCATION_TYPE_LABELS[typeCode] ?? "Region",
      typeCode,
      options,
      requiredForSuggestionMatching: true,
      allowSkip: true,
    };
  }

  resolveSuggestions(input) {
    const selection = createLocationSelection(input);
    const legacy = this.getLegacyPath(selection);
    const countryPacks = this.getCountryPacks(selection.countryCode);
    const exact = [];
    const broader = [];
    for (const pack of countryPacks) {
      const matches = pack.manifest.regions.some((region) => {
        if (normalize(region.countryCode) !== normalize(selection.countryCode)) return false;
        if (region.nodePathIds?.length && !region.nodePathIds.every(
          (id, index) => selection.nodePathIds[index] === id,
        )) return false;
        if (region.measurementRegionIds?.length && !region.measurementRegionIds.every(
          (id) => selection.measurementRegionIds.includes(id),
        )) return false;
        if (region.admin1Code && normalize(region.admin1Code) !== normalize(legacy.admin1Code)) return false;
        if (region.admin2Code && normalize(region.admin2Code) !== normalize(legacy.admin2Code)) return false;
        return true;
      });
      const needsMoreLocation = pack.manifest.regions.some((region) =>
        normalize(region.countryCode) === normalize(selection.countryCode)
        && (
          ((region.nodePathIds?.length ?? 0) > selection.nodePathIds.length)
          || (region.measurementRegionIds ?? []).some(
            (id) => !selection.measurementRegionIds.includes(id),
          )
          || (region.admin1Code && !legacy.admin1Code)
        ));
      if (matches) exact.push(pack);
      else if (needsMoreLocation) broader.push(pack);
    }
    return {
      selection,
      suggested: exact,
      broaderCandidates: broader,
      requiresRefinement: this.getNextLocationStep(selection) !== null,
      researchCandidates: this.researchSuggestionIndex.filter((pack) =>
        pack.countryCodes.includes(selection.countryCode)),
      warning: broader.length
        ? "Location was not narrowed enough to choose safely. Review all broader candidates."
        : null,
    };
  }

  refineLocation(existingSelection) {
    return this.getNextLocationStep(existingSelection);
  }

  assertSufficient(selection) {
    const next = this.getNextLocationStep(selection);
    if (next) {
      throw unitError(
        UNIT_ERROR_CODES.LOCATION_INSUFFICIENT,
        `${next.label} is needed to narrow local unit suggestions.`,
        { nextStep: next },
      );
    }
    return true;
  }
}

export const locationService = new LocationService();
