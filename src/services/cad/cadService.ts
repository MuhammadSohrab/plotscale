/**
 * PlotScale Dedicated CAD Engine (DWG & DXF)
 * Provides 1:1 Engineering Precision, Layer Management, Vector Parcel Assembly, and O-Snap Tools
 */

export interface CadEntity {
  id: string;
  type: "LINE" | "LWPOLYLINE" | "POLYLINE" | "CIRCLE" | "ARC" | "ELLIPSE" | "SPLINE" | "TEXT" | "MTEXT" | "SOLID" | "HATCH";
  layer: string;
  color: string;
  points?: Array<{ x: number; y: number }>;
  closed?: boolean;
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  height?: number;
}

export interface CadLayer {
  name: string;
  color: string;
  visible: boolean;
  entityCount: number;
}

export interface CadParcel {
  id: string;
  name: string;
  khasraNo: string;
  points: Array<{ x: number; y: number }>;
  layer: string;
  color: string;
  areaSqM: number;
  perimeterM: number;
}

export interface CadDrawing {
  format: "DWG" | "DXF";
  fileName: string;
  version: string;
  entities: CadEntity[];
  layers: CadLayer[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  nativeUnit: "m" | "ft";
  parcels: CadParcel[];
}

export const ACI_PALETTE: Record<number, string> = {
  1: "#ef4444", 2: "#eab308", 3: "#22c55e", 4: "#06b6d4",
  5: "#3b82f6", 6: "#ec4899", 7: "#0f172a", 8: "#64748b", 9: "#94a3b8",
};

/**
 * Robust percentile bounds to reject CAD world coordinate outliers
 */
export function computeRobustBounds(points: Array<{ x: number; y: number }>): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!points.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  if (valid.length <= 6) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of valid) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX: maxX > minX ? maxX : minX + 100, maxY: maxY > minY ? maxY : minY + 100 };
  }

  const xs = valid.map((p) => p.x).sort((a, b) => a - b);
  const ys = valid.map((p) => p.y).sort((a, b) => a - b);

  const pLow = Math.floor(xs.length * 0.05);
  const pHigh = Math.min(xs.length - 1, Math.floor(xs.length * 0.95));

  let minX = xs[pLow];
  let maxX = xs[pHigh];
  let minY = ys[pLow];
  let maxY = ys[pHigh];

  if (maxX <= minX) { minX = xs[0]; maxX = xs[xs.length - 1]; }
  if (maxY <= minY) { minY = ys[0]; maxY = ys[ys.length - 1]; }
  if (maxX <= minX) maxX = minX + 100;
  if (maxY <= minY) maxY = minY + 100;

  return { minX, minY, maxX, maxY };
}

/**
 * Calculates Polygon Area in standard units
 */
export function calculatePolygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Calculates Perimeter in standard units
 */
export function calculatePerimeter(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return sum;
}

/**
 * Point In Polygon Test
 */
export function isPointInsidePolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Assembles connected line segments into closed polygons
 */
export function connectLinesToPolygons(
  lines: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; layer?: string; color?: string }>,
  tolerance = 0.05
): Array<{ points: Array<{ x: number; y: number }>; layer?: string; color?: string }> {
  const result: Array<{ points: Array<{ x: number; y: number }>; layer?: string; color?: string }> = [];
  const unused = [...lines];

  while (unused.length > 0) {
    const start = unused.shift()!;
    const chain: Array<{ x: number; y: number }> = [start.a, start.b];
    let extended = true;

    while (extended) {
      extended = false;
      const tail = chain[chain.length - 1];
      const head = chain[0];

      if (chain.length >= 4 && Math.hypot(tail.x - head.x, tail.y - head.y) <= tolerance) {
        break;
      }

      for (let i = 0; i < unused.length; i++) {
        const candidate = unused[i];
        if (Math.hypot(tail.x - candidate.a.x, tail.y - candidate.a.y) <= tolerance) {
          chain.push(candidate.b);
          unused.splice(i, 1);
          extended = true;
          break;
        } else if (Math.hypot(tail.x - candidate.b.x, tail.y - candidate.b.y) <= tolerance) {
          chain.push(candidate.a);
          unused.splice(i, 1);
          extended = true;
          break;
        } else if (Math.hypot(head.x - candidate.b.x, head.y - candidate.b.y) <= tolerance) {
          chain.unshift(candidate.a);
          unused.splice(i, 1);
          extended = true;
          break;
        } else if (Math.hypot(head.x - candidate.a.x, head.y - candidate.a.y) <= tolerance) {
          chain.unshift(candidate.b);
          unused.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    const head = chain[0];
    const tail = chain[chain.length - 1];
    if (chain.length >= 4 && Math.hypot(tail.x - head.x, tail.y - head.y) <= tolerance * 2) {
      result.push({
        points: chain.slice(0, -1),
        layer: start.layer,
        color: start.color,
      });
    }
  }

  return result;
}

/**
 * Pure TypeScript DXF Text Parser
 */
export function parseDxfText(dxfContent: string): {
  entities: CadEntity[];
  layers: CadLayer[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  const lines = dxfContent.split(/\r?\n/);
  const entities: CadEntity[] = [];
  const layerStats = new Map<string, { count: number; color?: string }>();
  const allPoints: Array<{ x: number; y: number }> = [];

  let i = 0;
  let inEntitiesSection = false;

  while (i < lines.length - 1) {
    const code = lines[i]?.trim();
    const val = lines[i + 1]?.trim();

    if (code === "0" && val === "SECTION") {
      if (lines[i + 2]?.trim() === "2" && lines[i + 3]?.trim() === "ENTITIES") {
        inEntitiesSection = true;
        i += 4;
        continue;
      }
    }

    if (code === "0" && val === "ENDSEC") {
      if (inEntitiesSection) {
        break;
      }
    }

    if (!inEntitiesSection) {
      i += 2;
      continue;
    }

    if (code === "0") {
      const type = val;
      i += 2;

      let layer = "0";
      let colorIndex = 7;
      let closed = false;
      let startX = 0, startY = 0, endX = 0, endY = 0;
      let radius = 0, startAngle = 0, endAngle = 360;
      let textVal = "";
      let textHeight = 10;
      const polyPts: Array<{ x: number; y: number }> = [];

      while (i < lines.length - 1 && lines[i]?.trim() !== "0") {
        const c = lines[i]?.trim();
        const v = lines[i + 1]?.trim();

        if (c === "8") layer = v;
        else if (c === "62") colorIndex = parseInt(v, 10) || 7;
        else if (c === "70") closed = (parseInt(v, 10) & 1) === 1;
        else if (c === "10") { startX = parseFloat(v); if (type === "LWPOLYLINE") polyPts.push({ x: startX, y: 0 }); }
        else if (c === "20") {
          startY = parseFloat(v);
          if (type === "LWPOLYLINE" && polyPts.length > 0) {
            polyPts[polyPts.length - 1].y = startY;
          }
        }
        else if (c === "11") endX = parseFloat(v);
        else if (c === "21") endY = parseFloat(v);
        else if (c === "40") { radius = parseFloat(v); textHeight = parseFloat(v); }
        else if (c === "50") startAngle = parseFloat(v);
        else if (c === "51") endAngle = parseFloat(v);
        else if (c === "1" || c === "3") textVal = v;

        i += 2;
      }

      const color = ACI_PALETTE[colorIndex] || "#0f172a";
      const stats = layerStats.get(layer) || { count: 0, color };
      stats.count++;
      layerStats.set(layer, stats);

      const entityId = `cad-ent-${entities.length + 1}`;

      if (type === "LINE") {
        entities.push({ id: entityId, type: "LINE", layer, color, points: [{ x: startX, y: startY }, { x: endX, y: endY }] });
        allPoints.push({ x: startX, y: startY }, { x: endX, y: endY });
      } else if (type === "LWPOLYLINE" && polyPts.length >= 2) {
        entities.push({ id: entityId, type: "LWPOLYLINE", layer, color, points: polyPts, closed });
        polyPts.forEach((p) => allPoints.push(p));
      } else if (type === "CIRCLE") {
        entities.push({ id: entityId, type: "CIRCLE", layer, color, center: { x: startX, y: startY }, radius });
        allPoints.push({ x: startX - radius, y: startY - radius }, { x: startX + radius, y: startY + radius });
      } else if (type === "ARC") {
        entities.push({ id: entityId, type: "ARC", layer, color, center: { x: startX, y: startY }, radius, startAngle, endAngle });
        allPoints.push({ x: startX - radius, y: startY - radius }, { x: startX + radius, y: startY + radius });
      } else if (type === "TEXT" || type === "MTEXT") {
        entities.push({ id: entityId, type: "TEXT", layer, color, text: textVal, points: [{ x: startX, y: startY }], height: textHeight });
        allPoints.push({ x: startX, y: startY });
      }
    } else {
      i += 2;
    }
  }

  const bounds = computeRobustBounds(allPoints);
  const layers: CadLayer[] = Array.from(layerStats.entries()).map(([name, stat]) => ({
    name,
    color: stat.color || "#0f172a",
    visible: true,
    entityCount: stat.count,
  }));

  return { entities, layers, bounds };
}

/**
 * Decodes DWG Binary with LibreDWG WebAssembly
 */
export async function parseDwgWithLibreDwg(buffer: ArrayBuffer): Promise<{
  entities: CadEntity[];
  layers: CadLayer[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} | null> {
  try {
    const pkg = await import("@mlightcad/libredwg-web");
    const LibreDwg = pkg.LibreDwg;
    if (!LibreDwg || typeof LibreDwg.create !== "function") return null;

    const libredwg = await LibreDwg.create(typeof window !== "undefined" ? "/" : undefined);
    if (!libredwg) return null;

    const dataArr = new Uint8Array(buffer);
    const dwg = libredwg.dwg_read_data(dataArr, pkg.Dwg_File_Type.DWG);
    if (!dwg) return null;

    const db = libredwg.convert(dwg);
    try { libredwg.dwg_free(dwg); } catch {}

    if (!db || !db.entities || db.entities.length === 0) return null;

    const entities: CadEntity[] = [];
    const layerStats = new Map<string, { count: number; color?: string }>();
    const allPoints: Array<{ x: number; y: number }> = [];

    for (let idx = 0; idx < db.entities.length; idx++) {
      const ent = db.entities[idx];
      const layer = ent.layer || "0";
      const color = ent.color ? `#${(ent.color & 0xffffff).toString(16).padStart(6, "0")}` : "#0f172a";
      const entityId = `dwg-ent-${idx + 1}`;

      const stats = layerStats.get(layer) || { count: 0, color };
      stats.count++;
      layerStats.set(layer, stats);

      if (ent.type === "LINE" && ent.startPoint && ent.endPoint) {
        entities.push({
          id: entityId,
          type: "LINE",
          layer,
          color,
          points: [{ x: ent.startPoint.x, y: ent.startPoint.y }, { x: ent.endPoint.x, y: ent.endPoint.y }],
        });
        allPoints.push({ x: ent.startPoint.x, y: ent.startPoint.y }, { x: ent.endPoint.x, y: ent.endPoint.y });
      } else if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.vertices && ent.vertices.length >= 2) {
        const pts = ent.vertices.map((v: any) => ({ x: v.x, y: v.y }));
        entities.push({
          id: entityId,
          type: "LWPOLYLINE",
          layer,
          color,
          points: pts,
          closed: ent.isClosed === true || ent.flag === 1,
        });
        pts.forEach((p: { x: number; y: number }) => allPoints.push(p));
      } else if (ent.type === "CIRCLE" && ent.center && ent.radius) {
        entities.push({
          id: entityId,
          type: "CIRCLE",
          layer,
          color,
          center: { x: ent.center.x, y: ent.center.y },
          radius: ent.radius,
        });
        allPoints.push({ x: ent.center.x - ent.radius, y: ent.center.y - ent.radius }, { x: ent.center.x + ent.radius, y: ent.center.y + ent.radius });
      } else if (ent.type === "ARC" && ent.center && ent.radius) {
        entities.push({
          id: entityId,
          type: "ARC",
          layer,
          color,
          center: { x: ent.center.x, y: ent.center.y },
          radius: ent.radius,
          startAngle: ent.startAngle,
          endAngle: ent.endAngle,
        });
        allPoints.push({ x: ent.center.x - ent.radius, y: ent.center.y - ent.radius }, { x: ent.center.x + ent.radius, y: ent.center.y + ent.radius });
      } else if ((ent.type === "TEXT" || ent.type === "MTEXT") && ent.text) {
        const pt = ent.startPoint || ent.insertionPoint || { x: 0, y: 0 };
        entities.push({
          id: entityId,
          type: "TEXT",
          layer,
          color,
          text: ent.text,
          points: [{ x: pt.x, y: pt.y }],
          height: ent.textHeight || 10,
        });
        allPoints.push({ x: pt.x, y: pt.y });
      }
    }

    if (entities.length === 0) return null;

    const bounds = computeRobustBounds(allPoints);
    const layers: CadLayer[] = Array.from(layerStats.entries()).map(([name, stat]) => ({
      name,
      color: stat.color || "#0f172a",
      visible: true,
      entityCount: stat.count,
    }));

    return { entities, layers, bounds };
  } catch {
    return null;
  }
}

/**
 * Universal CAD Loader (Supports DWG & DXF)
 */
export async function loadCadDrawing(file: File): Promise<CadDrawing> {
  const isDxf = file.name.toLowerCase().endsWith(".dxf");
  const isDwg = file.name.toLowerCase().endsWith(".dwg");

  if (!isDxf && !isDwg) {
    throw new Error("Unsupported CAD file. Please upload an AutoCAD .DWG or .DXF drawing.");
  }

  let entities: CadEntity[] = [];
  let layers: CadLayer[] = [];
  let bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  let version = "AutoCAD 2000/2024";

  if (isDxf) {
    const text = await file.text();
    const res = parseDxfText(text);
    entities = res.entities;
    layers = res.layers;
    bounds = res.bounds;
    version = "DXF Vector";
  } else {
    const buffer = await file.arrayBuffer();
    const res = await parseDwgWithLibreDwg(buffer);
    if (res && res.entities.length > 0) {
      entities = res.entities;
      layers = res.layers;
      bounds = res.bounds;
      version = "AutoCAD DWG Vector";
    } else {
      // Fallback via serverless converter
      try {
        const response = await fetch("/api/convert-dwg", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: buffer,
        });
        if (response.ok) {
          const json = await response.json();
          if (json.ok && json.dxf) {
            const dxfRes = parseDxfText(json.dxf);
            entities = dxfRes.entities;
            layers = dxfRes.layers;
            bounds = dxfRes.bounds;
            version = "AutoCAD Vector (Cloud Decoded)";
          }
        }
      } catch {}
    }
  }

  if (entities.length === 0) {
    throw new Error(`Drawing me koi valid 2D CAD vector entities nahi mili. Kripaya valid .dwg ya .dxf drawing upload karein.`);
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const nativeUnit = Math.max(width, height) > 5000 ? "ft" : "m";

  // Auto-assemble closed polygon parcels
  const parcels: CadParcel[] = [];
  const lineSegments: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; layer?: string; color?: string }> = [];

  for (const ent of entities) {
    if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.points && ent.points.length >= 3 && ent.closed) {
      const area = calculatePolygonArea(ent.points);
      const perimeter = calculatePerimeter(ent.points);
      parcels.push({
        id: `parcel-${parcels.length + 1}`,
        name: `Plot ${String(parcels.length + 1).padStart(2, "0")}`,
        khasraNo: `K-${100 + parcels.length + 1}`,
        points: ent.points,
        layer: ent.layer,
        color: ent.color,
        areaSqM: nativeUnit === "ft" ? area * 0.092903 : area,
        perimeterM: nativeUnit === "ft" ? perimeter * 0.3048 : perimeter,
      });
    } else if (ent.type === "LINE" && ent.points && ent.points.length >= 2) {
      lineSegments.push({ a: ent.points[0], b: ent.points[1], layer: ent.layer, color: ent.color });
    }
  }

  if (parcels.length === 0 && lineSegments.length >= 3) {
    const assembled = connectLinesToPolygons(lineSegments, Math.max(width, height) * 0.005);
    for (const poly of assembled) {
      const area = calculatePolygonArea(poly.points);
      const perimeter = calculatePerimeter(poly.points);
      parcels.push({
        id: `parcel-${parcels.length + 1}`,
        name: `Plot ${String(parcels.length + 1).padStart(2, "0")}`,
        khasraNo: `K-${100 + parcels.length + 1}`,
        points: poly.points,
        layer: poly.layer || "0",
        color: poly.color || "#00ff87",
        areaSqM: nativeUnit === "ft" ? area * 0.092903 : area,
        perimeterM: nativeUnit === "ft" ? perimeter * 0.3048 : perimeter,
      });
    }
  }

  return {
    format: isDwg ? "DWG" : "DXF",
    fileName: file.name,
    version,
    entities,
    layers,
    bounds: { ...bounds, width, height },
    nativeUnit,
    parcels,
  };
}
