export const rebuildAdjacentRelationships = (
  members,
  previousRelationships = [],
  { confirmedByUser = false } = {},
) => members.slice(0, -1).map((member, index) => {
  const child = members[index + 1];
  const previous = previousRelationships.find(
    (relationship) =>
      relationship.parentUnitId === member.id
      && relationship.childUnitId === child.id,
  );
  return {
    id: previous?.id ?? `CUSTOM_REL_${crypto.randomUUID()}`,
    parentUnitId: member.id,
    childUnitId: child.id,
    multiplier: previous?.multiplier ?? "",
    confirmedByUser: previous ? confirmedByUser : false,
  };
});

export const removeFamilyMemberSafely = (draft, memberId) => {
  const members = draft.members.filter((member) => member.id !== memberId);
  if (members.length < 2) throw new Error("A relative family needs at least two members.");
  const relationships = rebuildAdjacentRelationships(members, draft.relationships);
  return {
    ...draft,
    members,
    relationships,
    anchor: draft.anchor?.referenceId === memberId ? null : draft.anchor ?? null,
  };
};

