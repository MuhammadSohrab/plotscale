import { describe, expect, it } from "vitest";
import { unitResolutionService } from "./UnitResolutionService";

describe("UnitResolutionService", () => {
  it("does not resolve a generic Jareeb without a contextual pack", () => {
    expect(unitResolutionService.resolve("Jareeb", { dimension: "area" }).status)
      .toBe("unresolved");
  });

  it("keeps Jareeb length and area senses dimension-safe inside its pack", () => {
    const length = unitResolutionService.resolve("Jareeb — Length / Measuring Tool", {
      dimension: "length",
      packIds: ["pk_jareeb_22yd_length_484sqyd_area"],
    });
    const area = unitResolutionService.resolve("Square Jareeb — Area", {
      dimension: "area",
      packIds: ["pk_jareeb_22yd_length_484sqyd_area"],
    });
    expect(length.status).toBe("resolved");
    expect(area.status).toBe("resolved");
    expect(length.unit.id).not.toBe(area.unit.id);
  });
});

