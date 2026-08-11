// ===== GEOMETRY ENGINE v2 =====

export function triangleAreaBySides(a, b, c) {
  const s = (a + b + c) / 2;
  const val = s * (s - a) * (s - b) * (s - c);
  return val > 0 ? Math.sqrt(val) : 0;
}

export function polygonAreaShoelace(vertices) {
  const n = vertices.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

export function isValidTriangle(a, b, c) {
  return a + b > c && b + c > a && a + c > b;
}

export function isDiagonalValid(sides, diagonalLength) {
  if (sides.length < 4) return true;
  const [a, b, c, d] = sides;
  const diag = diagonalLength;
  return isValidTriangle(a, diag, d) && isValidTriangle(b, c, diag);
}

export function quadAreaWithDiagonal(sides, diagonal) {
  const [a, b, c, d] = sides;
  const area1 = triangleAreaBySides(a, diagonal, d);
  const area2 = triangleAreaBySides(b, c, diagonal);
  return area1 + area2;
}

export function regularPolygonArea(n, sideLength) {
  return (n * sideLength * sideLength) / (4 * Math.tan(Math.PI / n));
}

export function triangleArea(a, b, c) {
  return triangleAreaBySides(a, b, c);
}

export function angleAtVertex(sideA, sideB, diagonal) {
  const cosB = (sideA * sideA + sideB * sideB - diagonal * diagonal) / (2 * sideA * sideB);
  const clamped = Math.max(-1, Math.min(1, cosB));
  return Math.acos(clamped) * (180 / Math.PI);
}

function buildTriangleVertices(a, b, c) {
  if (!isValidTriangle(a, b, c)) return [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a / 2, y: 1 }];
  const cosAngle = (a * a + c * c - b * b) / (2 * a * c);
  const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle));
  return [
    { x: 0, y: 0 },
    { x: a, y: 0 },
    { x: c * cosAngle, y: c * sinAngle },
  ];
}

export function buildQuadWithDiagonal(sides, diagonal) {
  const [a, b, c, d] = sides;
  const v0 = { x: 0, y: 0 };
  const v1 = { x: a, y: 0 };

  const int1 = circleCircleIntersect(v0.x, v0.y, d, v1.x, v1.y, diagonal);
  let v3;
  if (int1.length === 0) {
    v3 = { x: 0, y: d };
  } else {
    v3 = int1.find(p => p.y >= 0) || int1[0];
  }

  const int2 = circleCircleIntersect(v1.x, v1.y, b, v3.x, v3.y, c);
  let v2;
  if (int2.length === 0) {
    v2 = { x: v1.x, y: v3.y };
  } else {
    v2 = int2.find(p => p.y >= 0) || int2[0];
  }

  return [v0, v1, v2, v3];
}

export function buildVerticesSimple(sides) {
  const n = sides.length;
  if (n === 3) return buildTriangleVertices(sides[0], sides[1], sides[2]);
  if (n === 4) {
    return buildQuadApproximate(sides);
  }
  const defaultInterior = ((n - 2) * 180) / n;
  const defaultAngles = Array(n - 1).fill(defaultInterior);
  return buildVerticesFromSidesAngles(sides, defaultAngles);
}

function buildQuadApproximate(sides) {
  const [a, b, c, d] = sides;
  const v0 = { x: 0, y: 0 };
  const v1 = { x: a, y: 0 };
  const v2 = { x: a, y: b };
  const v3approx = { x: 0, y: d };
  return [v0, v1, v2, v3approx];
}

export function buildVerticesFromSidesAngles(sides, angles) {
  const vertices = [{ x: 0, y: 0 }];
  let currentAngle = 0;
  for (let i = 0; i < sides.length - 1; i++) {
    const last = vertices[vertices.length - 1];
    vertices.push({
      x: last.x + sides[i] * Math.cos(currentAngle),
      y: last.y + sides[i] * Math.sin(currentAngle),
    });
    const interiorRad = (angles[i] * Math.PI) / 180;
    currentAngle += Math.PI - interiorRad;
  }
  return vertices;
}

export function computeAnglesFromVertices(vertices) {
  const n = vertices.length;
  return vertices.map((v, i) => {
    const prev = vertices[(i - 1 + n) % n];
    const next = vertices[(i + 1) % n];
    const ax = prev.x - v.x; const ay = prev.y - v.y;
    const bx = next.x - v.x; const by = next.y - v.y;
    const dot = ax * bx + ay * by;
    const cross = ax * by - ay * bx;
    const angle = Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);
    return Math.round(angle * 10) / 10;
  });
}

export function computeDiagonalsFromVertices(vertices) {
  const n = vertices.length;
  const diagonals = [];
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const dx = vertices[j].x - vertices[i].x;
      const dy = vertices[j].y - vertices[i].y;
      diagonals.push({ from: i, to: j, length: Math.hypot(dx, dy) });
    }
  }
  return diagonals;
}

export function calculateAreaSimple(sides) {
  const n = sides.length;
  if (n === 3) return triangleAreaBySides(sides[0], sides[1], sides[2]);
  const verts = buildVerticesSimple(sides);
  return polygonAreaShoelace(verts);
}

export function calculateAreaWithDiagonal(sides, diagonal) {
  return quadAreaWithDiagonal(sides, diagonal);
}

export function fitVerticesToCanvas(vertices, width, height, padding = 40) {
  if (!vertices || vertices.length === 0) return [];
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const polyW = maxX - minX || 1;
  const polyH = maxY - minY || 1;
  const scaleX = (width - 2 * padding) / polyW;
  const scaleY = (height - 2 * padding) / polyH;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - polyW * scale) / 2 - minX * scale;
  const offsetY = (height - polyH * scale) / 2 - minY * scale;
  return vertices.map(v => ({
    x: v.x * scale + offsetX,
    y: v.y * scale + offsetY,
  }));
}

export function constrainedDrag(nodes, dragIdx, mouseX, mouseY, pixelSides) {
  const n = nodes.length;
  const prevIdx = (dragIdx - 1 + n) % n;
  const nextIdx = (dragIdx + 1) % n;
  const P = nodes[prevIdx];
  const N = nodes[nextIdx];
  const lenPrev = pixelSides[prevIdx];
  const lenNext = pixelSides[dragIdx];
  const intersections = circleCircleIntersect(P.x, P.y, lenPrev, N.x, N.y, lenNext);
  if (intersections.length === 0) {
    const angle = Math.atan2(mouseY - P.y, mouseX - P.x);
    return { x: P.x + lenPrev * Math.cos(angle), y: P.y + lenPrev * Math.sin(angle) };
  }
  if (intersections.length === 1) return intersections[0];
  const d0 = Math.hypot(intersections[0].x - mouseX, intersections[0].y - mouseY);
  const d1 = Math.hypot(intersections[1].x - mouseX, intersections[1].y - mouseY);
  return d0 < d1 ? intersections[0] : intersections[1];
}

function circleCircleIntersect(x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0; const dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d > r0 + r1 + 0.001 || d < Math.abs(r0 - r1) - 0.001 || d < 0.001) return [];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h2 = r0 * r0 - a * a;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const mx = x0 + (a * dx) / d;
  const my = y0 + (a * dy) / d;
  if (h < 0.001) return [{ x: mx, y: my }];
  return [
    { x: mx + (h * dy) / d, y: my - (h * dx) / d },
    { x: mx - (h * dy) / d, y: my + (h * dx) / d },
  ];
}

export function computePixelSides(nodes) {
  return nodes.map((node, i) => {
    const next = nodes[(i + 1) % nodes.length];
    return Math.hypot(next.x - node.x, next.y - node.y);
  });
}

export function getCentroid(vertices) {
  const n = vertices.length;
  const cx = vertices.reduce((s, v) => s + v.x, 0) / n;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / n;
  return { x: cx, y: cy };
}

export function computeAreaRatio(origVertices, newNodes, canvasSize) {
  const fitted = fitVerticesToCanvas(origVertices, canvasSize.w, canvasSize.h, 60);
  const origArea = polygonAreaShoelace(fitted);
  const newArea = polygonAreaShoelace(newNodes);
  return origArea > 0 ? newArea / origArea : 1;
}
