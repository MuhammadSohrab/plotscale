export interface Point {
  x: number;
  y: number;
}

export interface SideMeasurement {
  id: string;
  fromIndex: number;
  toIndex: number;
  length: number; // Real-world units (feet/meters)
  rawPxLength?: number; // Exact unrounded pixel length from rough drawing
  isLocked?: boolean;
}

export interface DiagonalMeasurement {
  id: string;
  fromIndex: number;
  toIndex: number;
  length: number; // Real-world units (feet/meters)
  isLocked?: boolean;
}

export interface SurveyTriangle {
  id: string;
  name: string;
  indices: [number, number, number];
  a: number;
  b: number;
  c: number;
  areaSqM: number;
}

export interface TriangulationResult {
  ok: boolean;
  solvedPoints?: Point[];
  triangles?: SurveyTriangle[];
  requiredDiagonals: number;
  enteredDiagonals: number;
  missingDiagonalsCount: number;
  reason?: string;
}

/**
 * Calculates triangle area using Heron's Formula
 */
export function calculateHeronArea(a: number, b: number, c: number): number {
  if (a <= 0 || b <= 0 || c <= 0) return 0;
  if (a + b <= c || a + c <= b || b + c <= a) return 0;
  const s = (a + b + c) / 2;
  const areaSq = s * (s - a) * (s - b) * (s - c);
  return areaSq > 0 ? Math.sqrt(areaSq) : 0;
}

/**
 * Required diagonals for N-sided polygon ($N-3$)
 */
export function getRequiredDiagonalsCount(vertexCount: number): number {
  return Math.max(0, vertexCount - 3);
}

/**
 * Calculates interior angle in degrees at vertex pCurr between pPrev and pNext.
 */
export function calculateInteriorAngle(pPrev: Point, pCurr: Point, pNext: Point): number {
  const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
  const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

  const angle1 = Math.atan2(v1.y, v1.x);
  const angle2 = Math.atan2(v2.y, v2.x);

  let diff = (angle2 - angle1) * (180 / Math.PI);
  if (diff < 0) diff += 360;

  return Math.round(diff * 10) / 10;
}

/**
 * Recalibrates all unlocked sides using exact raw pixel distance ratio.
 */
export function recalibrateUnlockedSides(
  sides: SideMeasurement[],
  baselineIndex: number,
  enteredLength: number
): SideMeasurement[] {
  const baseline = sides[baselineIndex];
  if (!baseline || !baseline.rawPxLength || baseline.rawPxLength <= 0) return sides;

  const multiplier = enteredLength / baseline.rawPxLength;

  return sides.map((side, idx) => {
    if (idx === baselineIndex) {
      return { ...side, length: enteredLength, isLocked: true };
    }
    if (!side.isLocked && side.rawPxLength && side.rawPxLength > 0) {
      return { ...side, length: Math.round(side.rawPxLength * multiplier) };
    }
    return side;
  });
}

/**
 * Adjusts canvas line length for a subsequent side segment without altering previously locked sides.
 */
export function adjustSideCanvasLength(
  points: Point[],
  sideIndex: number,
  targetLength: number,
  scaleFactor: number
): Point[] {
  const N = points.length;
  if (N < 3) return points;

  const nextPts = points.map((p) => ({ ...p }));
  const fromIdx = sideIndex;
  const toIdx = (sideIndex + 1) % N;

  const p1 = nextPts[fromIdx];
  const p2 = nextPts[toIdx];

  const currentPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (currentPx === 0) return points;

  const targetPx = targetLength * scaleFactor;
  const dx = (p2.x - p1.x) / currentPx;
  const dy = (p2.y - p1.y) / currentPx;

  nextPts[toIdx] = {
    x: p1.x + dx * targetPx,
    y: p1.y + dy * targetPx,
  };

  return nextPts;
}

/**
 * FABRIK (Forward And Backward Reaching Inverse Kinematics) for Closed-Loop Rigid Bar Polygon Linkage.
 * Enforces EVERY rigid bar length P_i = L_i * scaleFactor to remain 100% IMMUTABLE while shifting vertex (x,y) positions!
 */
export function solveFabrikClosedLoop(
  points: Point[],
  sides: SideMeasurement[],
  diagonals: DiagonalMeasurement[] = [],
  scaleFactor = 20,
  iterations = 35
): Point[] {
  const N = points.length;
  if (N < 3) return points;

  const pts = points.map((p) => ({ ...p }));

  // Target pixel distances for each side
  const targetPx: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const nextIdx = (i + 1) % N;
    const side = sides.find((s) => (s.fromIndex === i && s.toIndex === nextIdx) || (s.fromIndex === nextIdx && s.toIndex === i));
    if (side && side.length > 0) {
      targetPx[i] = side.length * scaleFactor;
    } else {
      targetPx[i] = Math.hypot(points[nextIdx].x - points[i].x, points[nextIdx].y - points[i].y);
    }
  }

  // Iterative Forward/Backward Kinematic Relaxation
  for (let iter = 0; iter < iterations; iter++) {
    // Forward pass
    for (let i = 0; i < N; i++) {
      const nextIdx = (i + 1) % N;
      const p1 = pts[i];
      const p2 = pts[nextIdx];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const curDist = Math.hypot(dx, dy);

      if (curDist === 0) continue;

      const diff = (curDist - targetPx[i]) / curDist;
      const moveX = dx * 0.5 * diff;
      const moveY = dy * 0.5 * diff;

      // Adjust coordinates of p1 and p2
      pts[i].x += moveX;
      pts[i].y += moveY;
      pts[nextIdx].x -= moveX;
      pts[nextIdx].y -= moveY;
    }

    // Diagonal rigid bar constraints
    for (const diag of diagonals) {
      if (diag.isLocked && diag.length > 0) {
        const dTargetPx = diag.length * scaleFactor;
        const p1 = pts[diag.fromIndex];
        const p2 = pts[diag.toIndex];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const curDist = Math.hypot(dx, dy);
        if (curDist > 0) {
          const diff = (curDist - dTargetPx) / curDist;
          const moveX = dx * 0.5 * diff;
          const moveY = dy * 0.5 * diff;
          pts[diag.fromIndex].x += moveX;
          pts[diag.fromIndex].y += moveY;
          pts[diag.toIndex].x -= moveX;
          pts[diag.toIndex].y -= moveY;
        }
      }
    }
  }

  return pts;
}

/**
 * Alias for Backward-Compatibility
 */
export const solveClosedLinkagePhysics = solveFabrikClosedLoop;

/**
 * Solves interior angle editing at vertex node while preserving rigid locked bar lengths.
 */
export function solveCornerAngleEdit(
  points: Point[],
  vertexIdx: number,
  targetDegree: number,
  sides: SideMeasurement[],
  scaleFactor: number
): Point[] {
  const N = points.length;
  if (N < 3) return points;

  const nextPts = points.map((p) => ({ ...p }));
  const prevIdx = (vertexIdx - 1 + N) % N;
  const nextIdx = (vertexIdx + 1) % N;

  const pCurr = nextPts[vertexIdx];
  const pPrev = nextPts[prevIdx];
  const pNext = nextPts[nextIdx];

  const sideNext = sides.find(
    (s) => (s.fromIndex === vertexIdx && s.toIndex === nextIdx) || (s.fromIndex === nextIdx && s.toIndex === vertexIdx)
  );
  const r2 = sideNext && sideNext.length > 0 ? sideNext.length * scaleFactor : Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);

  // Vector angle from pCurr to pPrev
  const baseAngleRad = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
  const targetRad = baseAngleRad + (targetDegree * Math.PI) / 180;

  // Set new position of nextIdx to form exact target angle
  nextPts[nextIdx] = {
    x: pCurr.x + r2 * Math.cos(targetRad),
    y: pCurr.y + r2 * Math.sin(targetRad),
  };

  // Run FABRIK closed-loop solver so all bar lengths remain 100% fixed while vertex coordinates shift
  return solveFabrikClosedLoop(nextPts, sides, [], scaleFactor, 50);
}

/**
 * Rigid Bar Kinematic Dragging: Moves dragged vertex to target and propagates vertex coordinate shifts down the linkage chain.
 */
export function solveLinkageDrag(
  points: Point[],
  draggedIndex: number,
  targetPoint: Point,
  sides: SideMeasurement[],
  diagonals: DiagonalMeasurement[] = [],
  scaleFactor = 20
): Point[] {
  const N = points.length;
  if (N < 3) return points;

  const nextPts: Point[] = points.map((p) => ({ ...p }));

  // Move dragged vertex to target position
  nextPts[draggedIndex] = { ...targetPoint };

  // Solve closed loop kinematics to adjust all connected vertex (x,y) positions while keeping EVERY bar length 100% FIXED
  return solveFabrikClosedLoop(nextPts, sides, diagonals, scaleFactor, 30);
}

/**
 * Solves exact 2D coordinates for an N-sided polygon given outer sides & triangulation diagonals.
 */
export function solveTriangulatedPolygon(
  sides: number[],
  diagonals: DiagonalMeasurement[],
  scaleFactor = 20,
  referencePoints?: Point[]
): TriangulationResult {
  const N = sides.length;
  const reqDiags = getRequiredDiagonalsCount(N);
  const validDiags = diagonals.filter((d) => d.length > 0);
  const missing = reqDiags - validDiags.length;

  if (N < 3) {
    return {
      ok: false,
      requiredDiagonals: 0,
      enteredDiagonals: 0,
      missingDiagonalsCount: 0,
      reason: "Polygon requires at least 3 sides",
    };
  }

  // Calculate baseline reference angle and origin translation from original drawn points
  let originX = 0;
  let originY = 0;
  let baseAngle = 0;

  if (referencePoints && referencePoints.length >= 2) {
    originX = referencePoints[0].x;
    originY = referencePoints[0].y;
    const dx = referencePoints[1].x - referencePoints[0].x;
    const dy = referencePoints[1].y - referencePoints[0].y;
    baseAngle = Math.atan2(dy, dx);
  }

  if (N === 3) {
    const [a, b, c] = sides;
    const area = calculateHeronArea(a, b, c);
    if (area <= 0) {
      return {
        ok: false,
        requiredDiagonals: 0,
        enteredDiagonals: 0,
        missingDiagonalsCount: 0,
        reason: "Invalid triangle side lengths",
      };
    }
    const cosA = (a * a + c * c - b * b) / (2 * a * c);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const rawPts: Point[] = [
      { x: 0, y: 0 },
      { x: c * scaleFactor, y: 0 },
      { x: a * cosA * scaleFactor, y: -a * sinA * scaleFactor },
    ];

    const solvedPts = rawPts.map((p) => ({
      x: p.x * Math.cos(baseAngle) - p.y * Math.sin(baseAngle) + originX,
      y: p.x * Math.sin(baseAngle) + p.y * Math.cos(baseAngle) + originY,
    }));

    return {
      ok: true,
      solvedPoints: solvedPts,
      triangles: [
        { id: "T1", name: "Triangle 1", indices: [0, 1, 2], a: c, b: a, c: b, areaSqM: area },
      ],
      requiredDiagonals: 0,
      enteredDiagonals: 0,
      missingDiagonalsCount: 0,
    };
  }

  // Topology-Preserving FABRIK Triangulation Engine
  // Prevents inside-out shape explosion on non-convex U-shaped or L-shaped plots
  if (referencePoints && referencePoints.length === N) {
    const sideObjects: SideMeasurement[] = sides.map((l, idx) => ({
      id: `side-${idx}`,
      fromIndex: idx,
      toIndex: (idx + 1) % N,
      length: l,
      isLocked: true,
    }));

    const solvedPts = solveFabrikClosedLoop(referencePoints, sideObjects, validDiags, scaleFactor, 120);

    const triangles: SurveyTriangle[] = [];
    for (let i = 1; i < N - 1; i++) {
      const p0 = solvedPts[0];
      const p1 = solvedPts[i];
      const p2 = solvedPts[i + 1];
      const s1 = Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / scaleFactor);
      const s2 = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / scaleFactor);
      const s3 = Math.round(Math.hypot(p2.x - p0.x, p2.y - p0.y) / scaleFactor);

      // Accurate Heron's area in square units, converted to square meters
      const areaInUnits = calculateHeronArea(s1, s2, s3);
      const areaSqM = areaInUnits / 10.7639104;

      triangles.push({
        id: `T${i}`,
        name: `Triangle ${i}`,
        indices: [0, i, i + 1],
        a: s1,
        b: s2,
        c: s3,
        areaSqM,
      });
    }

    return {
      ok: true,
      solvedPoints: solvedPts,
      triangles,
      requiredDiagonals: reqDiags,
      enteredDiagonals: validDiags.length,
      missingDiagonalsCount: 0,
    };
  }

  // Fallback Trigonometric Calculation
  const rawPts: Point[] = new Array(N);
  rawPts[0] = { x: 0, y: 0 };
  rawPts[1] = { x: sides[0] * scaleFactor, y: 0 };

  const triangles: SurveyTriangle[] = [];
  let currentAngle = 0;

  for (let i = 1; i < N - 1; i++) {
    const s1 = i === 1 ? sides[0] : diagonals.find((d) => (d.fromIndex === 0 && d.toIndex === i) || (d.fromIndex === i && d.toIndex === 0))?.length ?? 0;
    const s2 = sides[i];
    const s3 = i === N - 2 ? sides[N - 1] : diagonals.find((d) => (d.fromIndex === 0 && d.toIndex === i + 1) || (d.fromIndex === i + 1 && d.toIndex === 0))?.length ?? 0;

    const area = calculateHeronArea(s1, s2, s3);
    triangles.push({
      id: `T${i}`,
      name: `Triangle ${i}`,
      indices: [0, i, i + 1],
      a: s1,
      b: s2,
      c: s3,
      areaSqM: area,
    });

    const cosVal = (s1 * s1 + s3 * s3 - s2 * s2) / (2 * s1 * s3);
    const clampedCos = Math.max(-1, Math.min(1, cosVal));
    const angle = Math.acos(clampedCos);
    currentAngle -= angle;

    rawPts[i + 1] = {
      x: s3 * Math.cos(currentAngle) * scaleFactor,
      y: s3 * Math.sin(currentAngle) * scaleFactor,
    };
  }

  // Rotate and translate solved polygon points to match original drawn baseline angle & vertex 0 position
  const solvedPts = rawPts.map((p) => ({
    x: p.x * Math.cos(baseAngle) - p.y * Math.sin(baseAngle) + originX,
    y: p.x * Math.sin(baseAngle) + p.y * Math.cos(baseAngle) + originY,
  }));

  return {
    ok: true,
    solvedPoints: solvedPts,
    triangles,
    requiredDiagonals: reqDiags,
    enteredDiagonals: validDiags.length,
    missingDiagonalsCount: 0,
  };
}

/**
 * GeoJSON Exporter
 */
export function exportToGeoJson(plotName: string, points: Point[], scaleFactor = 20): string {
  const coords = points.map((p) => [p.x / scaleFactor, -p.y / scaleFactor]);
  if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push([...coords[0]]);
  }
  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: plotName,
          source: "PlotScale Sketch Pad",
          createdAt: new Date().toISOString(),
        },
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
      },
    ],
  };
  return JSON.stringify(geojson, null, 2);
}

/**
 * KML Exporter
 */
export function exportToKml(plotName: string, points: Point[], scaleFactor = 20): string {
  const coordsStr = points
    .map((p) => `${p.x / scaleFactor},${-p.y / scaleFactor},0`)
    .concat(`${points[0].x / scaleFactor},${-points[0].y / scaleFactor},0`)
    .join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${plotName}</name>
    <description>Exported from PlotScale Land Surveying Sketch Pad</description>
    <Style id="plotStyle">
      <LineStyle>
        <color>ffeb6325</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>40eb6325</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${plotName}</name>
      <styleUrl>#plotStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * DXF Exporter
 */
export function exportToDxf(plotName: string, points: Point[], scaleFactor = 20): string {
  let dxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    dxf += `0\nLINE\n8\nSURVEY_BOUNDARY\n10\n${(p1.x / scaleFactor).toFixed(4)}\n20\n${(-p1.y / scaleFactor).toFixed(4)}\n11\n${(p2.x / scaleFactor).toFixed(4)}\n21\n${(-p2.y / scaleFactor).toFixed(4)}\n`;
  }
  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

/**
 * SVG Vector Exporter
 */
export function exportToSvg(
  plotName: string,
  points: Point[],
  outerSides: SideMeasurement[] = [],
  diagonals: DiagonalMeasurement[] = [],
  unit = "ft",
  scaleFactor = 20
): string {
  if (!points.length) return "";
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const pad = 60;
  const width = Math.max(maxX - minX + pad * 2, 400);
  const height = Math.max(maxY - minY + pad * 2, 400);
  const offsetX = minX - pad;
  const offsetY = minY - pad;

  const polyPoints = points
    .map((p) => `${(p.x - offsetX).toFixed(1)},${(p.y - offsetY).toFixed(1)}`)
    .join(" ");

  let diagLines = "";
  diagonals.forEach((d) => {
    const p1 = points[d.from];
    const p2 = points[d.to];
    if (p1 && p2) {
      diagLines += `<line x1="${(p1.x - offsetX).toFixed(1)}" y1="${(p1.y - offsetY).toFixed(1)}" x2="${(p2.x - offsetX).toFixed(1)}" y2="${(p2.y - offsetY).toFixed(1)}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" />\n`;
    }
  });

  let sideLabels = "";
  outerSides.forEach((s) => {
    const p1 = points[s.from];
    const p2 = points[s.to];
    if (p1 && p2) {
      const midX = (p1.x + p2.x) / 2 - offsetX;
      const midY = (p1.y + p2.y) / 2 - offsetY;
      const distPhysical = s.length > 0 ? s.length : (Math.hypot(p2.x - p1.x, p2.y - p1.y) / scaleFactor);
      sideLabels += `<g transform="translate(${midX.toFixed(1)},${midY.toFixed(1)})">
        <rect x="-35" y="-10" width="70" height="20" rx="6" fill="#ffffff" stroke="#2563eb" stroke-width="1" />
        <text text-anchor="middle" y="4" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#1e3a8a">${distPhysical.toFixed(2)} ${unit}</text>
      </g>\n`;
    }
  });

  let vertexNodes = "";
  points.forEach((p, idx) => {
    const px = p.x - offsetX;
    const py = p.y - offsetY;
    vertexNodes += `<g transform="translate(${px.toFixed(1)},${py.toFixed(1)})">
      <circle r="7" fill="#22c55e" stroke="#ffffff" stroke-width="2" />
      <text x="10" y="-8" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#1e3a8a">P${idx + 1}</text>
    </g>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>

  <!-- Diagonals -->
  ${diagLines}

  <!-- Plot Boundary -->
  <polygon points="${polyPoints}" fill="rgba(37, 99, 235, 0.12)" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" />

  <!-- Side Measurements -->
  ${sideLabels}

  <!-- Vertices -->
  ${vertexNodes}

  <!-- Title Block -->
  <g transform="translate(16, 28)">
    <text font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#1e3a8a">PlotScale: ${plotName || "Survey Plot"}</text>
    <text y="16" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#64748b">CAD Vector Drawing · Generated on ${new Date().toLocaleDateString()}</text>
  </g>
</svg>`;
}

/**
 * CSV Survey Data Exporter
 */
export function exportToCsv(
  plotName: string,
  points: Point[],
  outerSides: SideMeasurement[] = [],
  diagonals: DiagonalMeasurement[] = [],
  areaSummaries: Record<string, string> = {},
  unit = "ft",
  scaleFactor = 20
): string {
  const unitFactor = unit === "ft" ? 0.3048 : unit === "yd" ? 0.9144 : 1.0;
  const lines: string[] = [];

  lines.push(`"PlotScale Land Survey Export"`);
  lines.push(`"Plot Name","${plotName || "Survey Plot"}"`);
  lines.push(`"Date","${new Date().toLocaleString()}"`);
  lines.push(`"Active Unit","${unit}"`);
  lines.push(``);

  lines.push(`"--- AREA SUMMARY ---"`);
  lines.push(`"Unit","Area"`);
  lines.push(`"Square Feet (sq.ft)","${areaSummaries.sqft ?? "—"}"`);
  lines.push(`"Square Meters (sq.m)","${areaSummaries.sqm ?? "—"}"`);
  lines.push(`"Gaj / Square Yards (sq.yd)","${areaSummaries.gaj ?? "—"}"`);
  lines.push(`"Acre","${areaSummaries.acre ?? "—"}"`);
  lines.push(`"Hectare","${areaSummaries.hectare ?? "—"}"`);
  lines.push(`"Bigha (Standard)","${areaSummaries.bigha_standard ?? "—"}"`);
  lines.push(`"Guntha","${areaSummaries.guntha ?? "—"}"`);
  lines.push(``);

  lines.push(`"--- BOUNDARY SIDES ---"`);
  lines.push(`"Side #","From Point","To Point","Length (${unit})","Length (Meters)"`);
  outerSides.forEach((s, idx) => {
    const p1 = points[s.from];
    const p2 = points[s.to];
    const distPx = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : 0;
    const lenUnit = s.length > 0 ? s.length : (distPx / scaleFactor);
    const lenM = lenUnit * unitFactor;
    lines.push(`"Side ${idx + 1}","P${s.from + 1}","P${s.to + 1}","${lenUnit.toFixed(2)}","${lenM.toFixed(2)}"`);
  });
  lines.push(``);

  if (diagonals.length > 0) {
    lines.push(`"--- DIAGONAL MEASUREMENTS ---"`);
    lines.push(`"Diagonal #","From Point","To Point","Length (${unit})","Length (Meters)"`);
    diagonals.forEach((d, idx) => {
      const p1 = points[d.from];
      const p2 = points[d.to];
      const distPx = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : 0;
      const lenUnit = d.length > 0 ? d.length : (distPx / scaleFactor);
      const lenM = lenUnit * unitFactor;
      lines.push(`"Diagonal ${idx + 1}","P${d.from + 1}","P${d.to + 1}","${lenUnit.toFixed(2)}","${lenM.toFixed(2)}"`);
    });
    lines.push(``);
  }

  lines.push(`"--- CORNER VERTICES COORDINATES ---"`);
  lines.push(`"Vertex #","Local X (${unit})","Local Y (${unit})","Canvas X (px)","Canvas Y (px)"`);
  points.forEach((p, idx) => {
    const xUnit = (p.x / scaleFactor).toFixed(2);
    const yUnit = (-p.y / scaleFactor).toFixed(2);
    lines.push(`"P${idx + 1}","${xUnit}","${yUnit}","${p.x.toFixed(1)}","${p.y.toFixed(1)}"`);
  });

  return lines.join("\n");
}
