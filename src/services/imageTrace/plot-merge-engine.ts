import { polygonArea } from "./geometry-engine";

export type MergePoint = { x: number; y: number };

export type MergeShape = {
  id: string;
  points: MergePoint[];
  nodeIds: string[];
  closed: boolean;
};

export type PlotMergeResult =
  | { ok: true; points: MergePoint[]; nodeIds: string[]; removedSharedEdges: number }
  | { ok: false; reason: "need_multiple" | "open_shape" | "not_adjacent" | "invalid_boundary" };

type BoundaryEdge = {
  aKey: string;
  bKey: string;
  a: MergePoint;
  b: MergePoint;
  aNodeId: string;
  bNodeId: string;
  shapeId: string;
};

const coordinateKey = (point: MergePoint) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
const edgeKey = (aKey: string, bKey: string) => aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;

function connectedShapeCount(shapeIds: string[], sharedGroups: BoundaryEdge[][]) {
  const neighbors = new Map(shapeIds.map((id) => [id, new Set<string>()]));
  sharedGroups.forEach((group) => {
    const members = [...new Set(group.map((edge) => edge.shapeId))];
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        neighbors.get(members[i])?.add(members[j]);
        neighbors.get(members[j])?.add(members[i]);
      }
    }
  });
  const visited = new Set<string>();
  const queue = shapeIds.length ? [shapeIds[0]] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    neighbors.get(id)?.forEach((neighbor) => queue.push(neighbor));
  }
  return visited.size;
}

export function mergeAdjacentPlots(shapes: MergeShape[]): PlotMergeResult {
  if (shapes.length < 2) return { ok: false, reason: "need_multiple" };
  if (shapes.some((shape) => !shape.closed || shape.points.length < 3 || shape.nodeIds.length !== shape.points.length)) {
    return { ok: false, reason: "open_shape" };
  }

  const grouped = new Map<string, BoundaryEdge[]>();
  const pointByKey = new Map<string, MergePoint>();
  const nodeIdByKey = new Map<string, string>();
  for (const shape of shapes) {
    for (let index = 0; index < shape.points.length; index += 1) {
      const next = (index + 1) % shape.points.length;
      const a = shape.points[index];
      const b = shape.points[next];
      const aKey = coordinateKey(a);
      const bKey = coordinateKey(b);
      if (aKey === bKey) continue;
      pointByKey.set(aKey, a);
      pointByKey.set(bKey, b);
      if (!nodeIdByKey.has(aKey)) nodeIdByKey.set(aKey, shape.nodeIds[index]);
      if (!nodeIdByKey.has(bKey)) nodeIdByKey.set(bKey, shape.nodeIds[next]);
      const key = edgeKey(aKey, bKey);
      const edges = grouped.get(key) ?? [];
      edges.push({ aKey, bKey, a, b, aNodeId: shape.nodeIds[index], bNodeId: shape.nodeIds[next], shapeId: shape.id });
      grouped.set(key, edges);
    }
  }

  const sharedGroups = [...grouped.values()].filter((group) => group.length === 2 && group[0].shapeId !== group[1].shapeId);
  if (!sharedGroups.length || connectedShapeCount(shapes.map((shape) => shape.id), sharedGroups) !== shapes.length) {
    return { ok: false, reason: "not_adjacent" };
  }
  if ([...grouped.values()].some((group) => group.length > 2)) return { ok: false, reason: "invalid_boundary" };

  const boundary = [...grouped.values()].filter((group) => group.length === 1).map((group) => group[0]);
  const adjacency = new Map<string, number[]>();
  boundary.forEach((edge, index) => {
    adjacency.set(edge.aKey, [...(adjacency.get(edge.aKey) ?? []), index]);
    adjacency.set(edge.bKey, [...(adjacency.get(edge.bKey) ?? []), index]);
  });
  if (!boundary.length || [...adjacency.values()].some((edges) => edges.length !== 2)) {
    return { ok: false, reason: "invalid_boundary" };
  }

  const startKey = [...adjacency.keys()].sort()[0];
  const used = new Set<number>();
  const orderedKeys = [startKey];
  let currentKey = startKey;
  while (used.size < boundary.length) {
    const nextEdgeIndex = adjacency.get(currentKey)?.find((index) => !used.has(index));
    if (nextEdgeIndex === undefined) return { ok: false, reason: "invalid_boundary" };
    used.add(nextEdgeIndex);
    const edge = boundary[nextEdgeIndex];
    const nextKey = edge.aKey === currentKey ? edge.bKey : edge.aKey;
    if (nextKey === startKey) break;
    orderedKeys.push(nextKey);
    currentKey = nextKey;
  }
  if (used.size !== boundary.length || orderedKeys.length < 3) return { ok: false, reason: "invalid_boundary" };

  const points = orderedKeys.map((key) => pointByKey.get(key)!);
  const nodeIds = orderedKeys.map((key) => nodeIdByKey.get(key)!);
  const expectedArea = shapes.reduce((sum, shape) => sum + polygonArea(shape.points), 0);
  const mergedArea = polygonArea(points);
  if (!Number.isFinite(mergedArea) || mergedArea <= 1e-6 || Math.abs(mergedArea - expectedArea) > Math.max(1, expectedArea * 0.01)) {
    return { ok: false, reason: "invalid_boundary" };
  }
  return { ok: true, points, nodeIds, removedSharedEdges: sharedGroups.length };
}
