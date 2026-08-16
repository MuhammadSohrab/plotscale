import { describe, it, expect } from "vitest";
import {
  parseDxfText,
  calculatePolygonArea,
  calculatePerimeter,
  isPointInsidePolygon,
  connectLinesToPolygons,
  computeRobustBounds,
} from "./cadService";

describe("Dedicated CAD Service", () => {
  it("parses DXF text with layers, entities, and colors accurately", () => {
    const sampleDxf = `0
SECTION
2
ENTITIES
0
LINE
8
BOUNDARY
10
0.0
20
0.0
11
100.0
21
0.0
62
1
0
LINE
8
BOUNDARY
10
100.0
20
0.0
11
100.0
21
50.0
62
1
0
LWPOLYLINE
8
PARCEL_A
70
1
10
0.0
20
0.0
10
50.0
20
0.0
10
50.0
20
50.0
10
0.0
20
50.0
0
ENDSEC
0
EOF`;

    const res = parseDxfText(sampleDxf);
    expect(res.entities.length).toBe(3);
    expect(res.layers.some((l) => l.name === "BOUNDARY")).toBe(true);
    expect(res.layers.some((l) => l.name === "PARCEL_A")).toBe(true);
    expect(res.bounds.minX).toBe(0);
    expect(res.bounds.maxX).toBe(100);
  });

  it("calculates exact polygon area and perimeter", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(calculatePolygonArea(square)).toBe(100);
    expect(calculatePerimeter(square)).toBe(40);
  });

  it("tests point in polygon detection accurately", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(isPointInsidePolygon({ x: 5, y: 3 }, triangle)).toBe(true);
    expect(isPointInsidePolygon({ x: 20, y: 20 }, triangle)).toBe(false);
  });

  it("assembles connected lines into closed parcel polygons", () => {
    const lines = [
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
      { a: { x: 10, y: 10 }, b: { x: 0, y: 10 } },
      { a: { x: 0, y: 10 }, b: { x: 0, y: 0 } },
    ];
    const assembled = connectLinesToPolygons(lines, 0.5);
    expect(assembled.length).toBe(1);
    expect(assembled[0].points.length).toBe(4);
  });

  it("computes robust bounds filtering outliers", () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: i * 10 }));
    pts.push({ x: 1000000, y: 1000000 }); // Outlier
    const bounds = computeRobustBounds(pts);
    expect(bounds.maxX).toBeLessThan(100000);
  });
});
