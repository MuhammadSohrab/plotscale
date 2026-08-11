import { describe, expect, it } from "vitest";
import {
  buildGeoJson,
  parseGeoJson,
  validateGeoPoints,
} from "./geoFiles";

const square = [
  { lat: 26.76, lng: 83.37 },
  { lat: 26.76, lng: 83.38 },
  { lat: 26.75, lng: 83.38 },
  { lat: 26.75, lng: 83.37 },
];

describe("GeoJSON plot exchange", () => {
  it("round-trips a valid polygon without duplicating its closing point", () => {
    const parsed = parseGeoJson(buildGeoJson(square, { name: "Test plot" }));
    expect(parsed).toEqual(square);
  });

  it("rejects a self-crossing polygon", () => {
    expect(() => validateGeoPoints([
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 0 },
    ])).toThrow("crosses itself");
  });

  it("rejects duplicate adjacent points and invalid coordinates", () => {
    expect(() => validateGeoPoints([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
    ])).toThrow("zero-length side");
    expect(() => validateGeoPoints([
      { lat: 91, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 0 },
    ])).toThrow("invalid latitude");
  });
});
