import researchSuggestionCatalogIndex from "../data/generated/researchSuggestionCatalogIndex.json";

export class ResearchSuggestionCatalogRepository {
  listForCountry(countryCode) {
    const code = String(countryCode ?? "").toUpperCase();
    return researchSuggestionCatalogIndex.filter((pack) => pack.countryCodes.includes(code));
  }

  async getPack(packId) {
    const module = await import("../data/generated/researchSuggestionCatalog.json");
    const pack = module.default.find((item) => item.id === packId);
    if (!pack) throw new Error(`Unknown research suggestion pack: ${packId}.`);
    return pack;
  }
}

export const researchSuggestionCatalogRepository =
  new ResearchSuggestionCatalogRepository();
