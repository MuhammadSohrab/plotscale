import { clamp } from "./geometry-engine";

export type ViewPoint = { x: number; y: number };
export type ViewTransform = { x: number; y: number; scale: number };
export type GeometryBounds = { minX: number; minY: number; maxX: number; maxY: number };

export function zoomTransformAt(
  transform: ViewTransform,
  anchor: ViewPoint,
  requestedScale: number,
  minScale: number,
  maxScale: number,
) {
  const scale = clamp(requestedScale, minScale, maxScale);
  const worldAnchor = {
    x: (anchor.x - transform.x) / transform.scale,
    y: (anchor.y - transform.y) / transform.scale,
  };
  return {
    x: anchor.x - worldAnchor.x * scale,
    y: anchor.y - worldAnchor.y * scale,
    scale,
  };
}

export function pinchTransform(
  start: ViewTransform,
  startMidpoint: ViewPoint,
  currentMidpoint: ViewPoint,
  startDistance: number,
  currentDistance: number,
  minScale: number,
  maxScale: number,
) {
  const requestedScale = start.scale * currentDistance / Math.max(startDistance, 1);
  const scale = clamp(requestedScale, minScale, maxScale);
  const anchor = {
    x: (startMidpoint.x - start.x) / start.scale,
    y: (startMidpoint.y - start.y) / start.scale,
  };
  return {
    x: currentMidpoint.x - anchor.x * scale,
    y: currentMidpoint.y - anchor.y * scale,
    scale,
  };
}

export function fitGeometryBounds(
  viewport: { width: number; height: number },
  bounds: GeometryBounds,
  minScale: number,
  maxScale: number,
  paddingRatio = 0.12,
) {
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const width = Math.max(24, bounds.maxX - bounds.minX);
  const height = Math.max(24, bounds.maxY - bounds.minY);
  const paddedWidth = width * (1 + paddingRatio * 2);
  const paddedHeight = height * (1 + paddingRatio * 2);
  const scale = clamp(
    Math.min(viewport.width / paddedWidth, viewport.height / paddedHeight),
    minScale,
    maxScale,
  );
  return {
    x: viewport.width / 2 - center.x * scale,
    y: viewport.height / 2 - center.y * scale,
    scale,
  };
}

export function boundsForPoints(points: ViewPoint[]) {
  if (!points.length) return null;
  return points.reduce<GeometryBounds>((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

export function visibleWorldBounds(
  viewport: { width: number; height: number },
  transform: ViewTransform,
  document: { width: number; height: number },
) {
  const minX = clamp(-transform.x / transform.scale, 0, document.width);
  const minY = clamp(-transform.y / transform.scale, 0, document.height);
  const maxX = clamp((viewport.width - transform.x) / transform.scale, 0, document.width);
  const maxY = clamp((viewport.height - transform.y) / transform.scale, 0, document.height);
  if (maxX <= minX || maxY <= minY) return null;
  return { minX, minY, maxX, maxY };
}
