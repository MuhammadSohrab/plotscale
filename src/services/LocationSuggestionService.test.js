import { describe, expect, it } from "vitest";
import { locationSuggestionService } from "./LocationSuggestionService";

describe("LocationSuggestionService", () => {
  it("suggests only the matching Assam pack and global verified standards", () => {
    const result = locationSuggestionService.suggest({ countryCode: "IN", admin1Code: "AS" });
    expect(result.suggested.map((pack) => pack.manifest.id))
      .toContain("in_assam_bigha_katha_lessa");
    expect(result.suggested.map((pack) => pack.manifest.id))
      .not.toContain("in_west_bengal_bigha_katha_chatak");
    expect(result.verified.some((pack) => pack.manifest.id === "global_si_metric")).toBe(true);
  });
});

