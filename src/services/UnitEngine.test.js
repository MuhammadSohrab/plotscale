import { describe, expect, it } from "vitest";
import {
  COUNTRY_DIRECTORY,
  RESEARCH_SUGGESTION_CATALOG_INDEX,
  SUGGESTION_COVERAGE,
} from "../data/locationCatalog";
import { entitlementService } from "./EntitlementService";
import { locationService } from "./LocationService";
import { LocationService } from "./LocationService";
import { UNIT_ERROR_CODES } from "./UnitErrors";
import { unitEngine } from "./UnitEngine";

describe("PlotScale central UnitEngine", () => {
  it("provides the complete supplied ISO-style country directory", () => {
    expect(COUNTRY_DIRECTORY).toHaveLength(249);
    expect(COUNTRY_DIRECTORY.some((country) => country.code === "IN")).toBe(true);
    expect(COUNTRY_DIRECTORY.some((country) => country.code === "SG")).toBe(true);
    expect(SUGGESTION_COVERAGE.filter((item) => item.hasResearchSuggestions)).toHaveLength(77);
    expect(RESEARCH_SUGGESTION_CATALOG_INDEX).toHaveLength(89);
    expect(RESEARCH_SUGGESTION_CATALOG_INDEX.every((pack) => pack.candidateCount > 0)).toBe(true);
  });

  it("asks only for the location depth needed by bundled suggestions", () => {
    expect(locationService.getNextLocationStep({
      countryCode: "SG",
      nodePathIds: [],
      measurementRegionIds: [],
    })).toBeNull();
    const indiaStep = locationService.getNextLocationStep({
      countryCode: "IN",
      nodePathIds: [],
      measurementRegionIds: [],
    });
    expect(indiaStep.typeCode).toBe("state");
    expect(indiaStep.options.map((option) => option.label)).toContain("Assam");
    const nepalStep = locationService.getNextLocationStep({
      countryCode: "NP",
      nodePathIds: [],
      measurementRegionIds: [],
    });
    expect(nepalStep.typeCode).toBe("measurement_region");
  });

  it("supports a five-level catalog path without fixed state/district fields", () => {
    const nodes = Array.from({ length: 5 }, (_, index) => ({
      id: `XY:L${index + 1}`,
      parentId: index ? `XY:L${index}` : null,
      countryCode: "XY",
      levelIndex: index + 1,
      typeCode: ["province", "county", "district", "subdistrict", "village"][index],
      localizedNames: { en: `Level ${index + 1}` },
      officialCode: `L${index + 1}`,
      aliases: [],
      isAdministrative: true,
      source: "test",
    }));
    const registry = {
      listPacks: () => [{
        manifest: {
          id: "xy_deep_family",
          tier: "suggested",
          regions: [{
            countryCode: "XY",
            nodePathIds: nodes.map((item) => item.id),
            measurementRegionIds: [],
          }],
        },
      }],
    };
    const service = new LocationService({
      registry,
      countries: [{ code: "XY", name: "Example" }],
      nodes,
      measurementRegions: [],
      researchSuggestionIndex: [],
    });
    const selected = [];
    for (const expected of nodes) {
      const step = service.getNextLocationStep({
        countryCode: "XY",
        nodePathIds: selected,
        measurementRegionIds: [],
      });
      expect(step.options.map((option) => option.id)).toContain(expected.id);
      selected.push(expected.id);
    }
    expect(service.getNextLocationStep({
      countryCode: "XY",
      nodePathIds: selected,
      measurementRegionIds: [],
    })).toBeNull();
  });

  it("derives a connected custom family from exactly one anchor", () => {
    const draft = {
      id: "draft",
      familyId: "family",
      name: "Test family",
      dimension: "area",
      members: [
        { id: "LARGE", name: "Large", symbol: "L", dimension: "area" },
        { id: "SMALL", name: "Small", symbol: "S", dimension: "area" },
      ],
      relationships: [{
        id: "LARGE_TO_SMALL",
        parentUnitId: "LARGE",
        childUnitId: "SMALL",
        multiplier: "20",
        confirmedByUser: true,
      }],
    };
    const preview = unitEngine.derivePreview(draft, {
      kind: "unit_area",
      referenceId: "SMALL",
      value: "100",
      sourceUnitId: "SQM",
    });
    expect(preview.derivedFactors.SMALL).toBe("100");
    expect(preview.derivedFactors.LARGE).toBe("2000");
  });

  it("requires an explicit confirmed square relation for a measuring-tool anchor", () => {
    const baseDraft = {
      id: "tool-draft",
      familyId: "tool-family",
      name: "Tool family",
      dimension: "area",
      members: [{ id: "TOOL_AREA", name: "Tool area", symbol: "ta", dimension: "area" }],
      relationships: [],
      tools: [{ id: "MY_TOOL", name: "My tool", dimension: "length" }],
    };
    expect(() => unitEngine.derivePreview(baseDraft, {
      kind: "tool_length",
      referenceId: "MY_TOOL",
      value: "10",
      sourceUnitId: "FOOT",
    })).toThrow();
    const preview = unitEngine.derivePreview({
      ...baseDraft,
      toolToAreaRelationships: [{
        id: "TOOL_SQUARE",
        toolId: "MY_TOOL",
        targetAreaUnitId: "TOOL_AREA",
        power: 2,
        multiplier: "1",
        confirmedByUser: true,
      }],
    }, {
      kind: "tool_length",
      referenceId: "MY_TOOL",
      value: "10",
      sourceUnitId: "FOOT",
    });
    expect(Number(preview.derivedFactors.TOOL_AREA)).toBeCloseTo(9.290304, 12);
  });

  it("classifies every available land assertion without exposing research factors", async () => {
    const { default: packs } = await import("../data/generated/researchSuggestionCatalog.json");
    expect(packs.reduce((total, pack) => total + pack.candidateCount, 0)).toBe(2804);
    expect(packs.flatMap((pack) => pack.candidates)
      .every((candidate) => !Object.hasOwn(candidate, "factorToBase"))).toBe(true);
  });

  it("returns the locked error code for multiple anchors", () => {
    const draft = unitEngine.createDraftFromSuggestion(
      "in_assam_bigha_katha_lessa",
      "IN_AS_BIGHA_FAMILY",
    );
    const confirmed = {
      ...draft,
      relationships: draft.relationships.map((edge) => ({ ...edge, confirmedByUser: true })),
    };
    expect(() => unitEngine.derivePreview(confirmed, [{
      kind: "unit_area",
      referenceId: "IN_AS_KATHA",
      value: "720",
      sourceUnitId: "SQFT",
    }, {
      kind: "unit_area",
      referenceId: "IN_AS_LESSA",
      value: "144",
      sourceUnitId: "SQFT",
    }])).toThrow();
    try {
      unitEngine.derivePreview(confirmed, [{
        kind: "unit_area",
        referenceId: "IN_AS_KATHA",
        value: "720",
        sourceUnitId: "SQFT",
      }, {
        kind: "unit_area",
        referenceId: "IN_AS_LESSA",
        value: "144",
        sourceUnitId: "SQFT",
      }]);
    } catch (error) {
      expect(error.code).toBe(UNIT_ERROR_CODES.MULTIPLE_ANCHORS_FORBIDDEN);
    }
  });

  it("keeps standard units free and local profile activation paid", () => {
    const free = entitlementService.getCapabilities({
      subscriptionStatus: "free",
      isGuest: false,
    });
    const paid = entitlementService.getCapabilities({
      subscriptionStatus: "active",
      isGuest: false,
    });
    expect(free.canUseStandardUnits).toBe(true);
    expect(free.canPreviewLocalSetup).toBe(true);
    expect(free.canSaveLocalProfiles).toBe(false);
    expect(paid.canSaveLocalProfiles).toBe(true);
    expect(paid.canContributeUnitEvidence).toBe(true);
  });

  it("rejects length-to-area conversion centrally", () => {
    try {
      unitEngine.convertExact({
        value: "1",
        fromUnitId: "METER",
        toUnitId: "SQM",
      });
      throw new Error("Expected conversion to fail.");
    } catch (error) {
      expect(error.code).toBe(UNIT_ERROR_CODES.DIMENSION_MISMATCH);
    }
  });

  it("creates factor-free custom drafts from selected research candidates", async () => {
    const draft = await unitEngine.createDraftFromResearchCandidates("research_af_candidates");
    expect(draft.draftType).toBe("research_candidate_family");
    expect(draft.members.length).toBeGreaterThan(0);
    expect(draft.relationships).toEqual([]);
    expect(draft.members.every((member) => !Object.hasOwn(member, "factorToBase"))).toBe(true);
  });

  it("seals and rejects tampered unit snapshots", async () => {
    const snapshot = await unitEngine.createSnapshot({
      runtimeFactors: { CUSTOM_AREA: "12.5" },
      units: [{
        id: "CUSTOM_AREA",
        name: "Custom area",
        symbol: "ca",
        dimension: "area",
        factorToBase: "12.5",
      }],
    });
    await expect(unitEngine.validateSnapshot(snapshot)).resolves.toBe(true);
    await expect(unitEngine.restoreSnapshot({
      ...snapshot,
      factors: { CUSTOM_AREA: "13" },
    })).rejects.toMatchObject({ code: UNIT_ERROR_CODES.IMPORT_INVALID });
  });
});
