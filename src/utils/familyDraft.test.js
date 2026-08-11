import { describe, expect, it } from "vitest";
import { removeFamilyMemberSafely } from "./familyDraft";

describe("family draft editing", () => {
  it("never reuses an adjacent multiplier after removing a middle member", () => {
    const draft = {
      members: ["A", "B", "C"].map((id) => ({ id })),
      relationships: [
        { id: "AB", parentUnitId: "A", childUnitId: "B", multiplier: "20" },
        { id: "BC", parentUnitId: "B", childUnitId: "C", multiplier: "40" },
      ],
      anchor: { referenceId: "B" },
    };
    const result = removeFamilyMemberSafely(draft, "B");
    expect(result.members.map((item) => item.id)).toEqual(["A", "C"]);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].multiplier).toBe("");
    expect(result.relationships[0].confirmedByUser).toBe(false);
    expect(result.anchor).toBeNull();
  });
});

