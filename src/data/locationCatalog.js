import countryDirectory from "./generated/countryDirectory.json";
import suggestionCoverage from "./generated/suggestionCoverage.json";
import researchSuggestionCatalogIndex from "./generated/researchSuggestionCatalogIndex.json";

const node = (id, parentId, countryCode, levelIndex, typeCode, name, officialCode) =>
  Object.freeze({
    id,
    parentId,
    countryCode,
    levelIndex,
    typeCode,
    localizedNames: { en: name },
    officialCode,
    aliases: [],
    isAdministrative: true,
    source: "bundled_unit_suggestion_catalog",
  });

export const COUNTRY_DIRECTORY = Object.freeze(countryDirectory);
export const SUGGESTION_COVERAGE = Object.freeze(suggestionCoverage);
export const RESEARCH_SUGGESTION_CATALOG_INDEX = Object.freeze(researchSuggestionCatalogIndex);

// Bundled nodes only need to distinguish bundled suggestion packs. The signed
// catalog can add deeper or differently named levels without an app release.
export const LOCATION_NODES = Object.freeze([
  node("IN:AS", null, "IN", 1, "state", "Assam", "AS"),
  node("IN:WB", null, "IN", 1, "state", "West Bengal", "WB"),
  node("IN:PB", null, "IN", 1, "state", "Punjab", "PB"),
  node("IN:HR", null, "IN", 1, "state", "Haryana", "HR"),
  node("PK:PB", null, "PK", 1, "province", "Punjab", "PB"),
  node("AE:DU", null, "AE", 1, "emirate", "Dubai", "DU"),
]);

export const MEASUREMENT_REGIONS = Object.freeze([
  {
    id: "NP:TERAI",
    countryCode: "NP",
    name: "Terai",
    aliases: ["Tarai"],
    locationNodeIds: [],
    parentMeasurementRegionId: null,
    regionType: "physiographic_land_region",
    source: "bundled_unit_suggestion_catalog",
    legacyAdminCode: "TERAI",
  },
  {
    id: "NP:HILLS",
    countryCode: "NP",
    name: "Hills / mountains",
    aliases: ["Hill region"],
    locationNodeIds: [],
    parentMeasurementRegionId: null,
    regionType: "physiographic_land_region",
    source: "bundled_unit_suggestion_catalog",
    legacyAdminCode: "HILLS",
  },
]);

export const LOCATION_TYPE_LABELS = Object.freeze({
  state: "State",
  province: "Province",
  territory: "Territory",
  emirate: "Emirate",
  region: "Region",
  prefecture: "Prefecture",
  canton: "Canton",
  county: "County",
  district: "District",
  municipality: "Municipality",
  tehsil: "Tehsil",
  taluka: "Taluka",
  subdistrict: "Subdistrict",
  village: "Village",
  locality: "Locality",
  planning_area: "Planning area",
  measurement_region: "Land measurement region",
});
