import { DIMENSIONS } from "../data/dimensions";
import { asDecimal, decimalString } from "../utils/decimal";
import { UNIT_ERROR_CODES, unitError } from "../services/UnitErrors";

const text = (value, label) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
};

export const createLocationSelection = (input = {}) => ({
  countryCode: text(input.countryCode, "Country").toUpperCase(),
  nodePathIds: [...new Set(input.nodePathIds ?? [])],
  measurementRegionIds: [...new Set(input.measurementRegionIds ?? [])],
  resolutionLevel: Number(input.resolutionLevel ?? input.nodePathIds?.length ?? 0),
  confirmedByUser: input.confirmedByUser !== false,
  source: input.source ?? "manual",
});

export const createStandaloneCustomUnit = (input) => {
  const dimension = input.dimension;
  if (![DIMENSIONS.LENGTH, DIMENSIONS.AREA].includes(dimension)) {
    throw unitError(UNIT_ERROR_CODES.DIMENSION_MISMATCH, "Custom unit must be length or area.");
  }
  return {
    id: input.id ?? `CUSTOM_${dimension.toUpperCase()}_${crypto.randomUUID()}`,
    ownerKey: input.ownerKey ?? "guest",
    name: text(input.name, "Unit name"),
    symbol: text(input.symbol, "Unit symbol"),
    dimension,
    factorToBase: decimalString(asDecimal(input.factorToBase, "Unit factor", { allowZero: false })),
    note: String(input.note ?? "").trim(),
    exactness: "user_confirmed",
    customKind: "standalone_unit",
    isCustom: true,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const createUserFamilyDraft = (input = {}) => ({
  id: input.id ?? `DRAFT_${crypto.randomUUID()}`,
  schemaVersion: input.schemaVersion ?? "1.0.0",
  draftType: input.draftType ?? (input.sourcePackId || input.packId
    ? "suggested_family"
    : "custom_family"),
  ownerKey: input.ownerKey ?? "guest",
  sourcePackId: input.sourcePackId ?? input.packId ?? null,
  sourcePackVersion: input.sourcePackVersion ?? input.packVersion ?? null,
  familyId: input.familyId ?? `CUSTOM_FAMILY_${crypto.randomUUID()}`,
  name: text(input.name ?? "My local unit family", "Family name"),
  dimension: input.dimension ?? DIMENSIONS.AREA,
  members: (input.members ?? []).map((member) => ({
    id: text(member.id, "Member id"),
    name: text(member.name, "Member name"),
    symbol: text(member.symbol, "Member symbol"),
    dimension: member.dimension ?? input.dimension ?? DIMENSIONS.AREA,
    aliases: member.aliases ?? [],
  })),
  relationships: (input.relationships ?? []).map((relationship) => ({
    id: relationship.id ?? `REL_${crypto.randomUUID()}`,
    parentUnitId: text(relationship.parentUnitId, "Parent unit"),
    childUnitId: text(relationship.childUnitId, "Child unit"),
    multiplier: decimalString(asDecimal(
      relationship.multiplier,
      "Relationship multiplier",
      { allowZero: false },
    )),
    confirmedByUser: relationship.confirmedByUser === true,
  })),
  tools: input.tools ?? [],
  sourceCandidateIds: [...new Set(input.sourceCandidateIds ?? [])],
  returnRoute: input.returnRoute ?? null,
  validationStatus: input.validationStatus ?? "not_validated",
  toolToAreaRelationships: (input.toolToAreaRelationships ?? []).map((relationship) => ({
    id: relationship.id ?? `TOOL_AREA_${crypto.randomUUID()}`,
    toolId: text(relationship.toolId, "Measuring tool"),
    targetAreaUnitId: text(relationship.targetAreaUnitId, "Target area unit"),
    power: Number(relationship.power ?? 2),
    multiplier: decimalString(asDecimal(
      relationship.multiplier ?? 1,
      "Tool-area multiplier",
      { allowZero: false },
    )),
    confirmedByUser: relationship.confirmedByUser === true,
  })),
  anchor: input.anchor ?? null,
  status: input.status ?? "draft",
  createdAt: input.createdAt ?? new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function validateFamilyGraph(draft, { requireConfirmed = true } = {}) {
  const memberIds = new Set(draft.members.map((member) => member.id));
  if (!memberIds.size) {
    throw unitError(UNIT_ERROR_CODES.DISCONNECTED_FAMILY, "Add at least one family member.");
  }
  const dimensions = new Set(draft.members.map((member) => member.dimension));
  if (dimensions.size !== 1 || !dimensions.has(draft.dimension)) {
    throw unitError(
      UNIT_ERROR_CODES.DIMENSION_MISMATCH,
      "All relative family members must use the same dimension.",
    );
  }
  const adjacency = new Map([...memberIds].map((id) => [id, new Set()]));
  const unionParent = new Map([...memberIds].map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (unionParent.get(current) !== current) current = unionParent.get(current);
    return current;
  };
  const unite = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return false;
    unionParent.set(leftRoot, rightRoot);
    return true;
  };

  for (const relationship of draft.relationships) {
    if (!memberIds.has(relationship.parentUnitId) || !memberIds.has(relationship.childUnitId)) {
      throw unitError(
        UNIT_ERROR_CODES.INVALID_RELATIONSHIP,
        "Every relationship must connect units in this family.",
        { relationshipId: relationship.id },
      );
    }
    if (requireConfirmed && !relationship.confirmedByUser) {
      throw unitError(
        UNIT_ERROR_CODES.RELATIONSHIP_UNCONFIRMED,
        "Confirm every family relationship before calibration.",
        { relationshipId: relationship.id },
      );
    }
    if (!unite(relationship.parentUnitId, relationship.childUnitId)) {
      throw unitError(
        UNIT_ERROR_CODES.CYCLE_DETECTED,
        "Family relationships cannot contain a cycle.",
        { relationshipId: relationship.id },
      );
    }
    adjacency.get(relationship.parentUnitId).add(relationship.childUnitId);
    adjacency.get(relationship.childUnitId).add(relationship.parentUnitId);
  }

  if (memberIds.size > 1 && new Set([...memberIds].map(find)).size !== 1) {
    throw unitError(
      UNIT_ERROR_CODES.DISCONNECTED_FAMILY,
      "Every family member must be connected by a confirmed relationship.",
    );
  }
  for (const relationship of draft.toolToAreaRelationships ?? []) {
    if (
      draft.dimension !== DIMENSIONS.AREA
      || !memberIds.has(relationship.targetAreaUnitId)
      || relationship.power !== 2
      || (requireConfirmed && !relationship.confirmedByUser)
    ) {
      throw unitError(
        UNIT_ERROR_CODES.TOOL_AREA_RELATION_REQUIRED,
        "A tool-to-area relation must explicitly square a length into an area-family member.",
      );
    }
  }
  return true;
}

export function requireSingleAnchor(input) {
  const anchors = input.anchors ?? (input.anchor || input.knownBasis ? [input.anchor ?? input.knownBasis] : []);
  if (!anchors.length) {
    throw unitError(UNIT_ERROR_CODES.ANCHOR_REQUIRED, "Exactly one known calibration value is required.");
  }
  if (anchors.length > 1) {
    throw unitError(
      UNIT_ERROR_CODES.MULTIPLE_ANCHORS_FORBIDDEN,
      "Only one known calibration value is allowed.",
    );
  }
  return anchors[0];
}
