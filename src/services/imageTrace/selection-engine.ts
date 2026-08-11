import { pointInPolygon, polygonArea } from "./geometry-engine";

export type SelectionPoint = { x: number; y: number };

export type SelectableShape = {
  id: string;
  points: SelectionPoint[];
  closed: boolean;
  visible?: boolean;
};

export { pointInPolygon } from "./geometry-engine";

export function pickContainingShape<T extends SelectableShape>(point: SelectionPoint, shapes: T[]) {
  return shapes
    .filter((shape) => shape.closed && shape.visible !== false && pointInPolygon(point, shape.points))
    .map((shape, index) => ({ shape, area: polygonArea(shape.points), index }))
    .sort((first, second) => first.area - second.area || second.index - first.index)[0]?.shape ?? null;
}

export function updateSelection(
  selectedIds: string[],
  targetId: string | null,
  toggle: boolean,
) {
  if (!targetId) return toggle ? selectedIds : [];
  if (!toggle) return [targetId];
  if (selectedIds.includes(targetId)) return selectedIds.filter((id) => id !== targetId);
  return [...selectedIds, targetId];
}

export function removeSelectionId(selectedIds: string[], removedId: string) {
  return selectedIds.filter((id) => id !== removedId);
}
