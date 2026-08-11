export type GeometryPoint = { x: number; y: number };

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: GeometryPoint, b: GeometryPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function segmentProjection(point: GeometryPoint, a: GeometryPoint, b: GeometryPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator
    ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator, 0, 1)
    : 0;
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, t };
}

export function polygonArea(points: GeometryPoint[]) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

export function pointInPolygon(point: GeometryPoint, polygon: GeometryPoint[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const prior = polygon[previous];
    const denominator = Math.abs(prior.y - current.y) < 1e-9 ? 1e-9 : prior.y - current.y;
    if (
      (current.y > point.y) !== (prior.y > point.y) &&
      point.x < ((prior.x - current.x) * (point.y - current.y)) / denominator + current.x
    ) inside = !inside;
  }
  return inside;
}
