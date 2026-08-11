import Decimal from "decimal.js";
import { DIMENSIONS } from "../data/dimensions";
import {
  createUserFamilyDraft,
  requireSingleAnchor,
  validateFamilyGraph,
} from "../models/unitEngineModels";
import { decimalString } from "../utils/decimal";
import { formatDecimalExact } from "../utils/exactFormat";
import { compositeOutputFormatter } from "../utils/CompositeOutputFormatter";
import { entitlementService } from "./EntitlementService";
import { localFamilyCalibrationService } from "./LocalFamilyCalibrationService";
import { locationService } from "./LocationService";
import { unitConversionService } from "./UnitConversionService";
import { UNIT_ERROR_CODES, unitError } from "./UnitErrors";
import { unitPackRegistry } from "./UnitPackRegistry";
import { unitResolutionService } from "./UnitResolutionService";
import { researchSuggestionCatalogRepository } from "./ResearchSuggestionCatalogRepository";
import { canonicalJson } from "./PackUpdateService";

const uniqueById = (items) =>
  items.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);

const deriveGraph = (draft, anchor, standardUnits) => {
  validateFamilyGraph(draft);
  const source = standardUnits.find((item) => item.id === anchor.sourceUnitId);
  let factors;
  if (anchor.kind === "tool_length") {
    if (!source || source.dimension !== DIMENSIONS.LENGTH) {
      throw unitError(
        UNIT_ERROR_CODES.DIMENSION_MISMATCH,
        "A measuring-tool anchor requires a standard length unit.",
      );
    }
    const relation = (draft.toolToAreaRelationships ?? [])
      .find((item) => item.toolId === anchor.referenceId);
    if (!relation || relation.power !== 2 || !relation.confirmedByUser) {
      throw unitError(
        UNIT_ERROR_CODES.TOOL_AREA_RELATION_REQUIRED,
        "Confirm an explicit tool-to-area square relationship before using this tool as an anchor.",
      );
    }
    const length = new Decimal(unitConversionService.toBaseExact(
      anchor.value,
      anchor.sourceUnitId,
      {},
      standardUnits,
    ));
    factors = {
      [anchor.referenceId]: decimalString(length),
      [relation.targetAreaUnitId]: decimalString(
        length.pow(relation.power).times(relation.multiplier ?? 1),
      ),
    };
  } else {
    const member = draft.members.find((item) => item.id === anchor.referenceId);
    if (!member) {
      throw unitError(UNIT_ERROR_CODES.UNIT_NOT_FOUND, "Known unit is not a member of this family.");
    }
    if (!source || source.dimension !== member.dimension) {
      throw unitError(
        UNIT_ERROR_CODES.DIMENSION_MISMATCH,
        "Known value must use a compatible standard unit.",
      );
    }
    factors = {
      [member.id]: unitConversionService.toBaseExact(
        anchor.value,
        anchor.sourceUnitId,
        {},
        standardUnits,
      ),
    };
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of draft.relationships) {
      const multiplier = new Decimal(edge.multiplier);
      if (factors[edge.childUnitId] && !factors[edge.parentUnitId]) {
        factors[edge.parentUnitId] = decimalString(
          new Decimal(factors[edge.childUnitId]).times(multiplier),
        );
        changed = true;
      } else if (factors[edge.parentUnitId] && !factors[edge.childUnitId]) {
        factors[edge.childUnitId] = decimalString(
          new Decimal(factors[edge.parentUnitId]).div(multiplier),
        );
        changed = true;
      }
    }
  }
  return factors;
};

export class UnitEngine {
  constructor({
    registry = unitPackRegistry,
    locations = locationService,
    conversion = unitConversionService,
    formatter = compositeOutputFormatter,
    resolver = unitResolutionService,
    entitlements = entitlementService,
  } = {}) {
    this.registry = registry;
    this.locations = locations;
    this.conversion = conversion;
    this.formatter = formatter;
    this.resolver = resolver;
    this.entitlements = entitlements;
  }

  listStandardUnits(dimension, { includeHistorical = false } = {}) {
    return uniqueById(this.registry.getRuntimeUnits({ includeHistorical })
      .filter((unit) => unit.factorToBase !== null)
      .filter((unit) => !dimension || unit.dimension === dimension));
  }

  listCountries() {
    return this.locations.listCountries();
  }

  getNextLocationStep(selection) {
    return this.locations.getNextLocationStep(selection);
  }

  suggestFamilies(locationSelection) {
    return this.locations.resolveSuggestions(locationSelection);
  }

  getSuggestionPack(packId) {
    const pack = this.registry.getPack(packId);
    if (pack.manifest.tier !== "suggested") {
      throw new Error("This catalog entry is not a local-family suggestion.");
    }
    return pack;
  }

  createDraftFromSuggestion(packId, familyId) {
    const pack = this.registry.getPack(packId);
    if (pack.manifest.tier !== "suggested") {
      throw new Error("Only suggestion packs can create a self-verification draft.");
    }
    const family = pack.data.familyTemplates.find((item) => item.id === familyId);
    if (!family) throw new Error(`Unknown family: ${familyId}.`);
    const members = pack.data.variants
      .filter((variant) => family.unitIds.includes(variant.id))
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        symbol: variant.symbol,
        dimension: variant.dimension,
        aliases: variant.aliases ?? [],
      }));
    return createUserFamilyDraft({
      sourcePackId: pack.manifest.id,
      sourcePackVersion: pack.manifest.version,
      familyId: family.id,
      name: pack.manifest.name,
      dimension: members[0]?.dimension ?? DIMENSIONS.AREA,
      members,
      relationships: pack.data.relationships
        .filter((relationship) => family.relationshipIds.includes(relationship.id))
        .map((relationship) => ({ ...relationship, confirmedByUser: false })),
      tools: pack.data.tools.filter((tool) => family.toolIds?.includes(tool.id)),
    });
  }

  createCustomFamilyDraft(dimension = DIMENSIONS.AREA) {
    return createUserFamilyDraft({
      name: "My custom unit family",
      dimension,
      members: [],
      relationships: [],
    });
  }

  async createDraftFromResearchCandidates(packId, candidateIds = []) {
    const pack = await researchSuggestionCatalogRepository.getPack(packId);
    const selectedIds = new Set(candidateIds);
    const selected = pack.candidates.filter((candidate) =>
      selectedIds.size ? selectedIds.has(candidate.sourceRecordId) : true);
    const actionable = selected.filter((candidate) =>
      !["ambiguous_reference_only", "non_geometric_reference_only"].includes(candidate.role));
    const dimensions = new Set(actionable.map((candidate) => candidate.dimension));
    if (!actionable.length) {
      throw unitError(
        UNIT_ERROR_CODES.IMPORT_INVALID,
        "Select at least one geometric unit or measuring-tool candidate.",
      );
    }
    if (dimensions.size !== 1) {
      throw unitError(
        UNIT_ERROR_CODES.DIMENSION_MISMATCH,
        "Length and area research candidates must be placed in separate families.",
      );
    }
    const dimension = [...dimensions][0];
    const concepts = [...new Set(actionable.map((candidate) => candidate.unitConcept.trim()))];
    const members = concepts.map((name, index) => ({
      id: `RESEARCH_${dimension.toUpperCase()}_${index + 1}_${crypto.randomUUID()}`,
      name,
      symbol: name.slice(0, 4),
      dimension,
      aliases: [],
    }));
    return createUserFamilyDraft({
      sourcePackId: pack.id,
      sourcePackVersion: pack.version,
      name: `${pack.name} — My draft`,
      dimension,
      members,
      relationships: [],
      status: "draft",
      draftType: "research_candidate_family",
      sourceCandidateIds: actionable.map((candidate) => candidate.sourceRecordId),
    });
  }

  validateDraft(draft) {
    return validateFamilyGraph(draft);
  }

  validateAndPreviewDraft(draft, singleAnchor) {
    try {
      const preview = this.derivePreview(draft, singleAnchor);
      return { valid: true, preview, error: null };
    } catch (error) {
      return {
        valid: false,
        preview: null,
        error: {
          code: error.code ?? UNIT_ERROR_CODES.INVALID_RELATIONSHIP,
          message: error.message,
          details: error.details ?? {},
        },
      };
    }
  }

  formatDisplayExact(value, options = {}) {
    return formatDecimalExact(value, options);
  }

  derivePreview(draft, singleAnchor) {
    const anchor = requireSingleAnchor(
      Array.isArray(singleAnchor) ? { anchors: singleAnchor } : { anchor: singleAnchor },
    );
    validateFamilyGraph(draft);
    if (draft.sourcePackId) {
      return localFamilyCalibrationService.derive({
        name: `${draft.name} — My profile`,
        packId: draft.sourcePackId,
        familyId: draft.familyId,
        anchor,
        hierarchyMultipliers: Object.fromEntries(
          draft.relationships.map((edge) => [edge.id, edge.multiplier]),
        ),
        extraUnits: this.listStandardUnits(),
      });
    }
    const standardUnits = this.listStandardUnits();
    return {
      draft,
      anchor,
      derivedFactors: deriveGraph(draft, anchor, standardUnits),
      verificationState: "verified_by_user",
    };
  }

  listAvailableUnits(context = {}) {
    const capabilities = context.capabilities
      ?? this.entitlements.getCapabilities(context.entitlementContext);
    const standard = this.listStandardUnits(context.dimension, {
      includeHistorical: context.advancedUnitsEnabled === true,
    });
    if (!capabilities.canUseLocalProfiles) return standard;
    const profileUnits = (context.profiles ?? []).flatMap((profile) =>
      Object.entries(profile.derivedFactors ?? {}).map(([id, factorToBase]) => {
        const sourceUnit = context.units?.find((unit) => unit.id === id)
          ?? this.registry.getRuntimeUnits({
            packIds: profile.packId ? [profile.packId] : undefined,
            includeSuggested: true,
            includeHistorical: true,
          }).find((unit) => unit.id === id);
        return sourceUnit ? { ...sourceUnit, factorToBase, profileId: profile.id } : null;
      }).filter(Boolean));
    return uniqueById([...standard, ...profileUnits, ...(context.customUnits ?? [])])
      .filter((unit) => !context.dimension || unit.dimension === context.dimension);
  }

  resolveUnit(query, context = {}) {
    const candidates = this.listAvailableUnits(context);
    const normalized = String(query ?? "").trim().toLowerCase();
    const matches = candidates.filter((unit) =>
      [unit.id, unit.name, unit.symbol, ...(unit.aliases ?? [])]
        .some((value) => String(value).trim().toLowerCase() === normalized));
    if (!matches.length) {
      throw unitError(UNIT_ERROR_CODES.UNIT_NOT_FOUND, `Unknown unit: ${query}.`);
    }
    if (matches.length > 1) {
      throw unitError(
        UNIT_ERROR_CODES.AMBIGUOUS_UNIT,
        `Unit name "${query}" needs a regional or dimensional context.`,
        { candidates: matches },
      );
    }
    return matches[0];
  }

  convertExact(request, context = {}) {
    const units = this.listAvailableUnits(context);
    const from = units.find((unit) => unit.id === request.fromUnitId);
    const to = units.find((unit) => unit.id === request.toUnitId);
    if (!from || !to) {
      throw unitError(UNIT_ERROR_CODES.UNIT_NOT_FOUND, "One of the selected units is unavailable.");
    }
    if (from.dimension !== to.dimension) {
      throw unitError(UNIT_ERROR_CODES.DIMENSION_MISMATCH, "Length and area units cannot be mixed.");
    }
    return this.conversion.convertExact(
      request.value,
      from.id,
      to.id,
      {},
      units,
    );
  }

  toBaseExact(value, unitId, context = {}) {
    const unit = this.listAvailableUnits(context).find((item) => item.id === unitId);
    if (!unit) throw unitError(UNIT_ERROR_CODES.UNIT_NOT_FOUND, `Unknown unit: ${unitId}.`);
    const baseUnitId = unit.dimension === DIMENSIONS.LENGTH ? "METER" : "SQM";
    return this.convertExact({ value, fromUnitId: unitId, toUnitId: baseUnitId }, context);
  }

  fromBaseExact(baseValue, unitId, context = {}) {
    const unit = this.listAvailableUnits(context).find((item) => item.id === unitId);
    if (!unit) throw unitError(UNIT_ERROR_CODES.UNIT_NOT_FOUND, `Unknown unit: ${unitId}.`);
    const baseUnitId = unit.dimension === DIMENSIONS.LENGTH ? "METER" : "SQM";
    return this.convertExact({ value: baseValue, fromUnitId: baseUnitId, toUnitId: unitId }, context);
  }

  formatResult(baseValue, recipe, context = {}) {
    return this.formatter.formatRecipe(baseValue, recipe, {
      extraUnits: this.listAvailableUnits(context),
      runtimeFactors: context.runtimeFactors ?? {},
    });
  }

  async createSnapshot(context = {}) {
    const profile = context.activeProfile ?? null;
    const payload = {
      schemaVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      profileId: profile?.id ?? null,
      profileVersion: profile?.profileVersion ?? null,
      packId: profile?.packId ?? null,
      packVersion: profile?.packVersion ?? null,
      factors: { ...(profile?.derivedFactors ?? context.runtimeFactors ?? {}) },
      units: (context.units ?? []).map((unit) => ({
        id: unit.id,
        name: unit.name,
        symbol: unit.symbol,
        dimension: unit.dimension,
        factorToBase: context.runtimeFactors?.[unit.id] ?? unit.factorToBase,
      })),
      recipe: context.recipe ? { ...context.recipe } : null,
    };
    const checksum = await this.sha256(canonicalJson(payload));
    return Object.freeze({
      ...payload,
      integrity: { algorithm: "SHA-256", checksum },
    });
  }

  async sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async validateSnapshot(snapshot) {
    if (
      snapshot?.schemaVersion !== "1.0.0"
      || !snapshot?.factors
      || !Array.isArray(snapshot?.units)
      || snapshot?.integrity?.algorithm !== "SHA-256"
      || !snapshot?.integrity?.checksum
    ) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unit snapshot is invalid.");
    }
    for (const [unitId, factor] of Object.entries(snapshot.factors)) {
      try {
        if (!unitId || new Decimal(factor).lte(0)) throw new Error();
      } catch {
        throw unitError(
          UNIT_ERROR_CODES.IMPORT_INVALID,
          `Snapshot factor for ${unitId || "unknown unit"} must be a positive decimal.`,
        );
      }
    }
    for (const unit of snapshot.units) {
      if (!unit.id || ![DIMENSIONS.LENGTH, DIMENSIONS.AREA].includes(unit.dimension)) {
        throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Snapshot contains an invalid unit.");
      }
      if (unit.factorToBase !== null && unit.factorToBase !== undefined) {
        try {
          if (new Decimal(unit.factorToBase).lte(0)) throw new Error();
        } catch {
          throw unitError(
            UNIT_ERROR_CODES.IMPORT_INVALID,
            `Snapshot unit ${unit.id} has an invalid factor.`,
          );
        }
      }
    }
    const { integrity, ...payload } = snapshot;
    const checksum = await this.sha256(canonicalJson(payload));
    if (checksum !== integrity.checksum.toLowerCase()) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unit snapshot checksum does not match.");
    }
    return true;
  }

  async restoreSnapshot(snapshot) {
    await this.validateSnapshot(snapshot);
    return {
      activeProfile: snapshot.profileId ? {
        id: snapshot.profileId,
        profileVersion: snapshot.profileVersion,
        packId: snapshot.packId,
        packVersion: snapshot.packVersion,
        derivedFactors: { ...snapshot.factors },
      } : null,
      runtimeFactors: { ...snapshot.factors },
      units: (snapshot.units ?? []).map((unit) => ({ ...unit })),
      recipe: snapshot.recipe ? { ...snapshot.recipe } : null,
      historicalSnapshot: true,
    };
  }
}

export const unitEngine = new UnitEngine();
