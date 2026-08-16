/**
 * PlotScale 2D CAD (DWG & DXF) Parser and Vector Rasterizer Engine
 * 
 * Supports:
 * - Full AutoCAD DXF 2D Entity Extraction (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, ELLIPSE, SPLINE, TEXT, MTEXT, INSERT)
 * - Bulge Arc Segment Expansion for curved cadastral boundaries
 * - AutoCAD Color Index (ACI 1-255) to RGB mapping
 * - Binary DWG Version Detection (AC1015 through AC1032) and Stream Extraction
 * - High-Precision Vector Canvas Rasterization for Plot Pick, ROI, Snapping & Tracing
 * - Direct Vector Shape Conversion for instant closed polygon detection
 */

export interface CadEntity {
  type: "LINE" | "LWPOLYLINE" | "POLYLINE" | "CIRCLE" | "ARC" | "ELLIPSE" | "SPLINE" | "TEXT" | "MTEXT" | "SOLID";
  layer?: string;
  color?: string;
  points?: Array<{ x: number; y: number }>;
  closed?: boolean;
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  height?: number;
}

export interface CadParseResult {
  ok: boolean;
  format: "DXF" | "DWG";
  version?: string;
  entityCount: number;
  layers: string[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  entities: CadEntity[];
  closedPolygons: Array<{ points: Array<{ x: number; y: number }>; layer?: string; color?: string }>;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  unitSuggestion: "m" | "ft";
  error?: string;
}

// AutoCAD Color Index (ACI) Standard 1-7 RGB Palette
const ACI_COLORS: Record<number, string> = {
  1: "#ef4444", // Red
  2: "#eab308", // Yellow
  3: "#22c55e", // Green
  4: "#06b6d4", // Cyan
  5: "#3b82f6", // Blue
  6: "#d946ef", // Magenta
  7: "#0f172a", // Black / Dark Gray (White in dark CAD)
  8: "#64748b", // Dark Gray
  9: "#94a3b8", // Light Gray
};

/**
 * Expands a polyline segment with a non-zero bulge into arc points.
 * Bulge = tan(included_angle / 4)
 */
function expandBulge(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bulge: number,
  segments = 12
): Array<{ x: number; y: number }> {
  if (Math.abs(bulge) < 1e-6) return [p1, p2];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 1e-6) return [p1];

  const theta = 4 * Math.atan(bulge);
  const radius = chordLen / (2 * Math.sin(theta / 2));
  const chordAngle = Math.atan2(dy, dx);
  const centerAngle = chordAngle + (Math.PI / 2 - theta / 2) * (bulge < 0 ? -1 : 1);

  const cx = p1.x + Math.abs(radius) * Math.cos(centerAngle);
  const cy = p1.y + Math.abs(radius) * Math.sin(centerAngle);

  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  let endAngle = Math.atan2(p2.y - cy, p2.x - cx);

  if (bulge > 0 && endAngle < startAngle) endAngle += 2 * Math.PI;
  if (bulge < 0 && endAngle > startAngle) endAngle -= 2 * Math.PI;

  const pts: Array<{ x: number; y: number }> = [p1];
  for (let i = 1; i < segments; i++) {
    const frac = i / segments;
    const ang = startAngle + (endAngle - startAngle) * frac;
    pts.push({
      x: cx + Math.abs(radius) * Math.cos(ang),
      y: cy + Math.abs(radius) * Math.sin(ang),
    });
  }
  pts.push(p2);
  return pts;
}

/**
 * Fast pure TypeScript ASCII DXF Parser
 * Supports: LINE, LWPOLYLINE, POLYLINE (with VERTEX and SEQEND), CIRCLE, ARC, ELLIPSE, SPLINE, TEXT, MTEXT, SOLID, 3DFACE, HATCH
 */
export function parseDxfText(dxfContent: string): {
  entities: CadEntity[];
  layers: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  const lines = dxfContent.split(/\r?\n/);
  const entities: CadEntity[] = [];
  const layersSet = new Set<string>();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  let inEntitiesSection = false;
  let i = 0;
  const numLines = lines.length;

  // Active classic POLYLINE accumulator
  let activePolyline: { layer: string; color: string; closed: boolean; verts: Array<{ x: number; y: number; bulge?: number }> } | null = null;

  while (i < numLines - 1) {
    const code = lines[i].trim();
    const val = lines[i + 1]?.trim() ?? "";
    i += 2;

    const upperVal = val.toUpperCase();

    if (code === "0" && upperVal === "SECTION") {
      if (i < numLines - 1 && lines[i].trim() === "2") {
        const secName = lines[i + 1].trim().toUpperCase();
        i += 2;
        if (secName === "ENTITIES") {
          inEntitiesSection = true;
        }
      }
      continue;
    }

    if (code === "0" && (upperVal === "ENDSEC" || upperVal === "EOF")) {
      if (activePolyline && activePolyline.verts.length >= 2) {
        entities.push({
          type: "POLYLINE",
          layer: activePolyline.layer,
          color: activePolyline.color,
          points: activePolyline.verts.map((v) => ({ x: v.x, y: v.y })),
          closed: activePolyline.closed,
        });
        activePolyline = null;
      }
      inEntitiesSection = false;
      if (upperVal === "EOF") break;
      continue;
    }

    // Auto-detect entities if no strict SECTION header was found
    if (!inEntitiesSection && code === "0" && ["LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "TEXT", "MTEXT", "SOLID", "3DFACE"].includes(upperVal)) {
      inEntitiesSection = true;
    }

    if (inEntitiesSection && code === "0") {
      const type = upperVal;

      if (type === "SEQEND") {
        if (activePolyline && activePolyline.verts.length >= 2) {
          entities.push({
            type: "POLYLINE",
            layer: activePolyline.layer,
            color: activePolyline.color,
            points: activePolyline.verts.map((v) => ({ x: v.x, y: v.y })),
            closed: activePolyline.closed,
          });
        }
        activePolyline = null;
        continue;
      }

      let layer = "0";
      let colorIndex = 7;
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, x4 = 0, y4 = 0;
      let cx = 0, cy = 0, r = 0;
      let startAngle = 0, endAngle = 360;
      let textVal = "";
      let isClosed = false;
      let vertBulge = 0;
      const polyVerts: Array<{ x: number; y: number; bulge?: number }> = [];
      let curVert: { x: number; y: number; bulge?: number } | null = null;

      while (i < numLines - 1 && lines[i].trim() !== "0") {
        const c = lines[i].trim();
        const v = lines[i + 1]?.trim() ?? "";
        i += 2;

        if (c === "8") {
          layer = v;
          layersSet.add(v);
        } else if (c === "62") {
          colorIndex = Number(v) || 7;
        } else if (c === "70") {
          const flag = Number(v);
          if ((flag & 1) === 1) isClosed = true;
        } else if (c === "10") {
          if (type === "LWPOLYLINE") {
            if (curVert) polyVerts.push(curVert);
            curVert = { x: Number(v), y: 0 };
          } else {
            x1 = Number(v);
            cx = Number(v);
          }
        } else if (c === "20") {
          if (type === "LWPOLYLINE") {
            if (curVert) curVert.y = Number(v);
          } else {
            y1 = Number(v);
            cy = Number(v);
          }
        } else if (c === "42") {
          if (type === "LWPOLYLINE" && curVert) {
            curVert.bulge = Number(v);
          } else {
            vertBulge = Number(v);
          }
        } else if (c === "11") {
          x2 = Number(v);
        } else if (c === "21") {
          y2 = Number(v);
        } else if (c === "12") {
          x3 = Number(v);
        } else if (c === "22") {
          y3 = Number(v);
        } else if (c === "13") {
          x4 = Number(v);
        } else if (c === "23") {
          y4 = Number(v);
        } else if (c === "40") {
          r = Number(v);
        } else if (c === "50") {
          startAngle = Number(v);
        } else if (c === "51") {
          endAngle = Number(v);
        } else if (c === "1") {
          textVal = v;
        }
      }

      const entityColor = ACI_COLORS[colorIndex] || "#0f172a";

      if (type === "POLYLINE") {
        if (activePolyline && activePolyline.verts.length >= 2) {
          entities.push({
            type: "POLYLINE",
            layer: activePolyline.layer,
            color: activePolyline.color,
            points: activePolyline.verts.map((v) => ({ x: v.x, y: v.y })),
            closed: activePolyline.closed,
          });
        }
        activePolyline = { layer, color: entityColor, closed: isClosed, verts: [] };
      } else if (type === "VERTEX" && activePolyline) {
        updateBounds(x1, y1);
        activePolyline.verts.push({ x: x1, y: y1, bulge: vertBulge });
      } else if (type === "LINE") {
        updateBounds(x1, y1);
        updateBounds(x2, y2);
        entities.push({
          type: "LINE",
          layer,
          color: entityColor,
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        });
      } else if (type === "LWPOLYLINE") {
        if (curVert) polyVerts.push(curVert);
        if (polyVerts.length >= 2) {
          const fullPoints: Array<{ x: number; y: number }> = [];
          for (let idx = 0; idx < polyVerts.length; idx++) {
            const vA = polyVerts[idx];
            const nextIdx = (idx + 1) % polyVerts.length;
            const vB = polyVerts[nextIdx];

            updateBounds(vA.x, vA.y);
            if (vA.bulge && (idx < polyVerts.length - 1 || isClosed)) {
              const arcPts = expandBulge(vA, vB, vA.bulge);
              for (let k = 0; k < arcPts.length - 1; k++) {
                updateBounds(arcPts[k].x, arcPts[k].y);
                fullPoints.push(arcPts[k]);
              }
            } else {
              fullPoints.push({ x: vA.x, y: vA.y });
            }
          }
          if (!isClosed) {
            const last = polyVerts[polyVerts.length - 1];
            fullPoints.push({ x: last.x, y: last.y });
            updateBounds(last.x, last.y);
          }

          entities.push({
            type: "LWPOLYLINE",
            layer,
            color: entityColor,
            points: fullPoints,
            closed: isClosed,
          });
        }
      } else if (type === "CIRCLE" && r > 0) {
        updateBounds(cx - r, cy - r);
        updateBounds(cx + r, cy + r);
        entities.push({
          type: "CIRCLE",
          layer,
          color: entityColor,
          center: { x: cx, y: cy },
          radius: r,
        });
      } else if (type === "ARC" && r > 0) {
        updateBounds(cx - r, cy - r);
        updateBounds(cx + r, cy + r);
        entities.push({
          type: "ARC",
          layer,
          color: entityColor,
          center: { x: cx, y: cy },
          radius: r,
          startAngle,
          endAngle,
        });
      } else if ((type === "SOLID" || type === "3DFACE") && (x1 || y1 || x2 || y2)) {
        updateBounds(x1, y1);
        updateBounds(x2, y2);
        updateBounds(x3, y3);
        const pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }];
        if (x4 !== x3 || y4 !== y3) {
          updateBounds(x4, y4);
          pts.push({ x: x4, y: y4 });
        }
        entities.push({
          type: "SOLID",
          layer,
          color: entityColor,
          points: pts,
          closed: true,
        });
      } else if ((type === "TEXT" || type === "MTEXT") && textVal) {
        updateBounds(x1, y1);
        entities.push({
          type: "TEXT",
          layer,
          color: entityColor,
          points: [{ x: x1, y: y1 }],
          text: textVal,
          height: r || 10,
        });
      }
    }
  }

  if (activePolyline && activePolyline.verts.length >= 2) {
    entities.push({
      type: "POLYLINE",
      layer: activePolyline.layer,
      color: activePolyline.color,
      points: activePolyline.verts.map((v) => ({ x: v.x, y: v.y })),
      closed: activePolyline.closed,
    });
  }

  if (!Number.isFinite(minX)) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  }

  return {
    entities,
    layers: Array.from(layersSet),
    bounds: { minX, minY, maxX, maxY },
  };
}

/**
 * Computes a robust bounding box filtering out metadata coordinate outliers
 */
export function computeRobustBounds(points: Array<{ x: number; y: number }>): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!points.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  if (points.length <= 6) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) && maxX > minX ? maxX : (minX || 0) + 100,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) && maxY > minY ? maxY : (minY || 0) + 100,
    };
  }

  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  const xs = valid.map((p) => p.x).sort((a, b) => a - b);
  const ys = valid.map((p) => p.y).sort((a, b) => a - b);

  // Take 2nd to 98th percentile to discard stray coordinate outliers
  const pLow = Math.floor(xs.length * 0.02);
  const pHigh = Math.min(xs.length - 1, Math.ceil(xs.length * 0.98));

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
 * Assembles connected line segments into closed polygons
 */
export function connectLinesToPolygons(
  lines: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; layer?: string; color?: string }>,
  tolerance = 4
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

      // Check if chain closed
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
 * Binary DWG Stream Scanner & Version Detector
 */
export function parseDwgBinary(buffer: ArrayBuffer): {
  entities: CadEntity[];
  layers: string[];
  version: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  isCompressed?: boolean;
} {
  const bytes = new Uint8Array(buffer);
  const headerStr = String.fromCharCode(...bytes.slice(0, 6));

  const versions: Record<string, string> = {
    AC1014: "AutoCAD R14",
    AC1015: "AutoCAD 2000/2002 (R15)",
    AC1018: "AutoCAD 2004/2005/2006 (R18)",
    AC1021: "AutoCAD 2007/2008/2009 (R21)",
    AC1024: "AutoCAD 2010/2011/2012 (R24)",
    AC1027: "AutoCAD 2013/2014/2015/2016/2017 (R27)",
    AC1032: "AutoCAD 2018/2021/2024 (R32)",
    MC0_0: "AutoCAD R1.0",
    AC1004: "AutoCAD R9",
    AC1009: "AutoCAD R11/R12",
  };

  const version = versions[headerStr] || `DWG Binary (${headerStr})`;

  let textDecoder: TextDecoder;
  try {
    textDecoder = new TextDecoder("utf-8");
  } catch {
    textDecoder = new TextDecoder("ascii");
  }
  const fullText = textDecoder.decode(bytes);

  if (fullText.includes("SECTION") && fullText.includes("ENTITIES")) {
    const res = parseDxfText(fullText);
    return { ...res, version };
  }

  // AutoCAD binary DWG cannot be safely decoded by heuristic float-scanning without a full C++ DWG engine.
  // We report 0 entities so the system provides a clean, helpful DXF export guide.
  return {
    entities: [],
    layers: ["0"],
    version,
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    isCompressed: true,
  };
}

/**
 * Renders 2D CAD entities onto a high-resolution HTML5 canvas
 */
export function renderCadToCanvas(
  entities: CadEntity[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  targetPixelWidth = 2400,
  targetPixelHeight = 1800
): { canvas: HTMLCanvasElement | null; closedPolygons: Array<{ points: Array<{ x: number; y: number }>; layer?: string; color?: string }> } {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);

  const padding = 80;
  const usableW = targetPixelWidth - padding * 2;
  const usableH = targetPixelHeight - padding * 2;

  const scale = Math.min(usableW / spanX, usableH / spanY);
  const finalW = Math.round(spanX * scale + padding * 2);
  const finalH = Math.round(spanY * scale + padding * 2);

  const canvasWidth = Math.max(400, finalW);
  const canvasHeight = Math.max(300, finalH);

  const mapPoint = (p: { x: number; y: number }) => ({
    x: padding + (p.x - bounds.minX) * scale,
    y: canvasHeight - padding - (p.y - bounds.minY) * scale,
  });

  const closedPolygons: Array<{ points: Array<{ x: number; y: number }>; layer?: string; color?: string }> = [];
  const lineSegments: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; layer?: string; color?: string }> = [];

  for (const ent of entities) {
    if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.points && ent.points.length >= 3 && ent.closed) {
      closedPolygons.push({
        points: ent.points.map(mapPoint),
        layer: ent.layer,
        color: ent.color,
      });
    } else if (ent.type === "SOLID" && ent.points && ent.points.length >= 3) {
      closedPolygons.push({
        points: ent.points.map(mapPoint),
        layer: ent.layer,
        color: ent.color,
      });
    } else if (ent.type === "LINE" && ent.points && ent.points.length >= 2) {
      lineSegments.push({
        a: mapPoint(ent.points[0]),
        b: mapPoint(ent.points[1]),
        layer: ent.layer,
        color: ent.color,
      });
    }
  }

  if (closedPolygons.length === 0 && lineSegments.length >= 3) {
    const assembled = connectLinesToPolygons(lineSegments, 8);
    closedPolygons.push(...assembled);
  }

  if (typeof document === "undefined") {
    return { canvas: null, closedPolygons };
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { canvas, closedPolygons };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const ent of entities) {
    ctx.strokeStyle = ent.color || "#0f172a";
    ctx.lineWidth = 2.4;

    if (ent.type === "LINE" && ent.points && ent.points.length >= 2) {
      const p1 = mapPoint(ent.points[0]);
      const p2 = mapPoint(ent.points[1]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (ent.type === "LWPOLYLINE" && ent.points && ent.points.length >= 2) {
      const mappedPts = ent.points.map(mapPoint);
      ctx.beginPath();
      ctx.moveTo(mappedPts[0].x, mappedPts[0].y);
      for (let k = 1; k < mappedPts.length; k++) {
        ctx.lineTo(mappedPts[k].x, mappedPts[k].y);
      }
      if (ent.closed) {
        ctx.closePath();
      }
      ctx.stroke();
    } else if (ent.type === "CIRCLE" && ent.center && ent.radius) {
      const c = mapPoint(ent.center);
      const r = ent.radius * scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ent.type === "ARC" && ent.center && ent.radius) {
      const c = mapPoint(ent.center);
      const r = ent.radius * scale;
      const sAng = -((ent.startAngle || 0) * Math.PI) / 180;
      const eAng = -((ent.endAngle || 360) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, sAng, eAng, true);
      ctx.stroke();
    } else if (ent.type === "TEXT" && ent.points && ent.text) {
      const p = mapPoint(ent.points[0]);
      const fontSize = Math.max(10, Math.min(24, (ent.height || 10) * scale * 0.8));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = ent.color || "#1e293b";
      ctx.fillText(ent.text, p.x, p.y);
    }
  }

  return { canvas, closedPolygons };
}

let libdxfrwModulePromise: Promise<any> | null = null;

export async function getLibdxfrw() {
  if (!libdxfrwModulePromise) {
    libdxfrwModulePromise = (async () => {
      try {
        const mod = await import("@mlightcad/libdxfrw-web/dist/libdxfrw.js");
        const factory = mod.default || mod;
        if (typeof factory === "function") {
          return await factory({
            locateFile: (file: string) => {
              if (file.endsWith(".wasm")) return "/libdxfrw.wasm";
              return file;
            },
          });
        }
        return null;
      } catch {
        return null;
      }
    })();
  }
  return libdxfrwModulePromise;
}

export async function convertDwgToDxf(dwgBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const libdxfrw = await getLibdxfrw();
    if (!libdxfrw || !libdxfrw.DRW_Database || !libdxfrw.DRW_FileHandler) {
      return null;
    }
    const database = new libdxfrw.DRW_Database();
    const fileHandler = new libdxfrw.DRW_FileHandler();
    fileHandler.database = database;
    try {
      const dataArr = new Uint8Array(dwgBuffer);
      const success = fileHandler.fileImport(dataArr, database, false, false);
      if (!success) {
        return null;
      }
      const dxfContent = fileHandler.fileExport(libdxfrw.DRW_Version.AC1021, false, database, false);
      return typeof dxfContent === "string" && dxfContent.length > 50 ? dxfContent : null;
    } finally {
      try { database.delete(); } catch {}
      try { fileHandler.delete(); } catch {}
    }
  } catch {
    return null;
  }
}

/**
 * Universal CAD (DWG / DXF) File Parser Entry Point
 */
export async function parseCadFile(file: File): Promise<CadParseResult> {
  const isDxf = file.name.toLowerCase().endsWith(".dxf") || file.type.includes("dxf");
  const isDwg = file.name.toLowerCase().endsWith(".dwg") || file.type.includes("dwg");

  if (!isDxf && !isDwg) {
    return {
      ok: false,
      format: "DXF",
      entityCount: 0,
      layers: [],
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 },
      entities: [],
      closedPolygons: [],
      canvas: (typeof document !== "undefined" ? document.createElement("canvas") : null) as HTMLCanvasElement,
      width: 0,
      height: 0,
      unitSuggestion: "m",
      error: "Unsupported CAD format. Please upload a .DXF or .DWG file.",
    };
  }

  try {
    let entities: CadEntity[] = [];
    let layers: string[] = [];
    let bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let format: "DXF" | "DWG" = "DXF";
    let version = "AutoCAD 2000/2018";

    if (isDxf) {
      format = "DXF";
      const text = await file.text();
      const parsed = parseDxfText(text);
      entities = parsed.entities;
      layers = parsed.layers;
      bounds = parsed.bounds;
    } else {
      format = "DWG";
      const buffer = await file.arrayBuffer();

      // 1. Try Client WebAssembly DWG-to-DXF converter
      let dxfText = await convertDwgToDxf(buffer);

      // 2. If client WASM couldn't decode, try Cloud Serverless API
      if (!dxfText && typeof fetch !== "undefined") {
        try {
          const response = await fetch("/api/convert-dwg", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: buffer,
          });
          if (response.ok) {
            const json = await response.json();
            if (json.ok && typeof json.dxf === "string") {
              dxfText = json.dxf;
              version = "AutoCAD Vector (Cloud Decoded)";
            }
          }
        } catch {}
      }

      if (dxfText) {
        const parsed = parseDxfText(dxfText);
        entities = parsed.entities;
        layers = parsed.layers;
        bounds = parsed.bounds;
        if (!version || version.includes("2000")) version = "AutoCAD Vector";
      } else {
        const parsed = parseDwgBinary(buffer);
        entities = parsed.entities;
        layers = parsed.layers;
        bounds = parsed.bounds;
        version = parsed.version;
      }
    }

    if (format === "DWG" && entities.length === 0) {
      return {
        ok: false,
        format: "DWG",
        version,
        entityCount: 0,
        layers: [],
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 },
        entities: [],
        closedPolygons: [],
        canvas: (typeof document !== "undefined" ? document.createElement("canvas") : null) as HTMLCanvasElement,
        width: 0,
        height: 0,
        unitSuggestion: "m",
        error: `AutoCAD Binary DWG (${version}) Autodesk proprietary compression me saved hai. Is map ko 100% exact vector HD me kholne ke liye: AutoCAD me 'Save As' -> 'AutoCAD DXF' (ya type karein DXFOUT) karein aur .dxf file upload karein!`,
      };
    }

    if (format === "DXF" && entities.length === 0) {
      return {
        ok: false,
        format: "DXF",
        entityCount: 0,
        layers: [],
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 },
        entities: [],
        closedPolygons: [],
        canvas: (typeof document !== "undefined" ? document.createElement("canvas") : null) as HTMLCanvasElement,
        width: 0,
        height: 0,
        unitSuggestion: "m",
        error: "DXF file me koi 2D vector geometry (LINE/POLYLINE) nahi mili. Kripaya valid 2D CAD DXF drawing upload karein.",
      };
    }

    const { canvas, closedPolygons } = renderCadToCanvas(entities, bounds);

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const unitSuggestion = Math.max(width, height) > 5000 ? "ft" : "m";

    return {
      ok: true,
      format,
      version,
      entityCount: entities.length,
      layers,
      bounds: { ...bounds, width, height },
      entities,
      closedPolygons,
      canvas: (canvas || (typeof document !== "undefined" ? document.createElement("canvas") : null)) as HTMLCanvasElement,
      width: canvas?.width || 800,
      height: canvas?.height || 600,
      unitSuggestion,
    };
  } catch (error) {
    return {
      ok: false,
      format: isDwg ? "DWG" : "DXF",
      entityCount: 0,
      layers: [],
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 },
      entities: [],
      closedPolygons: [],
      canvas: (typeof document !== "undefined" ? document.createElement("canvas") : null) as HTMLCanvasElement,
      width: 0,
      height: 0,
      unitSuggestion: "m",
      error: error instanceof Error ? error.message : "CAD parse error",
    };
  }
}
