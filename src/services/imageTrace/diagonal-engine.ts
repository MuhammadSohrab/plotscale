export type DiagonalLink = { id: string; aNodeId: string; bNodeId: string };
export type DiagonalShape = {
  nodeIds: string[];
  closed: boolean;
  diagonals: DiagonalLink[];
};

export function validateDiagonal(
  nodeIds: string[],
  closed: boolean,
  diagonals: DiagonalLink[],
  aNodeId: string,
  bNodeId: string,
): { ok: true } | { ok: false; reason: "missing" | "same_vertex" | "boundary_edge" | "duplicate" } {
  const aIndex = nodeIds.indexOf(aNodeId);
  const bIndex = nodeIds.indexOf(bNodeId);
  if (aIndex < 0 || bIndex < 0) return { ok: false, reason: "missing" };
  if (aIndex === bIndex) return { ok: false, reason: "same_vertex" };
  const indexDistance = Math.abs(aIndex - bIndex);
  if (indexDistance === 1 || closed && indexDistance === nodeIds.length - 1) {
    return { ok: false, reason: "boundary_edge" };
  }
  const duplicate = diagonals.some((diagonal) =>
    diagonal.aNodeId === aNodeId && diagonal.bNodeId === bNodeId ||
    diagonal.aNodeId === bNodeId && diagonal.bNodeId === aNodeId);
  return duplicate ? { ok: false, reason: "duplicate" } : { ok: true };
}

export function remapAndSanitizeDiagonals<T extends DiagonalShape>(
  before: DiagonalShape,
  after: T,
): T {
  const nodeMap = new Map<string, string>();
  before.nodeIds.forEach((nodeId, index) => {
    const replacement = after.nodeIds[index];
    if (replacement) nodeMap.set(nodeId, replacement);
  });
  const diagonals: DiagonalLink[] = [];
  for (const source of before.diagonals) {
    const candidate = {
      ...source,
      aNodeId: nodeMap.get(source.aNodeId) ?? source.aNodeId,
      bNodeId: nodeMap.get(source.bNodeId) ?? source.bNodeId,
    };
    if (validateDiagonal(after.nodeIds, after.closed, diagonals, candidate.aNodeId, candidate.bNodeId).ok) {
      diagonals.push(candidate);
    }
  }
  return { ...after, diagonals };
}

export function sanitizeDiagonals<T extends DiagonalShape>(shape: T): T {
  return remapAndSanitizeDiagonals(shape, shape);
}
