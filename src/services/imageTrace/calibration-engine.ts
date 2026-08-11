export type CalibrationPoint = { x: number; y: number };
export type CalibrationBox = { x: number; y: number; width: number; height: number };

export type CalibrationSample = {
  a: CalibrationPoint;
  b: CalibrationPoint;
  actual: string | number;
};

export function calibrationDistance(a: CalibrationPoint, b: CalibrationPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function averagePixelsPerUnit(lines: CalibrationSample[]) {
  const ratios = lines.flatMap((line) => {
    const actual = Number(line.actual);
    const pixels = calibrationDistance(line.a, line.b);
    return Number.isFinite(actual) && actual > 0 && pixels > 0 ? [pixels / actual] : [];
  });
  if (!ratios.length) return null;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

export function nearestCalibrationVertex(
  point: CalibrationPoint,
  vertices: CalibrationPoint[],
  radius: number,
) {
  let best: CalibrationPoint | null = null;
  let bestDistance = radius;
  for (const vertex of vertices) {
    const candidateDistance = calibrationDistance(point, vertex);
    if (candidateDistance <= bestDistance) {
      best = vertex;
      bestDistance = candidateDistance;
    }
  }
  return best ? { ...best } : { ...point };
}

export function documentBoxToRaster(
  box: CalibrationBox,
  scale: number,
  rasterWidth: number,
  rasterHeight: number,
) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const x = Math.max(0, Math.min(rasterWidth - 1, Math.floor(box.x * safeScale)));
  const y = Math.max(0, Math.min(rasterHeight - 1, Math.floor(box.y * safeScale)));
  const width = Math.max(1, Math.min(rasterWidth - x, Math.ceil(box.width * safeScale)));
  const height = Math.max(1, Math.min(rasterHeight - y, Math.ceil(box.height * safeScale)));
  return { x, y, width, height, scale: safeScale };
}
