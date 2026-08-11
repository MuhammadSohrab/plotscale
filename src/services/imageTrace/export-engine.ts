export type ExportPoint = { x: number; y: number };
export type ExportDiagonal = { aNodeId: string; bNodeId: string };
export type ExportShape = {
  points: ExportPoint[];
  nodeIds: string[];
  closed: boolean;
  color: string;
  diagonals: ExportDiagonal[];
};

function number(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : "0";
}

function diagonalSegments(shape: ExportShape) {
  return shape.diagonals.flatMap((diagonal) => {
    const aIndex = shape.nodeIds.indexOf(diagonal.aNodeId);
    const bIndex = shape.nodeIds.indexOf(diagonal.bNodeId);
    if (aIndex < 0 || bIndex < 0) return [];
    return [{ a: shape.points[aIndex], b: shape.points[bIndex] }];
  });
}

export function buildSvgExport(shapes: ExportShape[], width: number, height: number) {
  const geometry = shapes.flatMap((shape) => [
    `<path d="M ${shape.points.map((point) => `${number(point.x)} ${number(point.y)}`).join(" L ")}${shape.closed ? " Z" : ""}" fill="none" stroke="${shape.color}"/>`,
    ...diagonalSegments(shape).map((diagonal) =>
      `<line x1="${number(diagonal.a.x)}" y1="${number(diagonal.a.y)}" x2="${number(diagonal.b.x)}" y2="${number(diagonal.b.y)}" stroke="${shape.color}"/>`),
  ]).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${number(width)} ${number(height)}">\n${geometry}\n</svg>`;
}

export function buildDxfExport(shapes: ExportShape[], documentHeight: number, pixelsPerUnit: number) {
  const scale = Number.isFinite(pixelsPerUnit) && pixelsPerUnit > 0 ? pixelsPerUnit : 1;
  const geometry = shapes.flatMap((shape) => [
    `0\nLWPOLYLINE\n90\n${shape.points.length}\n70\n${shape.closed ? 1 : 0}\n${shape.points.map((point) =>
      `10\n${number(point.x / scale)}\n20\n${number((documentHeight - point.y) / scale)}`).join("\n")}`,
    ...diagonalSegments(shape).map((diagonal) =>
      `0\nLINE\n8\nDIAGONALS\n10\n${number(diagonal.a.x / scale)}\n20\n${number((documentHeight - diagonal.a.y) / scale)}\n11\n${number(diagonal.b.x / scale)}\n21\n${number((documentHeight - diagonal.b.y) / scale)}`),
  ]).join("\n");
  return `0\nSECTION\n2\nENTITIES\n${geometry}\n0\nENDSEC\n0\nEOF`;
}
