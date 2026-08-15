import { describe, it, expect } from "vitest";
import { parseDxfText, parseDwgBinary, renderCadToCanvas } from "./cad-engine";

describe("CAD Engine (DXF & DWG Parsing)", () => {
  it("parses DXF lines, polylines, circles, and layers accurately", () => {
    const sampleDxf = `0
SECTION
2
ENTITIES
0
LINE
8
KHASRA_BOUNDARIES
10
100.0
20
200.0
11
300.0
21
400.0
62
1
0
LWPOLYLINE
8
PARCEL_101
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
CIRCLE
8
WELL_MARKER
10
25.0
20
25.0
40
5.0
0
ENDSEC
0
EOF`;

    const parsed = parseDxfText(sampleDxf);
    expect(parsed.entities.length).toBe(3);
    expect(parsed.layers).toContain("KHASRA_BOUNDARIES");
    expect(parsed.layers).toContain("PARCEL_101");
    expect(parsed.layers).toContain("WELL_MARKER");

    const line = parsed.entities.find((e) => e.type === "LINE");
    expect(line).toBeDefined();
    expect(line?.points).toEqual([{ x: 100, y: 200 }, { x: 300, y: 400 }]);
    expect(line?.color).toBe("#ef4444"); // ACI 1 is red

    const poly = parsed.entities.find((e) => e.type === "LWPOLYLINE");
    expect(poly).toBeDefined();
    expect(poly?.closed).toBe(true);
    expect(poly?.points?.length).toBe(4);
  });

  it("handles DWG header identification and binary scan", () => {
    const buffer = new ArrayBuffer(256);
    const view = new Uint8Array(buffer);
    // Write AC1027 header (AutoCAD 2013-2017)
    const header = "AC1027";
    for (let i = 0; i < header.length; i++) {
      view[i] = header.charCodeAt(i);
    }

    const parsed = parseDwgBinary(buffer);
    expect(parsed.version).toContain("AutoCAD 2013/2014/2015/2016/2017 (R27)");
    expect(parsed.bounds).toBeDefined();
  });

  it("renders CAD entities to canvas and identifies closed polygon parcels", () => {
    const sampleDxf = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
PARCEL_A
70
1
10
10.0
20
10.0
10
110.0
20
10.0
10
110.0
20
110.0
10
10.0
20
110.0
0
ENDSEC
0
EOF`;

    const parsed = parseDxfText(sampleDxf);
    const { canvas, closedPolygons } = renderCadToCanvas(parsed.entities, parsed.bounds, 800, 600);

    expect(closedPolygons.length).toBe(1);
    expect(closedPolygons[0].points.length).toBe(4);
    if (canvas) {
      expect(canvas.width).toBeGreaterThanOrEqual(400);
      expect(canvas.height).toBeGreaterThanOrEqual(300);
    }
  });

  it("inspects user DWG files from Cadastral folder", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dir = "C:\\Users\\SOHRAB\\Downloads\\Cadastral";
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".dwg"));
      for (const file of files) {
        const buf = fs.readFileSync(path.join(dir, file));
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const res = parseDwgBinary(ab);
        console.log(`[DWG Test] ${file} -> Version: ${res.version}, Entities: ${res.entities.length}, IsCompressed: ${res.isCompressed}`);
        expect(res.version).toBeDefined();
      }
    }
  });
});
