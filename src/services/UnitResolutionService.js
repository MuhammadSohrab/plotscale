import { unitPackRegistry } from "./UnitPackRegistry";

const normalizeName = (value) => String(value ?? "")
  .normalize("NFKC")
  .trim()
  .toLocaleLowerCase()
  .replace(/\s+/g, " ");

export class UnitResolutionService {
  constructor(registry = unitPackRegistry) {
    this.registry = registry;
  }

  resolve(query, {
    dimension,
    packIds = [],
    extraUnits = [],
  } = {}) {
    const normalized = normalizeName(query);
    if (!normalized) return { status: "unresolved", candidates: [], reason: "empty_query" };
    const units = [
      ...this.registry.getRuntimeUnits({
        packIds: packIds.length ? packIds : undefined,
        includeSuggested: packIds.length > 0,
        includeHistorical: true,
      }),
      ...extraUnits,
    ];
    const candidates = units.filter((unit) => {
      if (dimension && unit.dimension !== dimension) return false;
      const keys = [unit.id, unit.name, unit.symbol, ...(unit.aliases ?? [])].map(normalizeName);
      return keys.includes(normalized);
    });
    if (candidates.length === 1) return { status: "resolved", unit: candidates[0], candidates };
    if (candidates.length > 1) {
      return { status: "ambiguous", candidates, reason: "multiple_contextual_variants" };
    }
    return { status: "unresolved", candidates: [], reason: "no_contextual_variant" };
  }
}

export const unitResolutionService = new UnitResolutionService();

