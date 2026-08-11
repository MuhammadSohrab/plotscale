import { distance, polygonArea, segmentProjection } from "./geometry-engine";

export type TopologyPoint = { x: number; y: number };

export type TopologyShape = {
  id: string;
  points: TopologyPoint[];
  nodeIds?: string[];
  closed: boolean;
};

export type TopologyMember = {
  shapeId: string;
  index: number;
};

export type TopologyNode = {
  id: string;
  point: TopologyPoint;
  members: TopologyMember[];
};

export type TopologyEdge = {
  id: string;
  aNodeId: string;
  bNodeId: string;
  members: TopologyMember[];
};

export type TopologyState = {
  nodes: Map<string, TopologyNode>;
  edges: Map<string, TopologyEdge>;
};

export type TopologySpatialIndex = {
  cellSize: number;
  state: TopologyState;
  nodeBuckets: Map<string, Set<string>>;
  edgeBuckets: Map<string, Set<string>>;
};

export type TopologySnap =
  | { kind: "vertex"; point: TopologyPoint; nodeId: string; distance: number }
  | {
      kind: "edge";
      point: TopologyPoint;
      edgeId: string;
      aNodeId: string;
      bNodeId: string;
      distance: number;
    };

export type ReconcileOptions = {
  tolerance?: number;
  angleToleranceDegrees?: number;
  maximumAreaChange?: number;
  maximumPerimeterChange?: number;
};

export type ReconcileResult<T extends TopologyShape> = {
  shapes: Array<T & { nodeIds: string[] }>;
  added: Array<T & { nodeIds: string[] }>;
  linkedEdges: number;
  conflicts: number;
};

export type TopologyMutationResult<T extends TopologyShape> =
  | { ok: true; shapes: Array<T & { nodeIds: string[] }>; nodeId: string }
  | { ok: false; shapes: Array<T & { nodeIds: string[] }>; reason: "missing" | "no_candidate" | "invalid_geometry" };

const EPSILON = 1e-6;

function perimeter(shape: TopologyShape) {
  let total = 0;
  for (let index = 0; index < shape.points.length - 1; index += 1) {
    total += distance(shape.points[index], shape.points[index + 1]);
  }
  if (shape.closed && shape.points.length > 2) total += distance(shape.points.at(-1)!, shape.points[0]);
  return total;
}

function orientation(a: TopologyPoint, b: TopologyPoint, c: TopologyPoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function properIntersection(a: TopologyPoint, b: TopologyPoint, c: TopologyPoint, d: TopologyPoint) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < -EPSILON && cdA * cdB < -EPSILON;
}

function hasSelfIntersection(points: TopologyPoint[], closed: boolean) {
  const count = closed ? points.length : points.length - 1;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (closed && first === 0 && secondNext === 0)
      ) continue;
      if (properIntersection(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

function validShape(shape: TopologyShape) {
  if (shape.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  if (shape.points.some((point, index) => index > 0 && distance(point, shape.points[index - 1]) <= EPSILON)) return false;
  if (shape.closed && (shape.points.length < 3 || polygonArea(shape.points) <= EPSILON)) return false;
  return !hasSelfIntersection(shape.points, shape.closed);
}

function edgeKey(aNodeId: string, bNodeId: string) {
  return aNodeId < bNodeId ? `${aNodeId}|${bNodeId}` : `${bNodeId}|${aNodeId}`;
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function addToBucket(buckets: Map<string, Set<string>>, key: string, id: string) {
  const bucket = buckets.get(key);
  if (bucket) bucket.add(id);
  else buckets.set(key, new Set([id]));
}

function spatialIndexFromState(state: TopologyState, cellSize: number): TopologySpatialIndex {
  const nodeBuckets = new Map<string, Set<string>>();
  const edgeBuckets = new Map<string, Set<string>>();
  for (const node of state.nodes.values()) {
    addToBucket(
      nodeBuckets,
      cellKey(Math.floor(node.point.x / cellSize), Math.floor(node.point.y / cellSize)),
      node.id,
    );
  }
  for (const edge of state.edges.values()) {
    const a = state.nodes.get(edge.aNodeId)?.point;
    const b = state.nodes.get(edge.bNodeId)?.point;
    if (!a || !b) continue;
    const minX = Math.floor(Math.min(a.x, b.x) / cellSize);
    const maxX = Math.floor(Math.max(a.x, b.x) / cellSize);
    const minY = Math.floor(Math.min(a.y, b.y) / cellSize);
    const maxY = Math.floor(Math.max(a.y, b.y) / cellSize);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) addToBucket(edgeBuckets, cellKey(x, y), edge.id);
    }
  }
  return { cellSize, state, nodeBuckets, edgeBuckets };
}

function queryBuckets(index: TopologySpatialIndex, point: TopologyPoint, radius: number) {
  const minX = Math.floor((point.x - radius) / index.cellSize);
  const maxX = Math.floor((point.x + radius) / index.cellSize);
  const minY = Math.floor((point.y - radius) / index.cellSize);
  const maxY = Math.floor((point.y + radius) / index.cellSize);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const key = cellKey(x, y);
      index.nodeBuckets.get(key)?.forEach((id) => nodeIds.add(id));
      index.edgeBuckets.get(key)?.forEach((id) => edgeIds.add(id));
    }
  }
  return { nodeIds, edgeIds };
}

function cloneShape<T extends TopologyShape>(shape: T): T & { nodeIds: string[] } {
  return {
    ...shape,
    points: shape.points.map((point) => ({ ...point })),
    nodeIds: shape.points.map((_, index) => shape.nodeIds?.[index] ?? `${shape.id}:node:${index}`),
  };
}

export function ensureTopology<T extends TopologyShape>(shapes: T[]) {
  const cloned = shapes.map(cloneShape);
  const canonical: Array<{ id: string; point: TopologyPoint }> = [];
  for (const shape of cloned) {
    shape.points.forEach((point, index) => {
      const match = canonical.find((candidate) => distance(candidate.point, point) <= 0.01);
      if (match) shape.nodeIds[index] = match.id;
      else canonical.push({ id: shape.nodeIds[index], point });
    });
  }
  return cloned;
}

export function buildTopologyState(shapes: TopologyShape[]): TopologyState {
  const normalized = ensureTopology(shapes);
  const nodes = new Map<string, TopologyNode>();
  const edges = new Map<string, TopologyEdge>();

  for (const shape of normalized) {
    shape.points.forEach((point, index) => {
      const nodeId = shape.nodeIds[index];
      const node = nodes.get(nodeId);
      if (node) node.members.push({ shapeId: shape.id, index });
      else nodes.set(nodeId, { id: nodeId, point: { ...point }, members: [{ shapeId: shape.id, index }] });
    });

    const segmentCount = shape.closed ? shape.points.length : Math.max(0, shape.points.length - 1);
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % shape.points.length;
      const aNodeId = shape.nodeIds[index];
      const bNodeId = shape.nodeIds[next];
      const id = edgeKey(aNodeId, bNodeId);
      const edge = edges.get(id);
      if (edge) edge.members.push({ shapeId: shape.id, index });
      else edges.set(id, { id, aNodeId, bNodeId, members: [{ shapeId: shape.id, index }] });
    }
  }

  return { nodes, edges };
}

export function buildTopologySpatialIndex(shapes: TopologyShape[], cellSize = 32) {
  return spatialIndexFromState(buildTopologyState(shapes), Math.max(4, cellSize));
}

function angleDifference(a: TopologyPoint, b: TopologyPoint, c: TopologyPoint, d: TopologyPoint) {
  const first = Math.atan2(b.y - a.y, b.x - a.x);
  const second = Math.atan2(d.y - c.y, d.x - c.x);
  let delta = Math.abs(first - second) % Math.PI;
  if (delta > Math.PI / 2) delta = Math.PI - delta;
  return delta;
}

function incidentAligns(
  points: TopologyPoint[],
  index: number,
  closed: boolean,
  a: TopologyPoint,
  b: TopologyPoint,
  toleranceRadians: number,
) {
  const previous = index > 0 ? points[index - 1] : closed ? points.at(-1) : undefined;
  const next = index < points.length - 1 ? points[index + 1] : closed ? points[0] : undefined;
  return (
    (previous && angleDifference(previous, points[index], a, b) <= toleranceRadians) ||
    (next && angleDifference(points[index], next, a, b) <= toleranceRadians)
  );
}

function splitCanonicalEdge<T extends TopologyShape>(
  shapes: Array<T & { nodeIds: string[] }>,
  aNodeId: string,
  bNodeId: string,
  point: TopologyPoint,
  nodeId: string,
) {
  const key = edgeKey(aNodeId, bNodeId);
  for (const shape of shapes) {
    const count = shape.closed ? shape.points.length : Math.max(0, shape.points.length - 1);
    for (let index = count - 1; index >= 0; index -= 1) {
      const next = (index + 1) % shape.points.length;
      if (edgeKey(shape.nodeIds[index], shape.nodeIds[next]) !== key) continue;
      if (shape.nodeIds.includes(nodeId)) continue;
      const insertAt = index === shape.points.length - 1 ? shape.points.length : index + 1;
      shape.points.splice(insertAt, 0, { ...point });
      shape.nodeIds.splice(insertAt, 0, nodeId);
    }
  }
}

function isValidReconciliation(
  before: TopologyShape,
  after: TopologyShape,
  maximumAreaChange: number,
  maximumPerimeterChange: number,
) {
  if (after.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  if (after.points.some((point, index) => distance(point, after.points[(index + 1) % after.points.length]) < 0.25)) return false;
  if (hasSelfIntersection(after.points, after.closed)) return false;
  if (before.closed) {
    const beforeArea = polygonArea(before.points);
    const afterArea = polygonArea(after.points);
    if (beforeArea < 1 || afterArea < 1 || Math.abs(afterArea - beforeArea) / beforeArea > maximumAreaChange) return false;
  }
  const beforePerimeter = perimeter(before);
  const afterPerimeter = perimeter(after);
  return beforePerimeter < 1 || Math.abs(afterPerimeter - beforePerimeter) / beforePerimeter <= maximumPerimeterChange;
}

export function reconcileIncomingShapes<T extends TopologyShape>(
  existingShapes: T[],
  incomingShapes: T[],
  options: ReconcileOptions = {},
): ReconcileResult<T> {
  const tolerance = options.tolerance ?? 10;
  const angleTolerance = (options.angleToleranceDegrees ?? 12) * Math.PI / 180;
  const maximumAreaChange = options.maximumAreaChange ?? 0.08;
  const maximumPerimeterChange = options.maximumPerimeterChange ?? 0.08;
  const working = ensureTopology(existingShapes);
  const added: Array<T & { nodeIds: string[] }> = [];
  let conflicts = 0;
  let sequence = 0;

  for (const incomingSource of incomingShapes) {
    const incoming = cloneShape(incomingSource);
    const before = cloneShape(incomingSource);
    const existingSnapshot = working.map(cloneShape);
    let state = buildTopologyState(working);
    let spatialIndex = spatialIndexFromState(state, Math.max(8, tolerance * 2));
    for (let index = 0; index < incoming.points.length; index += 1) {
      const point = incoming.points[index];
      const nearby = queryBuckets(spatialIndex, point, tolerance);
      let nearestNode: TopologyNode | null = null;
      let nearestNodeDistance = tolerance;
      for (const nodeId of nearby.nodeIds) {
        const node = state.nodes.get(nodeId);
        if (!node) continue;
        const candidateDistance = distance(point, node.point);
        if (candidateDistance <= nearestNodeDistance) {
          nearestNode = node;
          nearestNodeDistance = candidateDistance;
        }
      }
      if (nearestNode) {
        incoming.points[index] = { ...nearestNode.point };
        incoming.nodeIds[index] = nearestNode.id;
        continue;
      }

      let edgeCandidate: {
        edge: TopologyEdge;
        projected: TopologyPoint;
        distance: number;
      } | null = null;
      for (const edgeId of nearby.edgeIds) {
        const edge = state.edges.get(edgeId);
        if (!edge) continue;
        const a = state.nodes.get(edge.aNodeId)?.point;
        const b = state.nodes.get(edge.bNodeId)?.point;
        if (!a || !b || !incidentAligns(incoming.points, index, incoming.closed, a, b, angleTolerance)) continue;
        const projection = segmentProjection(point, a, b);
        const candidateDistance = distance(point, projection.point);
        if (
          projection.t > 0.001 &&
          projection.t < 0.999 &&
          candidateDistance <= tolerance &&
          (!edgeCandidate || candidateDistance < edgeCandidate.distance)
        ) {
          edgeCandidate = { edge, projected: projection.point, distance: candidateDistance };
        }
      }
      if (edgeCandidate) {
        const nodeId = `topology:${incoming.id}:${index}:${sequence++}`;
        splitCanonicalEdge(
          working,
          edgeCandidate.edge.aNodeId,
          edgeCandidate.edge.bNodeId,
          edgeCandidate.projected,
          nodeId,
        );
        incoming.points[index] = { ...edgeCandidate.projected };
        incoming.nodeIds[index] = nodeId;
        state = buildTopologyState(working);
        spatialIndex = spatialIndexFromState(state, Math.max(8, tolerance * 2));
      }
    }

    if (!isValidReconciliation(before, incoming, maximumAreaChange, maximumPerimeterChange)) {
      working.splice(0, working.length, ...existingSnapshot);
      const fallback = cloneShape(incomingSource);
      working.push(fallback);
      added.push(fallback);
      conflicts += 1;
      continue;
    }

    working.push(incoming);
    added.push(incoming);
  }

  const topology = buildTopologyState(working);
  const linkedEdges = [...topology.edges.values()].filter((edge) => edge.members.length > 1).length;
  return { shapes: working, added, linkedEdges, conflicts };
}

export function findTopologySnap(
  point: TopologyPoint,
  shapes: TopologyShape[],
  radius: number,
  options: {
    vertices?: boolean;
    edges?: boolean;
    excludeShapeId?: string;
    excludeNodeId?: string;
    spatialIndex?: TopologySpatialIndex;
  } = {},
): TopologySnap | null {
  const index = options.spatialIndex ?? buildTopologySpatialIndex(shapes, Math.max(8, radius * 2));
  const state = index.state;
  const nearby = queryBuckets(index, point, radius);
  let bestVertex: TopologySnap | null = null;
  if (options.vertices !== false) {
    for (const nodeId of nearby.nodeIds) {
      const node = state.nodes.get(nodeId);
      if (!node) continue;
      if (node.id === options.excludeNodeId) continue;
      if (options.excludeShapeId && node.members.every((member) => member.shapeId === options.excludeShapeId)) continue;
      const candidateDistance = distance(point, node.point);
      if (candidateDistance <= radius && (!bestVertex || candidateDistance < bestVertex.distance)) {
        bestVertex = { kind: "vertex", point: { ...node.point }, nodeId: node.id, distance: candidateDistance };
      }
    }
  }
  if (bestVertex) return bestVertex;

  let bestEdge: TopologySnap | null = null;
  if (options.edges !== false) {
    for (const edgeId of nearby.edgeIds) {
      const edge = state.edges.get(edgeId);
      if (!edge) continue;
      if (options.excludeShapeId && edge.members.every((member) => member.shapeId === options.excludeShapeId)) continue;
      if (edge.aNodeId === options.excludeNodeId || edge.bNodeId === options.excludeNodeId) continue;
      const a = state.nodes.get(edge.aNodeId)?.point;
      const b = state.nodes.get(edge.bNodeId)?.point;
      if (!a || !b) continue;
      const projection = segmentProjection(point, a, b);
      const candidateDistance = distance(point, projection.point);
      if (candidateDistance <= radius && (!bestEdge || candidateDistance < bestEdge.distance)) {
        bestEdge = {
          kind: "edge",
          point: projection.point,
          edgeId: edge.id,
          aNodeId: edge.aNodeId,
          bNodeId: edge.bNodeId,
          distance: candidateDistance,
        };
      }
    }
  }
  return bestEdge;
}

export function moveTopologyVertex<T extends TopologyShape>(
  shapes: T[],
  shapeId: string,
  index: number,
  point: TopologyPoint,
  linked: boolean,
  targetNodeId?: string,
) {
  const normalized = ensureTopology(shapes);
  const selected = normalized.find((shape) => shape.id === shapeId);
  const sourceNodeId = selected?.nodeIds[index];
  if (!selected || !sourceNodeId) return normalized;
  const detachedId = targetNodeId ?? `${shapeId}:detached:${index}:${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;

  return normalized.map((shape) => ({
    ...shape,
    points: shape.points.map((candidate, candidateIndex) => {
      const shouldMove = linked
        ? shape.nodeIds[candidateIndex] === sourceNodeId
        : shape.id === shapeId && candidateIndex === index;
      return shouldMove ? { ...point } : candidate;
    }),
    nodeIds: shape.nodeIds.map((nodeId, candidateIndex) => {
      const shouldMove = linked
        ? nodeId === sourceNodeId
        : shape.id === shapeId && candidateIndex === index;
      return shouldMove ? (targetNodeId ?? (linked ? sourceNodeId : detachedId)) : nodeId;
    }),
  }));
}

export function insertTopologyVertex<T extends TopologyShape>(
  shapes: T[],
  shapeId: string,
  segmentIndex: number,
  click: TopologyPoint,
) {
  const normalized = ensureTopology(shapes);
  const shape = normalized.find((candidate) => candidate.id === shapeId);
  if (!shape || shape.points.length < 2) return normalized;
  const next = (segmentIndex + 1) % shape.points.length;
  if (!shape.closed && next >= shape.points.length) return normalized;
  const projection = segmentProjection(click, shape.points[segmentIndex], shape.points[next]).point;
  const nodeId = `${shapeId}:inserted:${segmentIndex}:${Math.round(projection.x * 1000)}:${Math.round(projection.y * 1000)}`;
  splitCanonicalEdge(
    normalized,
    shape.nodeIds[segmentIndex],
    shape.nodeIds[next],
    projection,
    nodeId,
  );
  return normalized;
}

export function unlinkTopologyVertex<T extends TopologyShape>(
  shapes: T[],
  shapeId: string,
  index: number,
): TopologyMutationResult<T> {
  const normalized = ensureTopology(shapes);
  const shape = normalized.find((candidate) => candidate.id === shapeId);
  if (!shape?.nodeIds[index]) return { ok: false, shapes: normalized, reason: "missing" };
  const nodeId = `${shapeId}:unlinked:${index}:${Date.now()}`;
  const next = normalized.map((candidate) => candidate.id !== shapeId ? candidate : {
    ...candidate,
    nodeIds: candidate.nodeIds.map((id, candidateIndex) => candidateIndex === index ? nodeId : id),
  });
  return { ok: true, shapes: next, nodeId };
}

export function relinkTopologyVertex<T extends TopologyShape>(
  shapes: T[],
  shapeId: string,
  index: number,
  targetNodeId: string,
): TopologyMutationResult<T> {
  const normalized = ensureTopology(shapes);
  const state = buildTopologyState(normalized);
  const target = state.nodes.get(targetNodeId);
  const source = normalized.find((candidate) => candidate.id === shapeId);
  if (!target || !source?.nodeIds[index]) return { ok: false, shapes: normalized, reason: "missing" };
  const next = normalized.map((candidate) => candidate.id !== shapeId ? candidate : {
    ...candidate,
    points: candidate.points.map((point, candidateIndex) => candidateIndex === index ? { ...target.point } : point),
    nodeIds: candidate.nodeIds.map((id, candidateIndex) => candidateIndex === index ? targetNodeId : id),
  });
  const edited = next.find((candidate) => candidate.id === shapeId);
  if (!edited || !validShape(edited)) return { ok: false, shapes: normalized, reason: "invalid_geometry" };
  return { ok: true, shapes: next, nodeId: targetNodeId };
}

export function relinkTopologyVertexToEdge<T extends TopologyShape>(
  shapes: T[],
  shapeId: string,
  index: number,
  targetShapeId: string,
  targetSegmentIndex: number,
  click: TopologyPoint,
): TopologyMutationResult<T> {
  const normalized = ensureTopology(shapes);
  const target = normalized.find((candidate) => candidate.id === targetShapeId);
  const source = normalized.find((candidate) => candidate.id === shapeId);
  if (!target || !source?.nodeIds[index]) return { ok: false, shapes: normalized, reason: "missing" };
  const targetNext = (targetSegmentIndex + 1) % target.points.length;
  if (!target.closed && targetNext >= target.points.length) return { ok: false, shapes: normalized, reason: "missing" };
  const projection = segmentProjection(click, target.points[targetSegmentIndex], target.points[targetNext]).point;
  const nodeId = `${targetShapeId}:link:${targetSegmentIndex}:${Math.round(projection.x * 1000)}:${Math.round(projection.y * 1000)}`;
  splitCanonicalEdge(
    normalized,
    target.nodeIds[targetSegmentIndex],
    target.nodeIds[targetNext],
    projection,
    nodeId,
  );
  const linked = normalized.map((candidate) => candidate.id !== shapeId ? candidate : {
    ...candidate,
    points: candidate.points.map((point, candidateIndex) => candidateIndex === index ? { ...projection } : point),
    nodeIds: candidate.nodeIds.map((id, candidateIndex) => candidateIndex === index ? nodeId : id),
  });
  const edited = linked.find((candidate) => candidate.id === shapeId);
  if (!edited || !validShape(edited)) return { ok: false, shapes: normalized, reason: "invalid_geometry" };
  return { ok: true, shapes: linked, nodeId };
}

export function sharedVisualOffset(
  sourceShape: TopologyShape,
  segmentIndex: number,
  shapes: TopologyShape[],
  screenPixels: number,
  scale: number,
  state?: TopologyState,
) {
  const topology = state ?? buildTopologyState(shapes);
  const shape = sourceShape.nodeIds?.length === sourceShape.points.length
    ? sourceShape as TopologyShape & { nodeIds: string[] }
    : ensureTopology([sourceShape])[0];
  if (!shape || !shape.nodeIds.length) return { x: 0, y: 0, shared: false };
  const next = (segmentIndex + 1) % shape.points.length;
  const edge = topology.edges.get(edgeKey(shape.nodeIds[segmentIndex], shape.nodeIds[next]));
  if (!edge || edge.members.length < 2) return { x: 0, y: 0, shared: false };
  const members = [...edge.members].sort((first, second) => first.shapeId.localeCompare(second.shapeId));
  const memberIndex = members.findIndex((member) => member.shapeId === shape.id && member.index === segmentIndex);
  const centeredIndex = memberIndex - (members.length - 1) / 2;
  const a = topology.nodes.get(edge.aNodeId)?.point ?? shape.points[segmentIndex];
  const b = topology.nodes.get(edge.bNodeId)?.point ?? shape.points[next];
  const length = Math.max(distance(a, b), EPSILON);
  const amount = centeredIndex * screenPixels / Math.max(scale, EPSILON);
  return {
    x: -(b.y - a.y) / length * amount,
    y: (b.x - a.x) / length * amount,
    shared: true,
  };
}
