import "./imageTrace.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BoxSelect,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileCode2,
  FileUp,
  Focus,
  ImageOff,
  Layers3,
  Link2,
  Menu,
  MousePointer2,
  PencilLine,
  Plus,
  Redo2,
  Ruler,
  ScanLine,
  Sparkles,
  Trash2,
  Undo2,
  Unlink,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { averagePixelsPerUnit, documentBoxToRaster, nearestCalibrationVertex } from "../services/imageTrace/calibration-engine";
import { remapAndSanitizeDiagonals, sanitizeDiagonals, validateDiagonal } from "../services/imageTrace/diagonal-engine";
import { buildDxfExport, buildSvgExport } from "../services/imageTrace/export-engine";
import { clamp, distance, pointInPolygon, polygonArea, segmentProjection } from "../services/imageTrace/geometry-engine";
import {
  buildTopologyState,
  buildTopologySpatialIndex,
  findTopologySnap,
  insertTopologyVertex,
  moveTopologyVertex,
  reconcileIncomingShapes,
  sharedVisualOffset,
  relinkTopologyVertex,
  relinkTopologyVertexToEdge,
  unlinkTopologyVertex,
  type TopologySnap,
} from "../services/imageTrace/topology-engine";
import { pickContainingShape, removeSelectionId, updateSelection } from "../services/imageTrace/selection-engine";
import { nearestInkCentroid, type LineSeedVectorizationResult, type SeedVectorizationResult, type VectorizationResult } from "../services/imageTrace/vector-engine";
import { boundsForPoints, fitGeometryBounds, pinchTransform, visibleWorldBounds, zoomTransformAt } from "../services/imageTrace/viewport-engine";
import { mergeAdjacentPlots } from "../services/imageTrace/plot-merge-engine";

const EMPTY_DOCUMENT_W = 1000;
const EMPTY_DOCUMENT_H = 700;
const MAX_PROCESSING_PIXELS = 16_000_000;
const MAX_WORKSPACE_SHAPES = 500;
const MIN_SCALE = 0.25;
const SNAP_RADIUS = 20;
const HISTORY_LIMIT = 100;
const SHAPE_PALETTE = ["#00ff87", "#20d9ff", "#f7ff3c", "#ff8c42", "#b6ff4a", "#b889ff", "#ff4f9a", "#4d7cff"];

function TopbarMenuPortal({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className={`${className} topbar-popover`}>{children}</div>, document.body);
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
type Transform = { x: number; y: number; scale: number };
type Tool = "select" | "pan" | "roi" | "pick" | "line-pick" | "edit" | "manual" | "diagonal" | "calibrate" | "erase-map" | "delete";
type Diagonal = { id: string; aNodeId: string; bNodeId: string };
type EraserStroke = { id: string; points: Point[]; radius: number };
type Shape = {
  id: string;
  name: string;
  source: "Auto" | "Manual" | "Tap Pick" | "Line Pick" | "Merged";
  points: Point[];
  nodeIds: string[];
  closed: boolean;
  color: string;
  visible: boolean;
  diagonals: Diagonal[];
};
type SnapKind = "RAW" | "MAP" | "VERTEX" | "EDGE";
type SmartSnapResult = { point: Point; kind: SnapKind; topology?: TopologySnap };
type SmartSnapSettings = {
  enabled: boolean;
  mapInk: boolean;
  vertices: boolean;
  edges: boolean;
  linkedEdit: "all" | "selected";
};
type SegmentSelection = { shapeId: string; index: number } | null;
type MapSource = "upload" | "none";
type DocumentRaster = {
  nativeWidth: number;
  nativeHeight: number;
  processingWidth: number;
  processingHeight: number;
  processingScale: number;
  revision: number;
};
type CalibrationMode = "auto" | "manual" | "segments" | null;
type CalibrationLine = {
  id: string;
  label: string;
  kind: "width" | "height" | "baseline" | "manual" | "segment";
  a: Point;
  b: Point;
  actual: string;
  shapeId?: string;
  segmentIndex?: number;
};
type EditorSnapshot = {
  shapes: Shape[];
  selectedIds: string[];
  selectedSegment: SegmentSelection;
  manualPoints: Point[];
  calibrationLines: CalibrationLine[];
  eraserStrokes: EraserStroke[];
  pxPerUnit: number;
  unit: "m" | "ft";
};

function normalizeBox(a: Point, b: Point): Box { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }; }
function pathLength(shape: Shape) {
  let total = 0;
  for (let i = 0; i < shape.points.length - 1; i++) total += distance(shape.points[i], shape.points[i + 1]);
  if (shape.closed && shape.points.length > 2) total += distance(shape.points.at(-1)!, shape.points[0]);
  return total;
}
function centroid(points: Point[]) {
  if (!points.length) return { x: 0, y: 0 };
  return points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
}
function segmentPairs(shape: Shape) {
  const pairs = shape.points.slice(0, -1).map((point, index) => ({ a: point, b: shape.points[index + 1], index }));
  if (shape.closed && shape.points.length > 2) pairs.push({ a: shape.points.at(-1)!, b: shape.points[0], index: shape.points.length - 1 });
  return pairs;
}
function diagonalPairs(shape: Shape) {
  return shape.diagonals.flatMap((diagonal, index) => {
    const aIndex = shape.nodeIds.indexOf(diagonal.aNodeId);
    const bIndex = shape.nodeIds.indexOf(diagonal.bNodeId);
    if (aIndex < 0 || bIndex < 0) return [];
    return [{ ...diagonal, index, a: shape.points[aIndex], b: shape.points[bIndex] }];
  });
}
function remapDiagonalNode(shapes: Shape[], shapeId: string, oldNodeId: string, newNodeId: string) {
  if (oldNodeId === newNodeId) return shapes;
  return shapes.map((shape) => shape.id !== shapeId ? shape : {
    ...shape,
    diagonals: shape.diagonals.map((diagonal) => ({
      ...diagonal,
      aNodeId: diagonal.aNodeId === oldNodeId ? newNodeId : diagonal.aNodeId,
      bNodeId: diagonal.bNodeId === oldNodeId ? newNodeId : diagonal.bNodeId,
    })),
  });
}
function shapesMatch(first: Point[], second: Point[]) {
  const firstCenter = centroid(first);
  const secondCenter = centroid(second);
  const firstArea = polygonArea(first);
  const secondArea = polygonArea(second);
  const ratio = Math.min(firstArea, secondArea) / Math.max(1, Math.max(firstArea, secondArea));
  return ratio >= 0.78 && pointInPolygon(firstCenter, second) && pointInPolygon(secondCenter, first);
}

function cloneEditorSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    shapes: snapshot.shapes.map((shape) => ({ ...shape, points: shape.points.map((point) => ({ ...point })), nodeIds: [...shape.nodeIds], diagonals: shape.diagonals.map((diagonal) => ({ ...diagonal })) })),
    selectedIds: [...snapshot.selectedIds],
    selectedSegment: snapshot.selectedSegment ? { ...snapshot.selectedSegment } : null,
    manualPoints: snapshot.manualPoints.map((point) => ({ ...point })),
    calibrationLines: snapshot.calibrationLines.map((line) => ({ ...line, a: { ...line.a }, b: { ...line.b } })),
    eraserStrokes: snapshot.eraserStrokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })),
    pxPerUnit: snapshot.pxPerUnit,
    unit: snapshot.unit,
  };
}

function paintEraserStrokes(
  context: CanvasRenderingContext2D,
  strokes: EraserStroke[],
  scale: number,
  offset: Point = { x: 0, y: 0 },
) {
  context.save();
  context.strokeStyle = "#ffffff";
  context.fillStyle = "#ffffff";
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.lineWidth = Math.max(1, stroke.radius * 2 * scale);
    const first = stroke.points[0];
    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(offset.x + first.x * scale, offset.y + first.y * scale, Math.max(.5, stroke.radius * scale), 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    context.moveTo(offset.x + first.x * scale, offset.y + first.y * scale);
    stroke.points.slice(1).forEach((point) => context.lineTo(offset.x + point.x * scale, offset.y + point.y * scale));
    context.stroke();
  }
  context.restore();
}


function ToolButton({ active, danger, label, icon, className = "", onClick }: { active?: boolean; danger?: boolean; label: string; icon: ReactNode; className?: string; onClick: () => void }) {
  return <button type="button" className={`cad-tool ${className} ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`} onClick={onClick} aria-pressed={active} title={label}><span>{icon}</span><span>{label}</span></button>;
}

export default function Home() {
  const navigate = useNavigate();
  const viewerRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ distance: number; midpoint: Point; transform: Transform } | null>(null);
  const panRef = useRef<{ pointer: Point; transform: Transform } | null>(null);
  const boxStartRef = useRef<Point | null>(null);
  const tracePressRef = useRef<{ pointerId: number; startClient: Point; raw: Point } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const vertexPressRef = useRef<{
    shapeId: string;
    index: number;
    client: Point;
    moved: boolean;
    before: EditorSnapshot;
    linked: boolean;
    sourceNodeId: string;
    snap?: SmartSnapResult;
  } | null>(null);
  const lastVertexTapRef = useRef<{ key: string; time: number } | null>(null);
  const calibrationDragRef = useRef<{ lineId: string; endpoint: "a" | "b"; before: EditorSnapshot } | null>(null);
  const lastTapRef = useRef<{ time: number; key: string; point?: Point } | null>(null);
  const hasFittedRef = useRef(false);
  const rasterLoadTokenRef = useRef(0);
  const eraserStrokeIdRef = useRef(0);
  const rasterSourceRef = useRef<CanvasImageSource | null>(null);
  const retainedBitmapRef = useRef<ImageBitmap | null>(null);
  const vectorWorkerRef = useRef<Worker | null>(null);
  const workerRequestRef = useRef(0);
  const pendingWorkerRef = useRef(new Map<number, {
    resolve: (value: VectorizationResult | SeedVectorizationResult | LineSeedVectorizationResult) => void;
    reject: (reason: Error) => void;
  }>());
  const pickPressRef = useRef<{ pointerId: number; startClient: Point; point: Point } | null>(null);
  const eraserPressRef = useRef<{ pointerId: number; before: EditorSnapshot; stroke: EraserStroke } | null>(null);
  const historyRef = useRef<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });
  const toastTimerRef = useRef<number | null>(null);
  const detectionGenerationRef = useRef(0);
  const objectListRef = useRef<HTMLDivElement>(null);
  const objectCardRefs = useRef(new Map<string, HTMLElement>());
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.at(-1) ?? null;
  const setSelectedId = useCallback((value: string | null | ((current: string | null) => string | null)) => {
    setSelectedIds((current) => {
      const primary = current.at(-1) ?? null;
      const next = typeof value === "function" ? value(primary) : value;
      if (!next) return [];
      return [...current.filter((id) => id !== next), next];
    });
  }, []);
  const [selectedSegment, setSelectedSegment] = useState<SegmentSelection>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [transform, setTransform] = useState<Transform>({ x: 40, y: 40, scale: 0.8 });
  const transformRef = useRef(transform);
  const [roi, setRoi] = useState<Box | null>(null);
  const [draftBox, setDraftBox] = useState<Box | null>(null);
  const [manualPoints, setManualPoints] = useState<Point[]>([]);
  const [snapPreview, setSnapPreview] = useState<Point | null>(null);
  const [extendAnchor, setExtendAnchor] = useState<{ shapeId: string; atStart: boolean } | null>(null);
  const [magnifier, setMagnifier] = useState<{ raw: Point; snapped: Point; kind: "manual" | "vertex" } | null>(null);
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>(null);
  const [calibrationLauncherOpen, setCalibrationLauncherOpen] = useState(false);
  const [calibrationRegion, setCalibrationRegion] = useState<Box | null>(null);
  const [calibrationLines, setCalibrationLines] = useState<CalibrationLine[]>([]);
  const [draftCalibrationLine, setDraftCalibrationLine] = useState<{ a: Point; b: Point } | null>(null);
  const [calibrationClickStart, setCalibrationClickStart] = useState<Point | null>(null);
  const [pxPerUnit, setPxPerUnit] = useState(8.5);
  const [unit, setUnit] = useState<"m" | "ft">("m");
  const [processing, setProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapSource, setMapSource] = useState<MapSource>("none");
  const [mapVisible, setMapVisible] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const mapRevisionRef = useRef(0);
  const [documentRaster, setDocumentRaster] = useState<DocumentRaster>({
    nativeWidth: EMPTY_DOCUMENT_W,
    nativeHeight: EMPTY_DOCUMENT_H,
    processingWidth: EMPTY_DOCUMENT_W,
    processingHeight: EMPTY_DOCUMENT_H,
    processingScale: 1,
    revision: 0,
  });
  const [pickSeed, setPickSeed] = useState<Point | null>(null);
  const [eraserStrokes, setEraserStrokes] = useState<EraserStroke[]>([]);
  const [activeEraserStroke, setActiveEraserStroke] = useState<EraserStroke | null>(null);
  const [eraserSize, setEraserSize] = useState(28);
  const [toast, setToast] = useState<string | null>(null);
  const [verticesVisible, setVerticesVisible] = useState(true);
  const [magnifierEnabled, setMagnifierEnabled] = useState(true);
  const [detectMenuOpen, setDetectMenuOpen] = useState(false);
  const [lastDetectAction, setLastDetectAction] = useState<"auto" | "roi" | "pick" | "line-pick">("pick");
  const [roiBehavior, setRoiBehavior] = useState<"merge" | "replace">("merge");
  const [selectionMode, setSelectionMode] = useState<"single" | "multi">("single");
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [labelsMenuOpen, setLabelsMenuOpen] = useState(false);
  const [labelVisibility, setLabelVisibility] = useState<{ length: boolean; area: boolean }>({ length: true, area: true });
  const [selectedVertex, setSelectedVertex] = useState<{ shapeId: string; index: number } | null>(null);
  const [linkSource, setLinkSource] = useState<{ shapeId: string; index: number } | null>(null);
  const [diagonalStart, setDiagonalStart] = useState<{ shapeId: string; nodeId: string } | null>(null);
  const [snapMenuOpen, setSnapMenuOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [snapSettings, setSnapSettings] = useState<SmartSnapSettings>({
    enabled: true,
    mapInk: true,
    vertices: true,
    edges: true,
    linkedEdit: "all",
  });
  const [snapKind, setSnapKind] = useState<SnapKind>("RAW");
  const [historyStatus, setHistoryStatus] = useState({ undo: 0, redo: 0 });
  const [toolbarScroll, setToolbarScroll] = useState({ canLeft: false, canRight: false });
  const [maxScale, setMaxScale] = useState(64);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const DOC_W = documentRaster.nativeWidth;
  const DOC_H = documentRaster.nativeHeight;
  const topology = useMemo(() => buildTopologyState(shapes), [shapes]);
  const topologySpatialIndex = useMemo(() => buildTopologySpatialIndex(shapes, 32), [shapes]);

  useEffect(() => { transformRef.current = transform; }, [transform]);
  const updateToolbarScroll = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const maxScroll = Math.max(0, toolbar.scrollWidth - toolbar.clientWidth);
    setToolbarScroll({ canLeft: toolbar.scrollLeft > 2, canRight: toolbar.scrollLeft < maxScroll - 2 });
  }, []);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const frame = window.requestAnimationFrame(updateToolbarScroll);
    const observer = new ResizeObserver(updateToolbarScroll);
    observer.observe(toolbar);
    if (toolbar.firstElementChild) observer.observe(toolbar.firstElementChild);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [updateToolbarScroll]);
  const scrollToolbar = useCallback((direction: -1 | 1) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    toolbar.scrollBy({ left: direction * Math.max(180, toolbar.clientWidth * 0.72), behavior: "smooth" });
    window.setTimeout(updateToolbarScroll, 260);
  }, [updateToolbarScroll]);
  const handleToolbarWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (window.innerWidth <= 760 || !toolbarRef.current) return;
    const toolbar = toolbarRef.current;
    if (toolbar.scrollWidth <= toolbar.clientWidth + 2) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    toolbar.scrollLeft += delta;
    updateToolbarScroll();
  }, [updateToolbarScroll]);
  const handleToolbarKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollToolbar(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      toolbar.scrollTo({ left: event.key === "Home" ? 0 : toolbar.scrollWidth, behavior: "smooth" });
      window.setTimeout(updateToolbarScroll, 260);
    }
  }, [scrollToolbar, updateToolbarScroll]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const snapDefaults: SmartSnapSettings = {
        enabled: true,
        mapInk: true,
        vertices: true,
        edges: true,
        linkedEdit: "all",
      };
      try {
        setMagnifierEnabled(window.localStorage.getItem("vectrasurvey-precision-lens") !== "off");
        setLabelVisibility({ length: true, area: true, ...JSON.parse(window.localStorage.getItem("vectrasurvey-labels") || "{}") });
        const savedSnap = window.localStorage.getItem("vectrasurvey-smart-snap");
        setSnapSettings(savedSnap ? { ...snapDefaults, ...JSON.parse(savedSnap) as Partial<SmartSnapSettings> } : snapDefaults);
      } catch {
        setMagnifierEnabled(true);
        setLabelVisibility({ length: true, area: true });
        setSnapSettings(snapDefaults);
      }
      setMaxScale(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? 32 : 64);
      setPreferencesHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!preferencesHydrated) return;
    try { window.localStorage.setItem("vectrasurvey-smart-snap", JSON.stringify(snapSettings)); } catch { /* optional */ }
  }, [preferencesHydrated, snapSettings]);
  useEffect(() => {
    if (!preferencesHydrated) return;
    try { window.localStorage.setItem("vectrasurvey-labels", JSON.stringify(labelVisibility)); } catch { /* optional */ }
  }, [labelVisibility, preferencesHydrated]);
  useEffect(() => {
    if (!preferencesHydrated) return;
    try { window.localStorage.setItem("vectrasurvey-precision-lens", magnifierEnabled ? "on" : "off"); } catch { /* optional */ }
  }, [magnifierEnabled, preferencesHydrated]);
  const toggleMagnifier = useCallback(() => {
    if (magnifierEnabled) setMagnifier(null);
    setMagnifierEnabled((enabled) => !enabled);
  }, [magnifierEnabled]);
  const closeTopbarMenus = useCallback(() => {
    setSelectMenuOpen(false);
    setDetectMenuOpen(false);
    setSnapMenuOpen(false);
    setLabelsMenuOpen(false);
    setMobileToolsOpen(false);
  }, []);
  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".topbar-popover")) return;
      closeTopbarMenus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [closeTopbarMenus]);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, 2400);
  }, []);
  const resetTransientEditorState = useCallback(() => {
    detectionGenerationRef.current += 1;
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    pointersRef.current.clear();
    gestureRef.current = null;
    panRef.current = null;
    boxStartRef.current = null;
    tracePressRef.current = null;
    vertexPressRef.current = null;
    calibrationDragRef.current = null;
    pickPressRef.current = null;
    eraserPressRef.current = null;
    setSelectedVertex(null);
    setLinkSource(null);
    setDiagonalStart(null);
    setExtendAnchor(null);
    setSnapPreview(null);
    setMagnifier(null);
    setPickSeed(null);
    setActiveEraserStroke(null);
    setDraftBox(null);
    setDraftCalibrationLine(null);
    setCalibrationClickStart(null);
    setProcessing(false);
  }, []);
  const selectShape = useCallback((shapeId: string, toggle = false) => {
    setSelectedIds((current) => updateSelection(current, shapeId, toggle));
    setSelectedSegment(null);
    setSelectedVertex(null);
    const shape = shapes.find((candidate) => candidate.id === shapeId);
    if (shape) notify(`${shape.name} selected`);
  }, [notify, setSelectedIds, setSelectedSegment, setSelectedVertex, shapes]);
  useEffect(() => {
    if (!selectedId || !sidebarOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const list = objectListRef.current;
      const card = objectCardRefs.current.get(selectedId);
      if (!list || !card) return;
      list.scrollTo({ top: Math.max(0, card.offsetTop - list.offsetTop - 6), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, sidebarOpen]);
  const advanceRasterRevision = useCallback(() => {
    const nextRevision = mapRevisionRef.current + 1;
    mapRevisionRef.current = nextRevision;
    setMapRevision(nextRevision);
    setDocumentRaster((current) => ({ ...current, revision: nextRevision }));
  }, []);
  const captureEditorSnapshot = useCallback((): EditorSnapshot => cloneEditorSnapshot({
    shapes,
    selectedIds,
    selectedSegment,
    manualPoints,
    calibrationLines,
    eraserStrokes,
    pxPerUnit,
    unit,
  }), [calibrationLines, eraserStrokes, manualPoints, pxPerUnit, selectedIds, selectedSegment, shapes, unit]);
  const applyEditorSnapshot = useCallback((snapshot: EditorSnapshot) => {
    const restored = cloneEditorSnapshot(snapshot);
    const rasterChanged = JSON.stringify(restored.eraserStrokes) !== JSON.stringify(eraserStrokes);
    resetTransientEditorState();
    setShapes(restored.shapes);
    setSelectedIds(restored.selectedIds);
    setSelectedSegment(restored.selectedSegment);
    setManualPoints(restored.manualPoints);
    setCalibrationLines(restored.calibrationLines);
    setEraserStrokes(restored.eraserStrokes);
    setPxPerUnit(restored.pxPerUnit);
    setUnit(restored.unit);
    if (rasterChanged && mapSource !== "none") advanceRasterRevision();
  }, [advanceRasterRevision, eraserStrokes, mapSource, resetTransientEditorState]);
  const pushHistory = useCallback((before?: EditorSnapshot) => {
    const history = historyRef.current;
    history.past.push(cloneEditorSnapshot(before ?? captureEditorSnapshot()));
    if (history.past.length > HISTORY_LIMIT) history.past.splice(0, history.past.length - HISTORY_LIMIT);
    history.future = [];
    setHistoryStatus({ undo: history.past.length, redo: 0 });
  }, [captureEditorSnapshot]);
  const resetHistory = useCallback(() => {
    historyRef.current = { past: [], future: [] };
    setHistoryStatus({ undo: 0, redo: 0 });
  }, []);
  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(captureEditorSnapshot());
    applyEditorSnapshot(previous);
    setHistoryStatus({ undo: history.past.length, redo: history.future.length });
    notify("Undo applied");
  }, [applyEditorSnapshot, captureEditorSnapshot, notify]);
  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(captureEditorSnapshot());
    applyEditorSnapshot(next);
    setHistoryStatus({ undo: history.past.length, redo: history.future.length });
    notify("Redo applied");
  }, [applyEditorSnapshot, captureEditorSnapshot, notify]);
  const canUndo = historyStatus.undo > 0;
  const canRedo = historyStatus.redo > 0;

  const ensureProcessingCanvas = useCallback((width = documentRaster.processingWidth, height = documentRaster.processingHeight) => {
    if (!processingCanvasRef.current) processingCanvasRef.current = document.createElement("canvas");
    const canvas = processingCanvasRef.current;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return processingCanvasRef.current;
  }, [documentRaster.processingHeight, documentRaster.processingWidth]);

  useEffect(() => {
    const source = rasterSourceRef.current;
    if (mapSource !== "upload" || !source) return;
    const memory = ensureProcessingCanvas(documentRaster.processingWidth, documentRaster.processingHeight);
    const context = memory.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.clearRect(0, 0, documentRaster.processingWidth, documentRaster.processingHeight);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, documentRaster.processingWidth, documentRaster.processingHeight);
    context.imageSmoothingEnabled = documentRaster.processingScale < 1;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, documentRaster.processingWidth, documentRaster.processingHeight);
    paintEraserStrokes(context, eraserStrokes, documentRaster.processingScale);
  }, [documentRaster, ensureProcessingCanvas, eraserStrokes, mapRevision, mapSource]);

  const createVectorWorker = useCallback(() => {
    const worker = new Worker(new URL("../services/imageTrace/vector-worker.ts", import.meta.url), { type: "module" });
    const pendingRequests = pendingWorkerRef.current;
    worker.onmessage = (event: MessageEvent<{
      type: "result" | "error" | "raster-ready" | "raster-cleared";
      requestId?: number;
      result?: VectorizationResult | SeedVectorizationResult | LineSeedVectorizationResult;
      message?: string;
    }>) => {
      if (event.data.type === "raster-ready" || event.data.requestId === undefined) return;
      const pending = pendingRequests.get(event.data.requestId);
      if (!pending) return;
      pendingRequests.delete(event.data.requestId);
      if (event.data.type === "error") pending.reject(new Error(event.data.message || "Vector worker failed"));
      else if (event.data.result) pending.resolve(event.data.result);
    };
    worker.onerror = () => {
      pendingRequests.forEach(({ reject }) => reject(new Error("Vector worker failed")));
      pendingRequests.clear();
    };
    return worker;
  }, []);

  const restartVectorWorker = useCallback(() => {
    vectorWorkerRef.current?.terminate();
    pendingWorkerRef.current.forEach(({ reject }) => reject(new Error("Active raster changed")));
    pendingWorkerRef.current.clear();
    vectorWorkerRef.current = createVectorWorker();
  }, [createVectorWorker]);

  useEffect(() => {
    const pendingRequests = pendingWorkerRef.current;
    vectorWorkerRef.current = createVectorWorker();
    return () => {
      vectorWorkerRef.current?.terminate();
      vectorWorkerRef.current = null;
      pendingRequests.forEach(({ reject }) => reject(new Error("Vector worker stopped")));
      pendingRequests.clear();
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, [createVectorWorker]);

  const syncRasterToWorker = useCallback((revision: number) => {
    const canvas = processingCanvasRef.current;
    const worker = vectorWorkerRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !worker || !context) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    worker.postMessage({
      type: "set-raster",
      revision,
      width: canvas.width,
      height: canvas.height,
      data: image.data.buffer,
    }, [image.data.buffer]);
  }, []);

  const requestWorker = useCallback((
    payload: Record<string, unknown>,
  ) => new Promise<VectorizationResult | SeedVectorizationResult | LineSeedVectorizationResult>((resolve, reject) => {
    const worker = vectorWorkerRef.current;
    if (!worker) {
      reject(new Error("Vector worker unavailable"));
      return;
    }
    const requestId = ++workerRequestRef.current;
    pendingWorkerRef.current.set(requestId, { resolve, reject });
    worker.postMessage({ ...payload, requestId });
  }), []);

  useEffect(() => {
    if (mapSource === "none") return;
    const frame = window.requestAnimationFrame(() => syncRasterToWorker(mapRevisionRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [mapRevision, mapSource, syncRasterToWorker]);

  const fitDocument = useCallback(() => {
    const viewer = viewerRef.current; if (!viewer) return;
    const rect = viewer.getBoundingClientRect(); const scale = clamp(Math.min((rect.width - 48) / DOC_W, (rect.height - 48) / DOC_H), MIN_SCALE, 1.4);
    setTransform({ x: (rect.width - DOC_W * scale) / 2, y: (rect.height - DOC_H * scale) / 2, scale });
  }, [DOC_H, DOC_W]);

  const zoomAtViewerCenter = useCallback((factor: number) => {
    const viewer = viewerRef.current; if (!viewer) return;
    const rect = viewer.getBoundingClientRect();
    setTransform(zoomTransformAt(
      transformRef.current,
      { x: rect.width / 2, y: rect.height / 2 },
      transformRef.current.scale * factor,
      MIN_SCALE,
      maxScale,
    ));
  }, [maxScale]);

  const focusSelectedShape = useCallback(() => {
    const viewer = viewerRef.current;
    const shape = shapes.find((item) => item.id === selectedId);
    if (!viewer || !shape) return;
    const bounds = boundsForPoints(shape.points);
    if (!bounds) return;
    const rect = viewer.getBoundingClientRect();
    setTransform(fitGeometryBounds(
      { width: rect.width, height: rect.height },
      bounds,
      MIN_SCALE,
      maxScale,
      0.12,
    ));
    notify(`Focused ${shape.name}`);
  }, [maxScale, notify, selectedId, shapes]);

  useEffect(() => {
    const viewer = viewerRef.current; if (!viewer) return;
    const observer = new ResizeObserver(() => { if (!hasFittedRef.current) { fitDocument(); hasFittedRef.current = true; } });
    observer.observe(viewer); return () => observer.disconnect();
  }, [fitDocument]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      fitDocument();
      hasFittedRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [DOC_H, DOC_W, fitDocument]);

  useEffect(() => {
    const viewer = viewerRef.current; if (!viewer) return;
    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewer.getBoundingClientRect();
      const current = transformRef.current;
      if (event.ctrlKey || event.metaKey) {
        setTransform(zoomTransformAt(
          current,
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          current.scale * Math.exp(-event.deltaY * 0.003),
          MIN_SCALE,
          maxScale,
        ));
      } else {
        setTransform({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY });
      }
    };
    viewer.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", handleNativeWheel);
  }, [maxScale]);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewerRef.current?.getBoundingClientRect(); const t = transformRef.current;
    if (!rect) return { x: 0, y: 0 };
    return { x: clamp((clientX - rect.left - t.x) / t.scale, 0, DOC_W), y: clamp((clientY - rect.top - t.y) / t.scale, 0, DOC_H) };
  }, [DOC_H, DOC_W]);


  useEffect(() => {
    const canvas = mapCanvasRef.current;
    const viewer = viewerRef.current;
    const source = rasterSourceRef.current;
    if (!canvas || !viewer) return;
    const rect = viewer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    if (!source || mapSource === "none" || !mapVisible) return;
    const bounds = visibleWorldBounds(
      { width: rect.width, height: rect.height },
      transform,
      { width: DOC_W, height: DOC_H },
    );
    if (!bounds) return;
    const sourceWidth = bounds.maxX - bounds.minX;
    const sourceHeight = bounds.maxY - bounds.minY;
    context.imageSmoothingEnabled = transform.scale < 1;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      source,
      bounds.minX,
      bounds.minY,
      sourceWidth,
      sourceHeight,
      transform.x + bounds.minX * transform.scale,
      transform.y + bounds.minY * transform.scale,
      sourceWidth * transform.scale,
      sourceHeight * transform.scale,
    );
    paintEraserStrokes(
      context,
      activeEraserStroke ? [...eraserStrokes, activeEraserStroke] : eraserStrokes,
      transform.scale,
      { x: transform.x, y: transform.y },
    );
  }, [DOC_H, DOC_W, activeEraserStroke, eraserStrokes, mapRevision, mapSource, mapVisible, transform]);

  const snapToCenterline = useCallback((point: Point) => {
    const ctx = processingCanvasRef.current?.getContext("2d", { willReadFrequently: true }); if (!ctx || mapSource === "none") return point;
    const scale = documentRaster.processingScale;
    const processingPoint = { x: point.x * scale, y: point.y * scale };
    const radius = Math.max(2, SNAP_RADIUS * scale);
    const sx = Math.max(0, Math.floor(processingPoint.x - radius)); const sy = Math.max(0, Math.floor(processingPoint.y - radius));
    const width = Math.min(Math.ceil(radius * 2 + 1), documentRaster.processingWidth - sx); const height = Math.min(Math.ceil(radius * 2 + 1), documentRaster.processingHeight - sy);
    try {
      const image = ctx.getImageData(sx, sy, width, height);
      const local = nearestInkCentroid(
        { data: image.data, width, height },
        { x: processingPoint.x - sx, y: processingPoint.y - sy },
        radius,
      );
      return { x: (local.x + sx) / scale, y: (local.y + sy) / scale };
    } catch { return point; }
  }, [documentRaster, mapSource]);

  const resolveSmartSnap = useCallback((
    raw: Point,
    options: { excludeShapeId?: string; excludeNodeId?: string; bypass?: boolean } = {},
  ): SmartSnapResult => {
    if (!snapSettings.enabled || options.bypass) return { point: raw, kind: "RAW" };
    const topologySnap = findTopologySnap(
      raw,
      shapes,
      14 / Math.max(transformRef.current.scale, MIN_SCALE),
      {
        vertices: snapSettings.vertices,
        edges: snapSettings.edges,
        excludeShapeId: options.excludeShapeId,
        excludeNodeId: options.excludeNodeId,
        spatialIndex: topologySpatialIndex,
      },
    );
    if (topologySnap) {
      return {
        point: topologySnap.point,
        kind: topologySnap.kind === "vertex" ? "VERTEX" : "EDGE",
        topology: topologySnap,
      };
    }
    if (snapSettings.mapInk) {
      const centered = snapToCenterline(raw);
      if (distance(centered, raw) > 0.01) return { point: centered, kind: "MAP" };
    }
    return { point: raw, kind: "RAW" };
  }, [shapes, snapSettings, snapToCenterline, topologySpatialIndex]);

  useEffect(() => {
    if (!magnifier || !magnifierCanvasRef.current) return;
    const ctx = magnifierCanvasRef.current.getContext("2d"); if (!ctx) return;
    const lensSize = 160;
    const sourceSize = 24;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, lensSize, lensSize);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lensSize, lensSize);
    const source = processingCanvasRef.current;
    if (source && mapVisible && mapSource !== "none") {
      const processingScale = documentRaster.processingScale;
      ctx.drawImage(
        source,
        (magnifier.snapped.x - sourceSize / 2) * processingScale,
        (magnifier.snapped.y - sourceSize / 2) * processingScale,
        sourceSize * processingScale,
        sourceSize * processingScale,
        0,
        0,
        lensSize,
        lensSize,
      );
    }
    const selectedShape = shapes.find((shape) => shape.id === selectedId);
    if (selectedShape) {
      const factor = lensSize / sourceSize;
      ctx.strokeStyle = selectedShape.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      selectedShape.points.forEach((point, index) => {
        const x = lensSize / 2 + (point.x - magnifier.snapped.x) * factor;
        const y = lensSize / 2 + (point.y - magnifier.snapped.y) * factor;
        if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      if (selectedShape.closed) ctx.closePath();
      ctx.stroke();
    }
  }, [documentRaster.processingScale, eraserStrokes, magnifier, mapSource, mapVisible, selectedId, shapes]);

  const totalLength = useMemo(() => shapes.reduce((sum, shape) => sum + pathLength(shape) / pxPerUnit, 0), [shapes, pxPerUnit]);
  const totalArea = useMemo(() => shapes.reduce((sum, shape) => sum + (shape.closed ? polygonArea(shape.points) / pxPerUnit ** 2 : 0), 0), [shapes, pxPerUnit]);
  const formatLength = (pixels: number) => `${(pixels / pxPerUnit).toFixed(2)} ${unit}`;
  const formatArea = (pixels: number) => `${(pixels / pxPerUnit ** 2).toFixed(2)} ${unit}²`;

  const deleteShape = useCallback((shapeId: string) => {
    pushHistory();
    setShapes((current) => current.filter((shape) => shape.id !== shapeId));
    setSelectedIds((current) => removeSelectionId(current, shapeId));
    setSelectedSegment((current) => current?.shapeId === shapeId ? null : current);
    setSelectedVertex((current) => current?.shapeId === shapeId ? null : current);
    setLinkSource((current) => current?.shapeId === shapeId ? null : current);
    setDiagonalStart((current) => current?.shapeId === shapeId ? null : current);
    setExtendAnchor((current) => current?.shapeId === shapeId ? null : current);
    notify("Shape deleted / measurements recalculated");
  }, [notify, pushHistory]);

  const deleteSelectedShapes = useCallback(() => {
    if (!selectedIds.length) return;
    pushHistory();
    const selected = new Set(selectedIds);
    setShapes((current) => current.filter((shape) => !selected.has(shape.id)));
    setSelectedIds([]);
    setSelectedSegment(null);
    setSelectedVertex(null);
    notify(`${selected.size} selected object${selected.size === 1 ? "" : "s"} deleted`);
  }, [notify, pushHistory, selectedIds, setSelectedIds, setSelectedSegment, setSelectedVertex, setShapes]);

  const setSelectedVisibility = useCallback((visible: boolean) => {
    if (!selectedIds.length) return;
    pushHistory();
    const selected = new Set(selectedIds);
    setShapes((current) => current.map((shape) => selected.has(shape.id) ? { ...shape, visible } : shape));
    notify(`${selected.size} selected object${selected.size === 1 ? "" : "s"} ${visible ? "shown" : "hidden"}`);
  }, [notify, pushHistory, selectedIds, setShapes]);

  const setSelectedColor = useCallback((color: string) => {
    if (!selectedIds.length) return;
    pushHistory();
    const selected = new Set(selectedIds);
    setShapes((current) => current.map((shape) => selected.has(shape.id) ? { ...shape, color } : shape));
  }, [pushHistory, selectedIds, setShapes]);

  const mergeSelectedPlots = useCallback(() => {
    const selectedSet = new Set(selectedIds);
    const selectedShapes = shapes.filter((shape) => selectedSet.has(shape.id));
    const result = mergeAdjacentPlots(selectedShapes);
    if (!result.ok) {
      const reason = "reason" in result ? result.reason : "";
      if (reason === "need_multiple") notify("Select at least two adjoining plots to merge");
      else if (reason === "open_shape") notify("Plot Merge supports closed polygon plots only");
      else if (reason === "not_adjacent") notify("Selected plots must share exact adjoining boundaries");
      else notify("Merge cancelled: selected boundaries do not form one valid exterior loop");
      return;
    }
    const primary = selectedShapes.find((shape) => shape.id === selectedId) ?? selectedShapes[selectedShapes.length - 1]!;
    const mergedId = `merged-plot-${Date.now()}`;
    const mergedShape: Shape = {
      id: mergedId,
      name: `Merged plot ${shapes.filter((shape) => shape.source === "Merged").length + 1}`,
      source: "Merged",
      points: result.points,
      nodeIds: result.nodeIds,
      closed: true,
      color: primary.color,
      visible: selectedShapes.some((shape) => shape.visible),
      diagonals: [],
    };
    const insertionIndex = Math.min(...selectedShapes.map((shape) => shapes.findIndex((candidate) => candidate.id === shape.id)));
    pushHistory();
    setShapes((current) => {
      const remaining = current.filter((shape) => !selectedSet.has(shape.id));
      remaining.splice(Math.max(0, insertionIndex), 0, mergedShape);
      return remaining;
    });
    setSelectedIds([mergedId]);
    setSelectedSegment(null);
    setSelectedVertex(null);
    setDiagonalStart(null);
    notify(`${selectedShapes.length} plots merged / ${result.removedSharedEdges} shared boundar${result.removedSharedEdges === 1 ? "y" : "ies"} removed`);
  }, [notify, pushHistory, selectedId, selectedIds, setSelectedIds, setSelectedSegment, setSelectedVertex, shapes]);

  const deleteVertex = useCallback((shapeId: string, index: number) => {
    pushHistory();
    setShapes((current) => current.flatMap((shape) => {
      if (shape.id !== shapeId) return [shape];
      const removedNodeId = shape.nodeIds[index];
      const points = shape.points.filter((_, pointIndex) => pointIndex !== index);
      const nodeIds = shape.nodeIds.filter((_, pointIndex) => pointIndex !== index);
      if (points.length < 2) return [];
      return [{
        ...shape,
        points,
        nodeIds,
        closed: shape.closed && points.length >= 3,
        diagonals: shape.diagonals.filter((diagonal) => diagonal.aNodeId !== removedNodeId && diagonal.bNodeId !== removedNodeId),
      }];
    }));
    setExtendAnchor(null); notify("Vertex deleted / path reconnected");
  }, [notify, pushHistory, setExtendAnchor, setShapes]);

  const deleteSegment = useCallback((shapeId: string, segmentIndex: number) => {
    pushHistory();
    setShapes((current) => current.flatMap((shape) => {
      if (shape.id !== shapeId) return [shape];
      const count = shape.points.length;
      if (count < 2) return [shape];
      if (shape.closed) {
        if (segmentIndex === count - 1) return [{ ...shape, closed: false }];
        const points = [...shape.points.slice(segmentIndex + 1), ...shape.points.slice(0, segmentIndex + 1)];
        const nodeIds = [...shape.nodeIds.slice(segmentIndex + 1), ...shape.nodeIds.slice(0, segmentIndex + 1)];
        return [{ ...shape, points, nodeIds, closed: false }];
      }
       if (segmentIndex === 0) return [sanitizeDiagonals({ ...shape, points: shape.points.slice(1), nodeIds: shape.nodeIds.slice(1) })];
       if (segmentIndex === count - 2) return [sanitizeDiagonals({ ...shape, points: shape.points.slice(0, -1), nodeIds: shape.nodeIds.slice(0, -1) })];
      const first = shape.points.slice(0, segmentIndex + 1); const second = shape.points.slice(segmentIndex + 1);
      const firstIds = shape.nodeIds.slice(0, segmentIndex + 1); const secondIds = shape.nodeIds.slice(segmentIndex + 1);
      return [
        { ...shape, points: first, nodeIds: firstIds, closed: false, diagonals: shape.diagonals.filter((diagonal) => firstIds.includes(diagonal.aNodeId) && firstIds.includes(diagonal.bNodeId)) },
        { ...shape, id: `${shape.id}-split-${Date.now()}`, name: `${shape.name} / split`, points: second, nodeIds: secondIds, closed: false, diagonals: shape.diagonals.filter((diagonal) => secondIds.includes(diagonal.aNodeId) && secondIds.includes(diagonal.bNodeId)) },
      ];
    }));
    setSelectedSegment(null); notify("Single segment removed / topology updated");
  }, [notify, pushHistory, setSelectedSegment, setShapes]);

  const deleteDiagonal = useCallback((shapeId: string, diagonalId: string) => {
    pushHistory();
    setShapes((current) => current.map((shape) => shape.id === shapeId
      ? { ...shape, diagonals: shape.diagonals.filter((diagonal) => diagonal.id !== diagonalId) }
      : shape));
    notify("Diagonal removed / measurements updated");
  }, [notify, pushHistory, setShapes]);

  const selectDiagonalVertex = useCallback((shape: Shape, index: number) => {
    if (!shape.closed || shape.points.length < 4) {
      notify("Diagonals require a closed polygon with at least four vertices");
      return;
    }
    const nodeId = shape.nodeIds[index];
    setSelectedId(shape.id);
    setSelectedVertex({ shapeId: shape.id, index });
    if (!diagonalStart || diagonalStart.shapeId !== shape.id) {
      setDiagonalStart({ shapeId: shape.id, nodeId });
      notify("First diagonal vertex fixed / click another non-adjacent vertex of this plot");
      return;
    }
    if (diagonalStart.nodeId === nodeId) {
      setDiagonalStart(null);
      notify("Diagonal start cancelled");
      return;
    }
    const validation = validateDiagonal(shape.nodeIds, shape.closed, shape.diagonals, diagonalStart.nodeId, nodeId);
    if (!validation.ok) {
      const reason = "reason" in validation ? validation.reason : "";
      if (reason === "boundary_edge") notify("Choose a non-adjacent vertex; boundary edges are not diagonals");
      else if (reason === "duplicate") notify("This diagonal already exists");
      else notify("Choose two valid vertices of the same plot");
      setDiagonalStart(null);
      return;
    }
    pushHistory();
    const diagonal: Diagonal = {
      id: `${shape.id}:diagonal:${Date.now()}`,
      aNodeId: diagonalStart.nodeId,
      bNodeId: nodeId,
    };
    setShapes((current) => current.map((candidate) => candidate.id === shape.id
      ? { ...candidate, diagonals: [...candidate.diagonals, diagonal] }
      : candidate));
    setDiagonalStart(null);
    notify(`Diagonal ${shape.diagonals.length + 1} added / choose another vertex pair to continue`);
  }, [diagonalStart, notify, pushHistory, setSelectedId, setSelectedVertex, setShapes]);

  const unlinkVertex = useCallback((shapeId: string, index: number) => {
    const oldNodeId = shapes.find((shape) => shape.id === shapeId)?.nodeIds[index];
    const result = unlinkTopologyVertex(shapes, shapeId, index);
    if (!result.ok) { notify("Vertex could not be unlinked"); return; }
    pushHistory();
    setShapes(oldNodeId ? remapDiagonalNode(result.shapes as Shape[], shapeId, oldNodeId, result.nodeId) : result.shapes as Shape[]);
    setSelectedVertex({ shapeId, index });
    notify("Vertex unlinked from neighboring plots / coordinate preserved");
  }, [notify, pushHistory, setSelectedVertex, setShapes, shapes]);

  const relinkNearest = useCallback((shapeId: string, index: number) => {
    const shape = shapes.find((candidate) => candidate.id === shapeId);
    if (!shape) return;
    const snap = findTopologySnap(shape.points[index], shapes, 18 / Math.max(transformRef.current.scale, MIN_SCALE), {
      vertices: true,
      edges: true,
      excludeShapeId: shapeId,
      excludeNodeId: shape.nodeIds[index],
      spatialIndex: topologySpatialIndex,
    });
    if (!snap) {
      setLinkSource({ shapeId, index });
      notify("No nearby link candidate / tap a target vertex or edge");
      return;
    }
    const result = snap.kind === "vertex"
      ? relinkTopologyVertex(shapes, shapeId, index, snap.nodeId)
      : (() => {
          const member = topology.edges.get(snap.edgeId)?.members.find((candidate) => candidate.shapeId !== shapeId);
          return member
            ? relinkTopologyVertexToEdge(shapes, shapeId, index, member.shapeId, member.index, snap.point)
            : { ok: false as const, shapes, reason: "no_candidate" as const };
        })();
    if (!result.ok) {
      const reason = "reason" in result ? result.reason : "";
      notify(reason === "invalid_geometry" ? "Relink cancelled: polygon would become invalid" : "No compatible link candidate");
      return;
    }
    pushHistory();
    setShapes(remapDiagonalNode(result.shapes as Shape[], shapeId, shape.nodeIds[index], result.nodeId));
    setLinkSource(null);
    notify(`Vertex relinked to nearest ${snap.kind}`);
  }, [notify, pushHistory, setLinkSource, setShapes, shapes, topology.edges, topologySpatialIndex]);

  const insertVertex = useCallback((shapeId: string, segmentIndex: number, click: Point) => {
    pushHistory();
    setShapes((current) => insertTopologyVertex(current, shapeId, segmentIndex, click) as Shape[]);
    setSelectedId(shapeId); setSelectedSegment({ shapeId, index: segmentIndex }); notify("Vertex inserted / segment split");
  }, [notify, pushHistory, setSelectedId, setSelectedSegment, setShapes]);

  const finishManual = useCallback((points: Point[], closed: boolean) => {
    const deduped = points.filter((point, index) => !index || distance(point, points[index - 1]) > 1);
    if (deduped.length < 2) return;
    pushHistory();
    const id = `manual-${Date.now()}`; const shape: Shape = {
      id,
      name: `Manual trace ${shapes.filter((s) => s.source === "Manual").length + 1}`,
      source: "Manual",
      points: deduped,
      nodeIds: deduped.map((_, index) => `${id}:node:${index}`),
      closed: closed && deduped.length >= 3,
      color: SHAPE_PALETTE[shapes.length % SHAPE_PALETTE.length],
      visible: true,
      diagonals: [],
    };
    setShapes((current) => reconcileIncomingShapes(current, [shape], {
      tolerance: Math.max(3, 14 / transformRef.current.scale),
    }).shapes as Shape[]);
    setSelectedId(id); setExpanded((current) => ({ ...current, [id]: true })); setManualPoints([]); setSnapPreview(null); setSnapKind("RAW"); setTool("edit"); notify(shape.closed ? "Loop closed / shared boundaries synchronized / area calculated" : "Open path completed");
  }, [notify, pushHistory, setExpanded, setManualPoints, setSelectedId, setShapes, setSnapPreview, setTool, shapes]);

  const addManualPoint = useCallback((raw: Point, overrideSnap = false) => {
    if (manualPoints.length >= 3 && distance(manualPoints[0], raw) <= 15) {
      lastTapRef.current = null;
      finishManual(manualPoints, true);
      return;
    }
    const resolved = resolveSmartSnap(raw, { bypass: overrideSnap });
    const point = resolved.point; const now = Date.now(); const last = lastTapRef.current;
    if (manualPoints.length >= 3 && distance(manualPoints[0], point) <= 15) {
      lastTapRef.current = null;
      const sealedLoop = manualPoints.map((vertex, index) => index === 0 ? { ...manualPoints[0] } : vertex);
      finishManual(sealedLoop, true); return;
    }
    if (last?.key === "canvas" && last.point && now - last.time < 320 && distance(last.point, point) <= 8 && manualPoints.length >= 1) { lastTapRef.current = null; finishManual(manualPoints, false); return; }
    pushHistory();
    lastTapRef.current = { time: now, key: "canvas", point }; setManualPoints((current) => [...current, point]); setSnapPreview(point); setSnapKind(resolved.kind);
  }, [finishManual, manualPoints, pushHistory, resolveSmartSnap, setManualPoints, setSnapPreview]);

  const handleTraceVertex = (index: number) => {
    if (index !== 0 || manualPoints.length < 3) return;
    finishManual(manualPoints, true);
  };

  const snapCalibrationPoint = (point: Point) => nearestCalibrationVertex(
    point,
    shapes.flatMap((shape) => shape.points),
    18 / transformRef.current.scale,
  );

  const captureCalibrationPoint = (raw: Point) => {
    if (calibrationLines.length >= 3) { notify("Three calibration baselines is the maximum"); return; }
    const point = snapCalibrationPoint(raw);
    if (!calibrationClickStart) {
      pushHistory();
      setCalibrationClickStart(point);
      setDraftCalibrationLine({ a: point, b: point });
      notify("First calibration point fixed / click the second point");
      return;
    }
    if (distance(calibrationClickStart, point) <= 3 / transformRef.current.scale) {
      notify("Second calibration point must be different");
      return;
    }
    const nextNumber = calibrationLines.length + 1;
    pushHistory();
    setCalibrationLines((current) => [...current, {
      id: `point-cal-${nextNumber}-${Math.round(calibrationClickStart.x)}-${Math.round(point.x)}`,
      label: `Point-to-point ${nextNumber}`,
      kind: "manual",
      a: calibrationClickStart,
      b: point,
      actual: "",
    }]);
    setCalibrationClickStart(null);
    setDraftCalibrationLine(null);
    notify(`Point-to-point calibration line ${nextNumber} captured`);
  };

  const toggleCalibrationSegment = (shape: Shape, segmentIndex: number) => {
    const id = `segment-cal-${shape.id}-${segmentIndex}`;
    if (calibrationLines.some((line) => line.id === id)) {
      pushHistory();
      setCalibrationLines((current) => current.filter((line) => line.id !== id));
      notify("Calibration segment deselected");
      return;
    }
    if (calibrationLines.length >= 3) { notify("Three calibration baselines is the maximum"); return; }
    const segment = segmentPairs(shape).find((item) => item.index === segmentIndex);
    if (!segment) return;
    pushHistory();
    setCalibrationLines((current) => [...current, {
      id,
      label: `${shape.name} / SEG ${String(segmentIndex + 1).padStart(2, "0")}`,
      kind: "segment",
      a: { ...segment.a },
      b: { ...segment.b },
      actual: "",
      shapeId: shape.id,
      segmentIndex,
    }]);
    setSelectedId(shape.id);
    setSelectedSegment({ shapeId: shape.id, index: segmentIndex });
    notify("Shape segment selected as a calibration baseline");
  };

  const handleSegmentPointerDown = (event: ReactPointerEvent<SVGLineElement>, shape: Shape, segmentIndex: number) => {
    event.stopPropagation(); const click = clientToWorld(event.clientX, event.clientY);
    if (linkSource) {
      const oldNodeId = shapes.find((candidate) => candidate.id === linkSource.shapeId)?.nodeIds[linkSource.index];
      const result = relinkTopologyVertexToEdge(shapes, linkSource.shapeId, linkSource.index, shape.id, segmentIndex, click);
      if (!result.ok) notify("reason" in result && result.reason === "invalid_geometry" ? "Relink cancelled: polygon would become invalid" : "Target edge is not compatible");
      else {
        pushHistory();
        setShapes(oldNodeId ? remapDiagonalNode(result.shapes as Shape[], linkSource.shapeId, oldNodeId, result.nodeId) : result.shapes as Shape[]);
        setLinkSource(null);
        notify("Vertex linked to target edge / canonical edge split");
      }
      return;
    }
    if (tool === "calibrate" && calibrationMode === "segments") { toggleCalibrationSegment(shape, segmentIndex); return; }
    if (tool === "calibrate" && calibrationMode === "manual") {
      const segment = segmentPairs(shape).find((item) => item.index === segmentIndex);
      if (segment) captureCalibrationPoint(segmentProjection(click, segment.a, segment.b).point);
      return;
    }
    if (tool === "delete") { deleteShape(shape.id); return; }
    const key = `${shape.id}:${segmentIndex}`; const now = event.timeStamp; const last = lastTapRef.current;
    if ((tool === "edit" || tool === "select") && last?.key === key && now - last.time < 340) { lastTapRef.current = null; insertVertex(shape.id, segmentIndex, click); return; }
    lastTapRef.current = { time: now, key };
    selectShape(shape.id, selectionMode === "multi" || event.ctrlKey || event.metaKey);
    setSelectedSegment({ shapeId: shape.id, index: segmentIndex });
  };

  const handleVertexPointerDown = (event: ReactPointerEvent<SVGGElement>, shape: Shape, index: number) => {
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "diagonal") { selectDiagonalVertex(shape, index); return; }
    if (linkSource) {
      const oldNodeId = shapes.find((candidate) => candidate.id === linkSource.shapeId)?.nodeIds[linkSource.index];
      const result = relinkTopologyVertex(shapes, linkSource.shapeId, linkSource.index, shape.nodeIds[index]);
      if (!result.ok) notify("reason" in result && result.reason === "invalid_geometry" ? "Relink cancelled: polygon would become invalid" : "Target vertex is not compatible");
      else {
        pushHistory();
        setShapes(oldNodeId ? remapDiagonalNode(result.shapes as Shape[], linkSource.shapeId, oldNodeId, result.nodeId) : result.shapes as Shape[]);
        setLinkSource(null);
        notify("Vertex relinked to canonical target");
      }
      return;
    }
    if (tool === "calibrate" && calibrationMode === "manual") { captureCalibrationPoint(shape.points[index]); return; }
    if (tool === "delete") { deleteVertex(shape.id, index); return; }
    const key = `${shape.id}:${index}`; const now = event.timeStamp; const last = lastVertexTapRef.current;
    if (last?.key === key && now - last.time <= 340) { lastVertexTapRef.current = null; vertexPressRef.current = null; deleteVertex(shape.id, index); return; }
    lastVertexTapRef.current = { key, time: now };
    setSelectedId(shape.id); setSelectedSegment(null); setSelectedVertex({ shapeId: shape.id, index });
    if (tool === "edit") {
      const linked = (snapSettings.linkedEdit === "all") !== event.altKey;
      vertexPressRef.current = {
        shapeId: shape.id,
        index,
        client: { x: event.clientX, y: event.clientY },
        moved: false,
        before: captureEditorSnapshot(),
        linked,
        sourceNodeId: shape.nodeIds[index],
      };
      if (magnifierEnabled) setMagnifier({ raw: shape.points[index], snapped: shape.points[index], kind: "vertex" });
    }
  };

  const beginCalibration = (mode: Exclude<CalibrationMode, null>) => {
    setCalibrationMode(mode); setCalibrationLines([]); setCalibrationRegion(null); setDraftCalibrationLine(null); setCalibrationClickStart(null); setCalibrationLauncherOpen(false); setTool("calibrate");
    notify(mode === "auto" ? "Auto calibration: drag over the grid bar" : mode === "segments" ? "Touch one to three existing vector segments" : "Click the first point, then click the second point");
  };

  const createAutoCalibrationLines = (box: Box) => {
    const ctx = processingCanvasRef.current?.getContext("2d", { willReadFrequently: true });
    let topA = { x: box.x, y: box.y }, topB = { x: box.x + box.width, y: box.y };
    let centerA = { x: box.x, y: box.y + box.height / 2 }, centerB = { x: box.x + box.width, y: box.y + box.height / 2 };
    let verticalA = { x: box.x + box.width, y: box.y }, verticalB = { x: box.x + box.width, y: box.y + box.height }; let useRight = true;
    if (ctx) {
      const rasterBox = documentBoxToRaster(
        box,
        documentRaster.processingScale,
        documentRaster.processingWidth,
        documentRaster.processingHeight,
      );
      const { x: sx, y: sy, width, height, scale } = rasterBox;
      const data = ctx.getImageData(sx, sy, width, height).data;
      const dark = (x: number, y: number) => { const i = (y * width + x) * 4; return data[i + 3] > 160 && data[i] + data[i + 1] + data[i + 2] < 360; };
      const bestRow = (from: number, to: number) => { let best = { score: -1, y: from, min: 0, max: width - 1 }; for (let py = from; py <= to; py++) { let score = 0, min = width, max = 0; for (let px = 0; px < width; px++) if (dark(px, py)) { score++; min = Math.min(min, px); max = Math.max(max, px); } if (score > best.score) best = { score, y: py, min: min === width ? 0 : min, max: score ? max : width - 1 }; } return best; };
      const bestCol = (from: number, to: number) => { let best = { score: -1, x: from, min: 0, max: height - 1 }; for (let px = from; px <= to; px++) { let score = 0, min = height, max = 0; for (let py = 0; py < height; py++) if (dark(px, py)) { score++; min = Math.min(min, py); max = Math.max(max, py); } if (score > best.score) best = { score, x: px, min: min === height ? 0 : min, max: score ? max : height - 1 }; } return best; };
      const top = bestRow(0, Math.max(0, Math.floor(height * .34))); const center = bestRow(Math.floor(height * .34), Math.max(0, Math.floor(height * .68))); const left = bestCol(0, Math.max(0, Math.floor(width * .3))); const right = bestCol(Math.floor(width * .7), width - 1); const side = right.score >= left.score ? right : left; useRight = right.score >= left.score;
      topA = { x: (sx + top.min) / scale, y: (sy + top.y) / scale };
      topB = { x: (sx + top.max) / scale, y: (sy + top.y) / scale };
      centerA = { x: (sx + center.min) / scale, y: (sy + center.y) / scale };
      centerB = { x: (sx + center.max) / scale, y: (sy + center.y) / scale };
      verticalA = { x: (sx + side.x) / scale, y: (sy + side.min) / scale };
      verticalB = { x: (sx + side.x) / scale, y: (sy + side.max) / scale };
    }
    setCalibrationRegion(box);
    setCalibrationLines([
      { id: "auto-width", label: "Top horizontal width", kind: "width", a: topA, b: topB, actual: "" },
      { id: "auto-height", label: `${useRight ? "Right" : "Left"} vertical height`, kind: "height", a: verticalA, b: verticalB, actual: "" },
      { id: "auto-baseline", label: "Center grid baseline", kind: "baseline", a: centerA, b: centerB, actual: "" },
    ]);
    notify("3 helper lines detected / drag anchors to refine");
  };

  const applyAveragedCalibration = () => {
    const valid = calibrationLines.filter((line) => Number(line.actual) > 0);
    if (valid.length < 1 || valid.length > 3) { notify("Enter a real distance for one to three calibration lines"); return; }
    const average = averagePixelsPerUnit(valid);
    if (!average) { notify("Calibration lines need a measurable pixel length"); return; }
    pushHistory();
    setPxPerUnit(average); setCalibrationLines([]); setCalibrationRegion(null); setDraftCalibrationLine(null); setCalibrationClickStart(null); setCalibrationMode(null); setDraftBox(null); boxStartRef.current = null; setTool("select");
    notify(`${valid.length === 1 ? "Scale" : "Averaged scale"} applied from ${valid.length} line${valid.length === 1 ? "" : "s"}: ${average.toFixed(4)} px/${unit}`);
  };

  const cancelCalibration = () => { setCalibrationLines([]); setCalibrationRegion(null); setDraftCalibrationLine(null); setCalibrationClickStart(null); setCalibrationMode(null); setDraftBox(null); boxStartRef.current = null; setTool("select"); notify("Calibration helpers cleared"); };

  const handleViewerPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const client = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, client);
    if (pointersRef.current.size < 2) return;
    const points = [...pointersRef.current.values()].slice(0, 2);
    const midpoint = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
    gestureRef.current = {
      distance: distance(points[0], points[1]),
      midpoint,
      transform: transformRef.current,
    };
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    setMagnifier(null);
    tracePressRef.current = null;
    pickPressRef.current = null;
    eraserPressRef.current = null;
    setActiveEraserStroke(null);
    setPickSeed(null);
    vertexPressRef.current = null;
    calibrationDragRef.current = null;
    panRef.current = null;
    boxStartRef.current = null;
    setDraftBox(null);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleViewerPointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gestureRef.current || pointersRef.current.size < 2) return;
    const points = [...pointersRef.current.values()].slice(0, 2);
    const midpoint = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
    const rect = viewerRef.current!.getBoundingClientRect();
    const start = gestureRef.current;
    setTransform(pinchTransform(
      start.transform,
      { x: start.midpoint.x - rect.left, y: start.midpoint.y - rect.top },
      { x: midpoint.x - rect.left, y: midpoint.y - rect.top },
      start.distance,
      distance(points[0], points[1]),
      MIN_SCALE,
      maxScale,
    ));
    event.preventDefault();
    event.stopPropagation();
  };

  const handleViewerPointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    pointersRef.current.delete(event.pointerId);
    if (!gestureRef.current) return;
    if (pointersRef.current.size < 2) gestureRef.current = null;
    panRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const client = { x: event.clientX, y: event.clientY }; pointersRef.current.set(event.pointerId, client); event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size >= 2) {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current); setMagnifier(null); tracePressRef.current = null; pickPressRef.current = null; eraserPressRef.current = null; setActiveEraserStroke(null); setPickSeed(null);
      const points = [...pointersRef.current.values()]; const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      gestureRef.current = { distance: distance(points[0], points[1]), midpoint, transform: transformRef.current }; return;
    }
    const world = clientToWorld(event.clientX, event.clientY);
    if (tool === "pan" || (tool === "select" && !pickContainingShape(world, shapes))) {
      panRef.current = { pointer: client, transform: transformRef.current };
      if (tool === "pan") return;
    }
    if (tool === "erase-map") {
      if (mapSource === "none") { notify("Upload a map before using Map Eraser"); return; }
      const stroke: EraserStroke = {
        id: `erase-${mapRevisionRef.current}-${++eraserStrokeIdRef.current}`,
        points: [world],
        radius: eraserSize / (2 * Math.max(transformRef.current.scale, MIN_SCALE)),
      };
      eraserPressRef.current = { pointerId: event.pointerId, before: captureEditorSnapshot(), stroke };
      setActiveEraserStroke(stroke);
      return;
    }
    if (tool === "pick" || tool === "line-pick") { pickPressRef.current = { pointerId: event.pointerId, startClient: client, point: world }; setPickSeed(world); return; }
    if (tool === "roi") { boxStartRef.current = world; setDraftBox({ x: world.x, y: world.y, width: 0, height: 0 }); return; }
    if (tool === "calibrate" && calibrationMode === "auto" && !calibrationLines.length) { boxStartRef.current = world; setDraftBox({ x: world.x, y: world.y, width: 0, height: 0 }); return; }
    if (tool === "calibrate" && calibrationMode === "manual") { captureCalibrationPoint(world); return; }
    if (tool === "manual") {
      tracePressRef.current = { pointerId: event.pointerId, startClient: client, raw: world };
      if (magnifierEnabled) {
        longPressTimerRef.current = window.setTimeout(() => {
          const resolved = resolveSmartSnap(world);
          setSnapKind(resolved.kind);
          setMagnifier({ raw: world, snapped: resolved.point, kind: "manual" });
        }, 480);
      }
      return;
    }
    if (tool === "edit" && extendAnchor) {
      const resolved = resolveSmartSnap(world);
      const point = resolved.point;
      pushHistory();
      setShapes((current) => current.map((shape) => shape.id === extendAnchor.shapeId ? {
        ...shape,
        points: extendAnchor.atStart ? [point, ...shape.points] : [...shape.points, point],
        nodeIds: extendAnchor.atStart
          ? [`${shape.id}:extended:${Date.now()}`, ...shape.nodeIds]
          : [...shape.nodeIds, `${shape.id}:extended:${Date.now()}`],
      } : shape));
      notify("Path extended from selected endpoint"); return;
    }
    if (tool === "select" || tool === "edit" || tool === "diagonal" || tool === "delete") {
      const hit = pickContainingShape(world, shapes);
      if (hit) {
        if (tool === "delete") deleteShape(hit.id);
        else selectShape(hit.id, tool !== "diagonal" && (selectionMode === "multi" || event.ctrlKey || event.metaKey));
        return;
      }
      if (tool === "select" && selectionMode === "single" && !event.ctrlKey && !event.metaKey) {
        setSelectedIds([]);
        setSelectedSegment(null);
        setSelectedVertex(null);
      }
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const client = { x: event.clientX, y: event.clientY }; if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, client);
    if (pointersRef.current.size >= 2 && gestureRef.current) {
      const points = [...pointersRef.current.values()]; const currentDistance = distance(points[0], points[1]); const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const start = gestureRef.current; const nextScale = clamp(start.transform.scale * currentDistance / Math.max(start.distance, 1), MIN_SCALE, maxScale);
      const viewerRect = viewerRef.current!.getBoundingClientRect(); const startLocal = { x: start.midpoint.x - viewerRect.left, y: start.midpoint.y - viewerRect.top }; const currentLocal = { x: midpoint.x - viewerRect.left, y: midpoint.y - viewerRect.top };
      const anchor = { x: (startLocal.x - start.transform.x) / start.transform.scale, y: (startLocal.y - start.transform.y) / start.transform.scale };
      setTransform({ x: currentLocal.x - anchor.x * nextScale, y: currentLocal.y - anchor.y * nextScale, scale: nextScale }); return;
    }
    if (calibrationDragRef.current) {
      const world = clientToWorld(event.clientX, event.clientY); const drag = calibrationDragRef.current;
      setCalibrationLines((current) => current.map((line) => line.id === drag.lineId ? { ...line, [drag.endpoint]: world } : line)); return;
    }
    if (vertexPressRef.current) {
      const press = vertexPressRef.current; const moved = press.moved || Math.hypot(event.clientX - press.client.x, event.clientY - press.client.y) > 3; vertexPressRef.current = { ...press, moved };
      if (moved) {
        const world = clientToWorld(event.clientX, event.clientY);
        const resolved = resolveSmartSnap(world, {
          excludeShapeId: press.shapeId,
          excludeNodeId: press.sourceNodeId,
          bypass: event.altKey && event.shiftKey,
        });
        vertexPressRef.current = { ...press, moved, snap: resolved };
        setShapes((current) => {
          const moved = moveTopologyVertex(
            current,
            press.shapeId,
            press.index,
            resolved.point,
            press.linked,
            resolved.topology?.kind === "vertex" ? resolved.topology.nodeId : undefined,
          ) as Shape[];
          const movedShape = moved.find((shape) => shape.id === press.shapeId);
          const replacementNodeId = movedShape?.nodeIds[press.index];
          if (!replacementNodeId || replacementNodeId === press.sourceNodeId) return moved;
          return moved.map((shape) => {
            if (!press.linked && shape.id !== press.shapeId) return shape;
            return {
              ...shape,
              diagonals: shape.diagonals.map((diagonal) => ({
                ...diagonal,
                aNodeId: diagonal.aNodeId === press.sourceNodeId ? replacementNodeId : diagonal.aNodeId,
                bNodeId: diagonal.bNodeId === press.sourceNodeId ? replacementNodeId : diagonal.bNodeId,
              })),
            };
          });
        });
        setSnapKind(resolved.kind);
        setMagnifier({ raw: world, snapped: resolved.point, kind: "vertex" });
        setExtendAnchor(null);
      }
      return;
    }
    if (panRef.current) { const start = panRef.current; setTransform({ ...start.transform, x: start.transform.x + event.clientX - start.pointer.x, y: start.transform.y + event.clientY - start.pointer.y }); return; }
    if (eraserPressRef.current?.pointerId === event.pointerId) {
      const world = clientToWorld(event.clientX, event.clientY);
      const current = eraserPressRef.current.stroke;
      const previous = current.points.at(-1)!;
      if (distance(previous, world) >= Math.max(.5, current.radius * .18)) {
        const stroke = { ...current, points: [...current.points, world] };
        eraserPressRef.current = { ...eraserPressRef.current, stroke };
        setActiveEraserStroke(stroke);
      }
      return;
    }
    if (pickPressRef.current?.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - pickPressRef.current.startClient.x, event.clientY - pickPressRef.current.startClient.y) > 4) {
        pickPressRef.current = null;
        setPickSeed(null);
      }
      return;
    }
    const world = clientToWorld(event.clientX, event.clientY);
    if (boxStartRef.current) { setDraftBox(normalizeBox(boxStartRef.current, world)); return; }
    if (draftCalibrationLine && calibrationMode === "manual" && calibrationClickStart) { setDraftCalibrationLine((current) => current ? { ...current, b: snapCalibrationPoint(world) } : current); return; }
    if (tracePressRef.current) {
      tracePressRef.current.raw = world;
      if (!magnifier && Math.hypot(event.clientX - tracePressRef.current.startClient.x, event.clientY - tracePressRef.current.startClient.y) > 5 && longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      if (magnifier) {
        const resolved = resolveSmartSnap(world);
        setSnapKind(resolved.kind);
        setMagnifier({ raw: world, snapped: resolved.point, kind: "manual" });
      }
    }
    if (tool === "manual") {
      const resolved = resolveSmartSnap(world);
      setSnapPreview(resolved.point);
      setSnapKind(resolved.kind);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (gestureRef.current) { if (pointersRef.current.size < 2) gestureRef.current = null; panRef.current = null; return; }
    if (calibrationDragRef.current) {
      pushHistory(calibrationDragRef.current.before);
      calibrationDragRef.current = null;
      notify("Calibration anchor adjusted");
    }
    if (vertexPressRef.current) {
      const press = vertexPressRef.current; const shape = shapes.find((item) => item.id === press.shapeId);
      if (!press.moved && shape && !shape.closed && (press.index === 0 || press.index === shape.points.length - 1)) { setExtendAnchor({ shapeId: shape.id, atStart: press.index === 0 }); notify("Endpoint armed / click canvas to extend"); }
      else if (press.moved) {
        if (press.snap?.topology) {
          setShapes((current) => {
            const edited = current.find((item) => item.id === press.shapeId);
            if (!edited) return current;
            const others = current.filter((item) => item.id !== press.shapeId);
            const reconciled = reconcileIncomingShapes(others, [edited], {
              tolerance: Math.max(3, 14 / transformRef.current.scale),
            }).shapes as Shape[];
            return reconciled.map((shape) => shape.id === edited.id
              ? remapAndSanitizeDiagonals(edited, shape)
              : sanitizeDiagonals(shape));
          });
        }
        pushHistory(press.before);
        notify(`${press.linked ? "Linked geometry moved" : "Selected plot detached and moved"} / measurements recalculated`);
      }
      vertexPressRef.current = null;
      setMagnifier(null);
      setSnapKind("RAW");
    }
    if (panRef.current) panRef.current = null;
    if (eraserPressRef.current?.pointerId === event.pointerId) {
      const press = eraserPressRef.current;
      eraserPressRef.current = null;
      setActiveEraserStroke(null);
      pushHistory(press.before);
      setEraserStrokes((current) => [...current, press.stroke]);
      advanceRasterRevision();
      notify("Map pixels erased / detection raster updated");
      return;
    }
    if (pickPressRef.current?.pointerId === event.pointerId) {
      const point = pickPressRef.current.point;
      pickPressRef.current = null;
      if (tool === "line-pick") void pickLine(point);
      else void pickPlot(point);
      return;
    }
    if (boxStartRef.current && draftBox && draftBox.width > 6 && draftBox.height > 6) {
      if (tool === "roi") {
        const completedRoi = { ...draftBox };
        setRoi(completedRoi);
        notify("ROI mapped / vectorization started automatically");
        void autoVectorize(completedRoi);
      }
      else if (calibrationMode === "auto") createAutoCalibrationLines(draftBox);
    }
    boxStartRef.current = null; setDraftBox(null);
    if (tracePressRef.current?.pointerId === event.pointerId) {
      const committedPoint = magnifier?.snapped ?? tracePressRef.current.raw;
      addManualPoint(committedPoint, Boolean(magnifier));
      tracePressRef.current = null;
      setMagnifier(null);
    }
  };

  const pathsToShapes = useCallback((result: VectorizationResult): Shape[] => {
    const stamp = Date.now();
    const inverseScale = 1 / documentRaster.processingScale;
    return result.paths.map((path, index) => {
      const id = `upload-contour-${stamp}-${index}`;
      const points = path.points.map((point) => ({ x: point.x * inverseScale, y: point.y * inverseScale }));
      return {
        id,
        name: `Detected parcel ${index + 1}`,
        source: "Auto",
        closed: path.closed,
        color: SHAPE_PALETTE[index % SHAPE_PALETTE.length],
        visible: true,
        diagonals: [],
        points,
        nodeIds: points.map((_, pointIndex) => `${id}:node:${pointIndex}`),
      };
    });
  }, [documentRaster.processingScale]);

  const autoVectorize = async (roiOverride?: Box) => {
    if (mapSource === "none") { notify("Upload a map before vectorizing"); return; }
    const activeRoi = roiOverride ?? roi;
    const isRoiMerge = Boolean(activeRoi) && roiBehavior === "merge";
    const availableShapeSlots = isRoiMerge ? MAX_WORKSPACE_SHAPES - shapes.length : MAX_WORKSPACE_SHAPES;
    if (availableShapeSlots <= 0) { notify("Workspace has reached the 500-object safety limit"); return; }
    if (!isRoiMerge && shapes.length && !window.confirm(`${activeRoi ? "ROI detection" : "Auto-Vectorize"} will replace the current vector layer. Continue?`)) return;
    const revisionAtStart = mapRevisionRef.current;
    const generationAtStart = detectionGenerationRef.current;
    const roiAtStart: Box = activeRoi ? { ...activeRoi } : { x: 0, y: 0, width: DOC_W, height: DOC_H };
    if (processing) return;
    setProcessing(true);
    try {
      const scale = documentRaster.processingScale;
      const processingRoi = {
        x: roiAtStart.x * scale,
        y: roiAtStart.y * scale,
        width: roiAtStart.width * scale,
        height: roiAtStart.height * scale,
      };
      const result = await requestWorker({
        type: activeRoi ? "vectorize-roi" : "vectorize-all",
        revision: revisionAtStart,
        roi: activeRoi ? processingRoi : undefined,
        maxShapes: availableShapeSlots,
      }) as VectorizationResult;
      const detected = pathsToShapes(result).map((shape, index) => ({
        ...shape,
        color: SHAPE_PALETTE[((isRoiMerge ? shapes.length : 0) + index) % SHAPE_PALETTE.length],
      }));
      const capHit = result.diagnostics.capHit;
      if (mapRevisionRef.current !== revisionAtStart || detectionGenerationRef.current !== generationAtStart) {
        notify("Vectorization cancelled because the active raster changed");
        return;
      }
      pushHistory();
      const uniqueDetected = isRoiMerge
        ? detected.filter((candidate) => !shapes.some((shape) => shape.closed && shapesMatch(shape.points, candidate.points)))
        : detected;
      const reconciled = reconcileIncomingShapes(isRoiMerge ? shapes : [], uniqueDetected, {
        tolerance: Math.max(3, result.diagnostics.estimatedStrokeWidth * 0.8),
      });
      setShapes(reconciled.shapes as Shape[]);
      setSelectedId(reconciled.added[0]?.id ?? (isRoiMerge ? selectedId : null));
      setExpanded((current) => ({
        ...(isRoiMerge ? current : {}),
        ...Object.fromEntries(reconciled.added.map((shape) => [shape.id, true])),
      }));
      setRoi(null); setTool("edit"); setProcessing(false);
      notify(capHit
        ? "500-shape safety cap reached—choose a tighter ROI or use Plot Pick for individual parcels"
        : reconciled.added.length
        ? `${reconciled.added.length} contour${reconciled.added.length === 1 ? "" : "s"} ${isRoiMerge ? "merged" : "extracted"} / ${reconciled.linkedEdges} shared edges synchronized${reconciled.conflicts ? ` / ${reconciled.conflicts} unsafe link skipped` : ""} / ROI cleared`
        : isRoiMerge && detected.length
        ? "ROI contains only parcels already registered / existing geometry preserved"
        : "No closed parcel found / ROI cleared / try a tighter ROI or manual trace");
    } catch (error) {
      if (mapRevisionRef.current !== revisionAtStart || detectionGenerationRef.current !== generationAtStart) return;
      notify(error instanceof Error ? `Vectorization failed: ${error.message}` : "Vectorization failed");
    } finally {
      if (detectionGenerationRef.current === generationAtStart) setProcessing(false);
    }
  };

  const pickPlot = async (point: Point) => {
    if (mapSource === "none") { notify("Upload a map before using Plot Pick"); return; }
    if (processing) { notify("Finish the current detection before picking another plot"); return; }
    if (shapes.length >= MAX_WORKSPACE_SHAPES) { notify("Workspace has reached the 500-object safety limit"); return; }
    const revisionAtStart = mapRevisionRef.current;
    const generationAtStart = detectionGenerationRef.current;
    const scale = documentRaster.processingScale;
    const processingRoi = roi ? {
      x: roi.x * scale,
      y: roi.y * scale,
      width: roi.width * scale,
      height: roi.height * scale,
    } : undefined;
    setPickSeed(point);
    setProcessing(true);
    try {
      const result = await requestWorker({
        type: "vectorize-seed",
        revision: revisionAtStart,
        point: { x: point.x * scale, y: point.y * scale },
        roi: processingRoi,
        searchRadius: Math.max(2, 20 / transformRef.current.scale * scale),
      }) as SeedVectorizationResult;
      if (revisionAtStart !== mapRevisionRef.current || detectionGenerationRef.current !== generationAtStart || (!result.ok && "reason" in result && result.reason === "cancelled")) return;
      if (!result.ok) {
        const messages: Record<string, string> = {
          outside: "Tap is outside the active ROI",
          ink_no_interior: "No plot interior found—tap inside the empty parcel area",
          open_boundary: "Closed boundary not found—tap nearer the plot centre, choose ROI, or use Manual Trace",
          too_small: "The enclosed region is too small to be a parcel",
          cancelled: "Plot Pick cancelled because the active raster changed",
        };
        const reason = "reason" in result ? result.reason : "";
        notify(messages[reason] || "Plot Pick failed");
        return;
      }
      const points = result.path.points.map((candidate) => ({ x: candidate.x / scale, y: candidate.y / scale }));
      const existing = shapes.find((shape) => shape.closed && shapesMatch(shape.points, points));
      if (existing) {
        setSelectedId(existing.id);
        setExpanded((current) => ({ ...current, [existing.id]: true }));
        notify(`${existing.name} is already registered / existing shape selected`);
        return;
      }
      const id = `picked-parcel-${revisionAtStart}-${workerRequestRef.current}`;
      const picked: Shape = {
        id,
        name: `Picked parcel ${shapes.filter((shape) => shape.source === "Tap Pick").length + 1}`,
        source: "Tap Pick",
        points,
        nodeIds: points.map((_, index) => `${id}:node:${index}`),
        closed: true,
        color: SHAPE_PALETTE[shapes.length % SHAPE_PALETTE.length],
        visible: true,
        diagonals: [],
      };
      const reconciled = reconcileIncomingShapes(shapes, [picked], {
        tolerance: Math.max(3, result.path.centerlineAdjusted ? 10 : 7),
      });
      pushHistory();
      setShapes(reconciled.shapes as Shape[]);
      setSelectedId(id);
      setSelectedSegment(null);
      setExpanded((current) => ({ ...current, [id]: true }));
      notify(`Plot boundary detected / ${reconciled.linkedEdges} shared edges synchronized${reconciled.conflicts ? " / one unsafe link left independent" : ""}`);
    } catch (error) {
      if (revisionAtStart !== mapRevisionRef.current || detectionGenerationRef.current !== generationAtStart) return;
      notify(error instanceof Error ? `Plot Pick failed: ${error.message}` : "Plot Pick failed");
    } finally {
      if (revisionAtStart === mapRevisionRef.current && detectionGenerationRef.current === generationAtStart) setProcessing(false);
      setPickSeed(null);
    }
  };

  const pickLine = async (point: Point) => {
    if (mapSource === "none") { notify("Upload a map before using Pick Line(s)"); return; }
    if (processing) { notify("Finish the current detection before picking another line"); return; }
    if (shapes.length >= MAX_WORKSPACE_SHAPES) { notify("Workspace has reached the 500-object safety limit"); return; }
    const revisionAtStart = mapRevisionRef.current;
    const generationAtStart = detectionGenerationRef.current;
    const scale = documentRaster.processingScale;
    const processingRoi = roi ? {
      x: roi.x * scale,
      y: roi.y * scale,
      width: roi.width * scale,
      height: roi.height * scale,
    } : undefined;
    setPickSeed(point);
    setProcessing(true);
    try {
      const result = await requestWorker({
        type: "vectorize-line-seed",
        revision: revisionAtStart,
        point: { x: point.x * scale, y: point.y * scale },
        roi: processingRoi,
        searchRadius: Math.max(2, 20 / transformRef.current.scale * scale),
      }) as LineSeedVectorizationResult;
      if (revisionAtStart !== mapRevisionRef.current || detectionGenerationRef.current !== generationAtStart || (!result.ok && "reason" in result && result.reason === "cancelled")) return;
      if (!result.ok) {
        const messages: Record<string, string> = {
          no_ink: "No raster line found within 20 screen pixels",
          too_short: "The detected mark is too short or noisy to register as a line",
          ambiguous_junction: "Ambiguous junction—tap farther from the intersection",
          cancelled: "Line Pick cancelled because the active raster changed",
        };
        const reason = "reason" in result ? result.reason : "";
        notify(messages[reason] || "Line Pick failed");
        return;
      }
      const points = result.path.points.map((candidate) => ({ x: candidate.x / scale, y: candidate.y / scale }));
      const duplicate = shapes.find((shape) => {
        if (shape.closed || shape.points.length < 2) return false;
        const direct = distance(shape.points[0], points[0]) + distance(shape.points.at(-1)!, points.at(-1)!);
        const reverse = distance(shape.points[0], points.at(-1)!) + distance(shape.points.at(-1)!, points[0]);
        return Math.min(direct, reverse) <= Math.max(8, 12 / transformRef.current.scale);
      });
      if (duplicate) {
        selectShape(duplicate.id);
        setExpanded((current) => ({ ...current, [duplicate.id]: true }));
        notify(`${duplicate.name} is already registered / existing line selected`);
        return;
      }
      const id = `line-pick-${revisionAtStart}-${workerRequestRef.current}`;
      const line: Shape = {
        id,
        name: `Picked line ${shapes.filter((shape) => shape.source === "Line Pick").length + 1}`,
        source: "Line Pick",
        points,
        nodeIds: points.map((_, index) => `${id}:node:${index}`),
        closed: false,
        color: SHAPE_PALETTE[shapes.length % SHAPE_PALETTE.length],
        visible: true,
        diagonals: [],
      };
      const reconciled = reconcileIncomingShapes(shapes, [line], { tolerance: Math.max(3, 10 / transformRef.current.scale) });
      pushHistory();
      setShapes(reconciled.shapes as Shape[]);
      setSelectedId(id);
      setExpanded((current) => ({ ...current, [id]: true }));
      notify(`Open centreline registered / ${reconciled.linkedEdges} endpoint link${reconciled.linkedEdges === 1 ? "" : "s"}`);
    } catch (error) {
      if (revisionAtStart !== mapRevisionRef.current || detectionGenerationRef.current !== generationAtStart) return;
      notify(error instanceof Error ? `Line Pick failed: ${error.message}` : "Line Pick failed");
    } finally {
      if (revisionAtStart === mapRevisionRef.current && detectionGenerationRef.current === generationAtStart) setProcessing(false);
      setPickSeed(null);
    }
  };

  const loadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const loadToken = ++rasterLoadTokenRef.current;
    const nextRevision = mapRevisionRef.current + 1;
    mapRevisionRef.current = nextRevision;
    setMapRevision(nextRevision);
    resetTransientEditorState();
    restartVectorWorker();
    retainedBitmapRef.current?.close();
    retainedBitmapRef.current = null;
    rasterSourceRef.current = null;
    const display = mapCanvasRef.current;
    const memory = ensureProcessingCanvas();
    display?.getContext("2d")?.clearRect(0, 0, display.width, display.height);
    memory.getContext("2d")?.clearRect(0, 0, memory.width, memory.height);
    setMapSource("none"); setMapVisible(false);
    setShapes([]); setSelectedIds([]); setSelectedSegment(null); setManualPoints([]); setEraserStrokes([]); setActiveEraserStroke(null); setRoi(null); setExpanded({}); cancelCalibration();
    resetHistory();

    let bitmap: ImageBitmap | null = null;
    try {
      let source: CanvasImageSource;
      let sourceWidth: number;
      let sourceHeight: number;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = Math.ceil(viewport.width); pageCanvas.height = Math.ceil(viewport.height);
        const pageContext = pageCanvas.getContext("2d", { alpha: false });
        if (!pageContext) throw new Error("PDF canvas context unavailable");
        await page.render({ canvas: pageCanvas, canvasContext: pageContext, viewport }).promise;
        source = pageCanvas; sourceWidth = pageCanvas.width; sourceHeight = pageCanvas.height;
        await pdf.destroy();
      } else {
        if (!file.type.startsWith("image/")) throw new Error("Unsupported file type");
        bitmap = await createImageBitmap(file);
        source = bitmap; sourceWidth = bitmap.width; sourceHeight = bitmap.height;
      }
      if (loadToken !== rasterLoadTokenRef.current) { bitmap?.close(); return; }

      const processingScale = Math.min(1, Math.sqrt(MAX_PROCESSING_PIXELS / (sourceWidth * sourceHeight)));
      const processingWidth = Math.max(1, Math.round(sourceWidth * processingScale));
      const processingHeight = Math.max(1, Math.round(sourceHeight * processingScale));
      memory.width = processingWidth; memory.height = processingHeight;
      const context = memory.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Processing canvas context unavailable");
      context.clearRect(0, 0, processingWidth, processingHeight);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, processingWidth, processingHeight);
      context.imageSmoothingEnabled = processingScale < 1;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, processingWidth, processingHeight);
      retainedBitmapRef.current = bitmap;
      rasterSourceRef.current = source;
      setDocumentRaster({
        nativeWidth: sourceWidth,
        nativeHeight: sourceHeight,
        processingWidth,
        processingHeight,
        processingScale,
        revision: nextRevision,
      });
      setMapSource("upload"); setMapVisible(true);
      hasFittedRef.current = false;
      window.requestAnimationFrame(fitDocument);
      notify(isPdf
        ? `PDF page 1 loaded at ${processingWidth}×${processingHeight} processing resolution`
        : processingScale === 1
          ? `Uploaded image preserved at native ${sourceWidth}×${sourceHeight} resolution`
          : `Large image safely processed at ${processingWidth}×${processingHeight} (${Math.round(processingScale * 100)}%)`);
    } catch (error) {
      if (bitmap && retainedBitmapRef.current !== bitmap) bitmap.close();
      if (loadToken !== rasterLoadTokenRef.current) return;
      setMapSource("none"); setMapVisible(false);
      notify(error instanceof Error ? `Map load failed: ${error.message}` : "Map load failed");
    }
  };

  const removeMap = () => {
    rasterLoadTokenRef.current += 1;
    const nextRevision = mapRevisionRef.current + 1;
    mapRevisionRef.current = nextRevision;
    setMapRevision(nextRevision);
    resetTransientEditorState();
    restartVectorWorker();
    retainedBitmapRef.current?.close(); retainedBitmapRef.current = null; rasterSourceRef.current = null;
    const display = mapCanvasRef.current; const memory = ensureProcessingCanvas(); display?.getContext("2d")?.clearRect(0, 0, display.width, display.height); memory.getContext("2d")?.clearRect(0, 0, memory.width, memory.height);
    setMapSource("none"); setMapVisible(false); setEraserStrokes([]); setActiveEraserStroke(null); setRoi(null); resetHistory(); cancelCalibration(); notify("Map removed from canvas and processing memory / vectors preserved");
  };

  const clearAll = () => {
    if (!window.confirm("Permanently delete all vector shapes?")) return;
    pushHistory();
    resetTransientEditorState();
    setShapes([]);
    setSelectedIds([]);
    setSelectedSegment(null);
    setManualPoints([]);
    setExpanded({});
    notify("All vector objects deleted");
  };

  const exportFile = (kind: "svg" | "dxf", ids?: string[]) => {
    const exportShapes = ids ? shapes.filter((shape) => ids.includes(shape.id)) : shapes;
    if (!exportShapes.length) { notify("Select at least one vector object to export"); return; }
    const content = kind === "svg"
      ? buildSvgExport(exportShapes, DOC_W, DOC_H)
      : buildDxfExport(exportShapes, DOC_H, pxPerUnit);
    const url = URL.createObjectURL(new Blob([content])); const link = document.createElement("a"); link.href = url; link.download = `vectrasurvey${ids ? "-selection" : ""}.${kind}`; link.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      const key = event.key.toLowerCase(); const shortcuts: Record<string, Tool> = { v: "select", h: "pan", r: "roi", p: "pick", l: "line-pick", e: "edit", t: "manual", g: "diagonal", x: "erase-map", d: "delete" }; if (key === "c") setCalibrationLauncherOpen(true); else if (shortcuts[key]) setTool(shortcuts[key]);
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length) deleteSelectedShapes();
      if (event.key === "Escape") { setManualPoints([]); setExtendAnchor(null); setMagnifier(null); setPickSeed(null); setLinkSource(null); setDiagonalStart(null); pickPressRef.current = null; }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [deleteSelectedShapes, redo, selectedIds.length, undo]);

  const runDetectAction = (action: "auto" | "roi" | "pick" | "line-pick") => {
    setLastDetectAction(action);
    closeTopbarMenus();
    if (action === "auto") void autoVectorize();
    else if (action === "roi") setTool("roi");
    else { setTool(action); setPickSeed(null); }
  };
  const detectLabel = lastDetectAction === "auto" ? "Auto-Vectorize" : lastDetectAction === "roi" ? "ROI Select" : lastDetectAction === "pick" ? "Plot Pick" : "Pick Line(s)";
  const detectIcon = lastDetectAction === "auto" ? <Sparkles size={15} /> : lastDetectAction === "roi" ? <BoxSelect size={15} /> : lastDetectAction === "pick" ? <Crosshair size={15} /> : <ScanLine size={15} />;

  const visibleRoi = draftBox && tool === "roi" ? draftBox : roi;
  const validCalibrationLines = calibrationLines.filter((line) => Number(line.actual) > 0);
  const calibrationPreviewAverage = averagePixelsPerUnit(validCalibrationLines);

  return (
    <main className="cad-app theme-light">
      <header className="cad-header">
        <button type="button" className="cad-icon-button" onClick={() => navigate("/dashboard")} title="Back to Dashboard" style={{ marginRight: 4 }}>
          <ArrowLeft size={18} />
        </button>
        <div className="cad-brand" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
          <img src="/assets/plotscale_logo_primary.svg" alt="PlotScale" style={{ width: 28, height: 28 }} />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <strong style={{ fontFamily: "Montserrat, system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.02em" }}>
              Plot<span style={{ color: "#22c55e" }}>Scale</span>
            </strong>
            <small style={{ fontSize: 9, fontWeight: 700, color: "#2563eb", letterSpacing: "0.12em", marginTop: 2 }}>IMAGE TRACE</small>
          </span>
        </div>
        <div className="toolbar-rail">
          <button type="button" className="toolbar-scroll-button toolbar-scroll-left" onClick={() => scrollToolbar(-1)} disabled={!toolbarScroll.canLeft} aria-label="Show previous tools" title="Previous tools"><ChevronLeft size={17} /></button>
          <div ref={toolbarRef} className={`cad-toolbar ${mobileToolsOpen ? "is-mobile-expanded" : ""}`} role="toolbar" aria-label="Vector tools" tabIndex={0} onScroll={updateToolbarScroll} onWheel={handleToolbarWheel} onKeyDown={handleToolbarKeyDown}>
          <div className="select-split topbar-popover">
            <button type="button" className={`cad-tool select-primary ${tool === "select" ? "is-active" : ""}`} onClick={() => { closeTopbarMenus(); setTool("select"); }}><MousePointer2 size={15} /><span>{selectionMode === "multi" ? "Multi Select" : "Select"}</span></button>
            <button type="button" className="select-toggle" aria-label="Choose selection mode" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const next = !selectMenuOpen; closeTopbarMenus(); setSelectMenuOpen(next); }}><ChevronDown size={14} /></button>
            {selectMenuOpen && <TopbarMenuPortal className="select-menu">
              <button className={selectionMode === "single" ? "is-active" : ""} onClick={() => { setSelectionMode("single"); setSelectMenuOpen(false); }}><MousePointer2 size={14} /><span><b>Single</b><small>Replace the current selection</small></span></button>
              <button className={selectionMode === "multi" ? "is-active" : ""} onClick={() => { setSelectionMode("multi"); setSelectMenuOpen(false); }}><Layers3 size={14} /><span><b>Multi</b><small>Tap repeatedly to toggle plots</small></span></button>
            </TopbarMenuPortal>}
          </div>
          <div className="detect-split topbar-popover">
            <button type="button" className={`cad-tool detect-primary ${processing || tool === "roi" || tool === "pick" || tool === "line-pick" ? "is-active" : ""}`} onClick={() => runDetectAction(lastDetectAction)}><span>{detectIcon}</span><span>{processing ? "Detecting" : detectLabel}</span></button>
            <button type="button" className="detect-toggle" aria-label="Choose detection mode" aria-expanded={detectMenuOpen} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const next = !detectMenuOpen; closeTopbarMenus(); setDetectMenuOpen(next); }}><ChevronDown size={14} /></button>
            {detectMenuOpen && <TopbarMenuPortal className="detect-menu">
              <button onClick={() => runDetectAction("pick")}><Crosshair size={15} /><span><b>Plot Pick</b><small>Tap inside one parcel</small></span></button>
              <button onClick={() => runDetectAction("line-pick")}><ScanLine size={15} /><span><b>Pick Line(s)</b><small>Tap raster ink for one open centreline</small></span></button>
              <button title="Region of Interest — process only the selected map area" onClick={() => runDetectAction("roi")}><BoxSelect size={15} /><span><b>ROI Select</b><small>Region of Interest — process only the selected map area</small></span></button>
              <button onClick={() => runDetectAction("auto")}><Sparkles size={15} /><span><b>Auto-Vectorize</b><small>Whole page or selected ROI</small></span></button>
              <div className="detect-options">
                <span>ROI RESULT</span>
                <button className={roiBehavior === "merge" ? "is-active" : ""} onClick={() => setRoiBehavior("merge")}>Merge</button>
                <button className={roiBehavior === "replace" ? "is-active" : ""} onClick={() => setRoiBehavior("replace")}>Replace</button>
              </div>
            </TopbarMenuPortal>}
          </div>
          <button type="button" className={`cad-tool mobile-secondary mobile-detect-action ${tool === "pick" ? "is-active" : ""}`} onClick={() => runDetectAction("pick")}><Crosshair size={15} /><span>Plot Pick</span></button>
          <button type="button" className={`cad-tool mobile-secondary mobile-detect-action ${tool === "line-pick" ? "is-active" : ""}`} onClick={() => runDetectAction("line-pick")}><ScanLine size={15} /><span>Pick Line(s)</span></button>
          <button type="button" className={`cad-tool mobile-secondary mobile-detect-action ${tool === "roi" ? "is-active" : ""}`} onClick={() => runDetectAction("roi")}><BoxSelect size={15} /><span>ROI Select</span></button>
          <button type="button" className={`cad-tool mobile-secondary mobile-detect-action ${processing ? "is-active" : ""}`} onClick={() => runDetectAction("auto")}><Sparkles size={15} /><span>Auto-Vectorize</span></button>
          <button type="button" className="cad-tool mobile-map-tool mobile-secondary" onClick={() => fileRef.current?.click()} title="Upload Map"><FileUp size={15} /><span>Upload Map</span></button>
          <button type="button" className="cad-tool mobile-map-tool mobile-secondary" onClick={() => setMapVisible((visible) => !visible)} disabled={mapSource === "none"} title={mapVisible ? "Hide Map" : "Show Map"}>{mapVisible ? <EyeOff size={15} /> : <Eye size={15} />}<span>{mapVisible ? "Hide Map" : "Show Map"}</span></button>
          <button type="button" className="cad-tool mobile-map-tool mobile-secondary is-danger" onClick={removeMap} disabled={mapSource === "none"} title="Clear Map"><ImageOff size={15} /><span>Clear Map</span></button>
          <ToolButton label="Manual Trace" active={tool === "manual"} icon={<PencilLine size={15} />} onClick={() => { setTool("manual"); setManualPoints([]); setExtendAnchor(null); }} />
          <ToolButton label="Vertex Edit" active={tool === "edit"} icon={<CircleDot size={15} />} onClick={() => setTool("edit")} />
          <ToolButton className="mobile-secondary" label="Map Eraser" active={tool === "erase-map"} icon={<Eraser size={15} />} onClick={() => { if (mapSource === "none") notify("Upload a map before using Map Eraser"); else { setMapVisible(true); setTool("erase-map"); } }} />
          <ToolButton className="mobile-secondary" label={magnifierEnabled ? "Lens On" : "Lens Off"} active={magnifierEnabled} icon={<ZoomIn size={15} />} onClick={toggleMagnifier} />
          <ToolButton className="mobile-secondary" label="Add Diagonal" active={tool === "diagonal"} icon={<ScanLine size={15} />} onClick={() => { setTool("diagonal"); setDiagonalStart(null); notify("Select a plot, then click two non-adjacent vertices"); }} />
          <div className="snap-split topbar-popover mobile-secondary">
            <button type="button" className={`cad-tool snap-primary ${snapSettings.enabled ? "is-active" : ""}`} onClick={() => { closeTopbarMenus(); setSnapSettings((current) => ({ ...current, enabled: !current.enabled })); }} aria-pressed={snapSettings.enabled}>
              <span><Crosshair size={15} /></span><span>{snapSettings.enabled ? "Smart Snap" : "Snap Off"}</span>
            </button>
            <button type="button" className="snap-toggle" aria-label="Configure Smart Snap" aria-expanded={snapMenuOpen} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const next = !snapMenuOpen; closeTopbarMenus(); setSnapMenuOpen(next); }}><ChevronDown size={14} /></button>
            {snapMenuOpen && <TopbarMenuPortal className="snap-menu">
              <header><b>SMART SNAP</b><small>Manual Trace + Vertex Edit</small></header>
              {shapes.length > 1 ? <>{([
                ["mapInk", "Map Ink", "Track the darkest stroke centroid"],
                ["vertices", "Existing Vertices", "Reuse canonical neighboring nodes"],
                ["edges", "Existing Edges", "Project onto shared boundaries"],
              ] as const).map(([key, label, description]) => <label key={key}>
                <input type="checkbox" checked={snapSettings[key]} onChange={(event) => setSnapSettings((current) => ({ ...current, [key]: event.target.checked }))} />
                <span><b>{label}</b><small>{description}</small></span>
              </label>)}
              <div className="linked-edit-setting">
                <span>LINKED EDIT</span>
                <button className={snapSettings.linkedEdit === "all" ? "is-active" : ""} onClick={() => setSnapSettings((current) => ({ ...current, linkedEdit: "all" }))}>All linked</button>
                <button className={snapSettings.linkedEdit === "selected" ? "is-active" : ""} onClick={() => setSnapSettings((current) => ({ ...current, linkedEdit: "selected" }))}>Selected only</button>
                <small>Alt/Option reverses this mode for one drag.</small>
              </div>
              </> : <div className="snap-context-note"><b>Context options hidden</b><small>Map Ink, Existing Vertices and Existing Edges appear after a second vector object is added.</small></div>}
            </TopbarMenuPortal>}
          </div>
          <ToolButton className="mobile-secondary" label={verticesVisible ? "Vertices On" : "Vertices Off"} active={verticesVisible} icon={verticesVisible ? <Eye size={15} /> : <EyeOff size={15} />} onClick={() => setVerticesVisible((visible) => !visible)} />
          <div className="labels-split topbar-popover mobile-secondary">
            <button type="button" className={`cad-tool ${labelVisibility.length || labelVisibility.area ? "is-active" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const next = !labelsMenuOpen; closeTopbarMenus(); setLabelsMenuOpen(next); }}><Ruler size={15} /><span>Labels</span><ChevronDown size={13} /></button>
            {labelsMenuOpen && <TopbarMenuPortal className="labels-menu">
              <label><input type="checkbox" checked={labelVisibility.length} onChange={(event) => setLabelVisibility((current) => ({ ...current, length: event.target.checked }))} /><span>Length Labels</span></label>
              <label><input type="checkbox" checked={labelVisibility.area} onChange={(event) => setLabelVisibility((current) => ({ ...current, area: event.target.checked }))} /><span>Area Labels</span></label>
            </TopbarMenuPortal>}
          </div>
          <ToolButton className="mobile-secondary" label="Scale Calibrate" active={tool === "calibrate"} icon={<Ruler size={15} />} onClick={() => setCalibrationLauncherOpen(true)} />
          <ToolButton className="mobile-secondary" label="Delete Mode" danger active={tool === "delete"} icon={<Trash2 size={15} />} onClick={() => setTool("delete")} />
          <ToolButton className="mobile-secondary" label="Clear All" danger icon={<Trash2 size={15} />} onClick={clearAll} />
          <button type="button" className={`cad-tool mobile-more-tool ${mobileToolsOpen ? "is-active" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectMenuOpen(false); setDetectMenuOpen(false); setSnapMenuOpen(false); setLabelsMenuOpen(false); setMobileToolsOpen((open) => !open); }} aria-expanded={mobileToolsOpen} title="More tools"><Menu size={15} /><span>More</span></button>
          </div>
          <button type="button" className="toolbar-scroll-button toolbar-scroll-right" onClick={() => scrollToolbar(1)} disabled={!toolbarScroll.canRight} aria-label="Show more tools" title="More tools"><ChevronRight size={17} /></button>
        </div>
        <div className="cad-header-actions">
          <button className="cad-icon-button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)"><Undo2 size={17} /></button>
          <button className="cad-icon-button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"><Redo2 size={17} /></button>
          <button className="cad-icon-button" onClick={() => fileRef.current?.click()} title="Upload map image or PDF"><FileUp size={17} /></button><input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" hidden onChange={loadImage} />
          <button className="cad-icon-button" onClick={() => setMapVisible((visible) => !visible)} disabled={mapSource === "none"} title={mapVisible ? "Hide background map" : "Show background map"}>{mapVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          <button className="cad-icon-button danger-icon" onClick={removeMap} disabled={mapSource === "none"} title="Clear background image from canvas and processing memory"><ImageOff size={17} /></button>
          <button className="cad-icon-button sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={18} /></button>
        </div>
      </header>

      <section className="cad-shell">
        <div
          ref={viewerRef}
          className="interactive-viewer"
          onPointerDownCapture={handleViewerPointerDownCapture}
          onPointerMoveCapture={handleViewerPointerMoveCapture}
          onPointerUpCapture={handleViewerPointerUpCapture}
          onPointerCancelCapture={handleViewerPointerUpCapture}
        >
          <div className="cad-grid" />
          <div className="zoom-controls">
            <button onClick={() => zoomAtViewerCenter(1.2)} title="Zoom in" aria-label="Zoom in"><ZoomIn size={15} /></button>
            <b>{Math.round(transform.scale * 100)}%</b>
            <button onClick={() => zoomAtViewerCenter(1 / 1.2)} title="Zoom out" aria-label="Zoom out"><ZoomOut size={15} /></button>
            <button onClick={fitDocument} title="Fit document" aria-label="Fit document"><Focus size={15} /></button>
            <button onClick={focusSelectedShape} disabled={!selectedId} title="Focus selected shape" aria-label="Focus selected shape"><Crosshair size={15} /></button>
          </div>

          <canvas ref={mapCanvasRef} className="map-layer" aria-label="Background map layer" />
          <svg className={`vector-layer cursor-${tool}`} aria-label="Vector editing layer" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
            <g transform={`matrix(${transform.scale},0,0,${transform.scale},${transform.x},${transform.y})`}>
              {visibleRoi && <g className="roi-box"><rect x={visibleRoi.x} y={visibleRoi.y} width={visibleRoi.width} height={visibleRoi.height} /><text x={visibleRoi.x + 8 / transform.scale} y={visibleRoi.y + 17 / transform.scale} fontSize={10 / transform.scale}>ROI / PIXEL LOCKED</text></g>}
              {calibrationRegion && <rect className="calibration-box" x={calibrationRegion.x} y={calibrationRegion.y} width={calibrationRegion.width} height={calibrationRegion.height} />}
              {draftBox && tool === "calibrate" && <rect className="calibration-box" x={draftBox.x} y={draftBox.y} width={draftBox.width} height={draftBox.height} />}
              {calibrationLines.map((line) => <g className={`calibration-helper kind-${line.kind}`} key={line.id}>
                <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} />
                <circle cx={line.a.x} cy={line.a.y} r={8 / transform.scale} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); calibrationDragRef.current = { lineId: line.id, endpoint: "a", before: captureEditorSnapshot() }; }} />
                <circle cx={line.b.x} cy={line.b.y} r={8 / transform.scale} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); calibrationDragRef.current = { lineId: line.id, endpoint: "b", before: captureEditorSnapshot() }; }} />
              </g>)}
              {draftCalibrationLine && <line className="draft-calibration-line" x1={draftCalibrationLine.a.x} y1={draftCalibrationLine.a.y} x2={draftCalibrationLine.b.x} y2={draftCalibrationLine.b.y} />}
              {pickSeed && <g className="pick-seed" transform={`translate(${pickSeed.x} ${pickSeed.y})`}><circle r={12 / transform.scale} /><path d={`M ${-18 / transform.scale} 0 H ${18 / transform.scale} M 0 ${-18 / transform.scale} V ${18 / transform.scale}`} /></g>}
              {activeEraserStroke && <circle className="eraser-brush-preview" cx={activeEraserStroke.points.at(-1)!.x} cy={activeEraserStroke.points.at(-1)!.y} r={activeEraserStroke.radius} />}

              {shapes.map((shape) => {
                if (!shape.visible) return null;
                const selected = selectedId === shape.id;
                const secondarySelected = selectedIds.includes(shape.id) && !selected;
                const anySelected = selected || secondarySelected;
                const c = centroid(shape.points); const path = `M ${shape.points.map((p) => `${p.x} ${p.y}`).join(" L ")}${shape.closed ? " Z" : ""}`;
                return <g key={shape.id} onContextMenu={(event) => { event.preventDefault(); deleteShape(shape.id); }}>
                  <path d={path} fill={shape.closed ? `${shape.color}${anySelected ? "4d" : "0d"}` : "none"} stroke="none" />
                  {segmentPairs(shape).map((segment) => {
                    const active = selectedSegment?.shapeId === shape.id && selectedSegment.index === segment.index;
                    const calibrationActive = calibrationLines.some((line) => line.shapeId === shape.id && line.segmentIndex === segment.index);
                    const mid = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
                    const visualOffset = sharedVisualOffset(shape, segment.index, shapes, 1.25, transform.scale, topology);
                    const visualA = { x: segment.a.x + visualOffset.x, y: segment.a.y + visualOffset.y };
                    const visualB = { x: segment.b.x + visualOffset.x, y: segment.b.y + visualOffset.y };
                    return <g key={`${shape.id}-seg-${segment.index}`}>
                      {selected && <line x1={visualA.x} y1={visualA.y} x2={visualB.x} y2={visualB.y} stroke="#ffffff" strokeWidth={7} vectorEffect="non-scaling-stroke" opacity={.34} />}
                      {secondarySelected && <line x1={visualA.x} y1={visualA.y} x2={visualB.x} y2={visualB.y} stroke={shape.color} strokeWidth={5} vectorEffect="non-scaling-stroke" opacity={.32} />}
                      <line x1={visualA.x} y1={visualA.y} x2={visualB.x} y2={visualB.y} stroke={shape.color} strokeWidth={anySelected ? 3.2 : visualOffset.shared ? 1.8 : 2.2} vectorEffect="non-scaling-stroke" className={visualOffset.shared ? "shared-boundary-rail" : undefined} />
                      <line x1={segment.a.x} y1={segment.a.y} x2={segment.b.x} y2={segment.b.y} stroke="transparent" strokeWidth={20} vectorEffect="non-scaling-stroke" className="segment-hit" onPointerDown={(event) => handleSegmentPointerDown(event, shape, segment.index)} />
                      {(active || calibrationActive) && <><line x1={segment.a.x} y1={segment.a.y} x2={segment.b.x} y2={segment.b.y} stroke="#061013" strokeWidth={7} vectorEffect="non-scaling-stroke" /><line x1={segment.a.x} y1={segment.a.y} x2={segment.b.x} y2={segment.b.y} stroke={calibrationActive ? "#c084fc" : "#ffd24a"} strokeWidth={4} vectorEffect="non-scaling-stroke" /></>}
                      {labelVisibility.length && (anySelected || active || calibrationActive) && <g className="measure-label" transform={`translate(${mid.x} ${mid.y})`}><rect x={-38 / transform.scale} y={-12 / transform.scale} width={76 / transform.scale} height={22 / transform.scale} /><text y={3 / transform.scale} fontSize={12 / transform.scale}>{formatLength(distance(segment.a, segment.b))}</text></g>}
                    </g>;
                  })}
                  {diagonalPairs(shape).map((diagonal) => {
                    const mid = { x: (diagonal.a.x + diagonal.b.x) / 2, y: (diagonal.a.y + diagonal.b.y) / 2 };
                    return <g key={diagonal.id} className="shape-diagonal">
                      {selected && <line className="diagonal-halo" x1={diagonal.a.x} y1={diagonal.a.y} x2={diagonal.b.x} y2={diagonal.b.y} />}
                      <line className="diagonal-line" x1={diagonal.a.x} y1={diagonal.a.y} x2={diagonal.b.x} y2={diagonal.b.y} stroke={shape.color} />
                      <line className="diagonal-hit" x1={diagonal.a.x} y1={diagonal.a.y} x2={diagonal.b.x} y2={diagonal.b.y} onPointerDown={(event) => {
                        event.stopPropagation();
                        if (tool === "delete") deleteDiagonal(shape.id, diagonal.id);
                        else selectShape(shape.id);
                      }} />
                      {selected && labelVisibility.length && <g className="measure-label diagonal-label" transform={`translate(${mid.x} ${mid.y})`}><rect x={-38 / transform.scale} y={-12 / transform.scale} width={76 / transform.scale} height={22 / transform.scale} /><text y={3 / transform.scale} fontSize={12 / transform.scale}>{formatLength(distance(diagonal.a, diagonal.b))}</text></g>}
                    </g>;
                  })}
                  {shape.closed && anySelected && labelVisibility.area && <g className="area-label" transform={`translate(${c.x} ${c.y})`}><rect x={-55 / transform.scale} y={-15 / transform.scale} width={110 / transform.scale} height={28 / transform.scale} /><text y={4 / transform.scale} fontSize={13 / transform.scale}>{formatArea(polygonArea(shape.points))}</text></g>}
                  {verticesVisible && selected && (tool === "edit" || tool === "diagonal" || tool === "delete" || tool === "select" || (tool === "calibrate" && calibrationMode === "manual")) && shape.points.map((point, index) => <g key={`${shape.id}-v-${index}`} transform={`translate(${point.x} ${point.y})`} className={`vertex-handle ${extendAnchor?.shapeId === shape.id && ((extendAnchor.atStart && index === 0) || (!extendAnchor.atStart && index === shape.points.length - 1)) || diagonalStart?.shapeId === shape.id && diagonalStart.nodeId === shape.nodeIds[index] ? "is-armed" : ""}`} style={{ color: shape.color }} onPointerDown={(event) => handleVertexPointerDown(event, shape, index)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); deleteVertex(shape.id, index); }}>
                    <circle className="vertex-hit" r={16 / transform.scale} />
                    <circle className="vertex-ring" r={5 / transform.scale} />
                    <path className="vertex-reticle" d={`M ${-9 / transform.scale} 0 H ${9 / transform.scale} M 0 ${-9 / transform.scale} V ${9 / transform.scale}`} />
                    <rect className="vertex-pixel" x={-.5 / transform.scale} y={-.5 / transform.scale} width={1 / transform.scale} height={1 / transform.scale} />
                  </g>)}
                </g>;
              })}

              {manualPoints.length > 0 && <g className="manual-draft">
                <polyline points={manualPoints.map((p) => `${p.x},${p.y}`).join(" ")} />
                {manualPoints.map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y})`} className={`manual-vertex vertex-handle ${index === 0 ? "is-start" : ""}`} onPointerDown={(event) => { event.stopPropagation(); handleTraceVertex(index); }}>
                  <circle className="vertex-hit" r={16 / transform.scale} />
                  {index === 0 && <circle className="closure-ring" r={8 / transform.scale} />}
                  <circle className="vertex-ring" r={5 / transform.scale} />
                  <path className="vertex-reticle" d={`M ${-9 / transform.scale} 0 H ${9 / transform.scale} M 0 ${-9 / transform.scale} V ${9 / transform.scale}`} />
                  <rect className="vertex-pixel" x={-.5 / transform.scale} y={-.5 / transform.scale} width={1 / transform.scale} height={1 / transform.scale} />
                </g>)}
                {snapPreview && <>
                  <line x1={manualPoints.at(-1)!.x} y1={manualPoints.at(-1)!.y} x2={snapPreview.x} y2={snapPreview.y} />
                  <g className={`snap-target kind-${snapKind.toLowerCase()}`} transform={`translate(${snapPreview.x} ${snapPreview.y})`}>
                    <circle r={9 / transform.scale} />
                    <path d={`M ${-12 / transform.scale} 0 H ${12 / transform.scale} M 0 ${-12 / transform.scale} V ${12 / transform.scale}`} />
                    {snapKind !== "RAW" && <text x={12 / transform.scale} y={-10 / transform.scale} fontSize={10 / transform.scale}>{snapKind}</text>}
                  </g>
                </>}
              </g>}
            </g>
          </svg>

          {mapSource === "none" && !shapes.length && <div className="empty-workspace">
            <FileUp size={30} />
            <b>Upload a cadastral map</b>
            <span>Open a high-resolution image or PDF to start precise parcel detection and measurement.</span>
            <button onClick={() => fileRef.current?.click()}><FileUp size={15} /> Upload Map</button>
          </div>}

          {magnifier && <div className={`magnifier ${magnifier.kind === "vertex" ? "is-vertex" : ""}`}><canvas ref={magnifierCanvasRef} width="160" height="160" /><span className="magnifier-cross" /><span className="magnifier-pixel" /><div><b>{magnifier.kind === "vertex" ? `PRECISION VERTEX / ${snapKind}` : `SMART SNAP / ${snapKind}`}</b><small>X {magnifier.snapped.x.toFixed(1)} / Y {magnifier.snapped.y.toFixed(1)} / release to commit</small></div></div>}
          {tool === "pick" && <div className="mode-prompt pick"><Crosshair size={14} /><span>Tap inside a closed parcel to detect only that boundary / repeat to add more plots</span></div>}
          {tool === "line-pick" && <div className="mode-prompt pick"><ScanLine size={14} /><span>Tap near raster ink to trace one junction-to-junction centreline / repeat to add lines</span></div>}
          {tool === "erase-map" && <div className="mode-prompt eraser"><Eraser size={14} /><span>Drag over map lines or text to erase them from display and detection</span><label>Brush <input aria-label="Map eraser brush size" type="range" min="12" max="80" step="2" value={eraserSize} onChange={(event) => setEraserSize(Number(event.target.value))} /><b>{eraserSize}px</b></label></div>}
          {tool === "diagonal" && <div className="mode-prompt diagonal"><ScanLine size={14} /><span>{diagonalStart ? "First vertex fixed / click another non-adjacent vertex of the same plot" : "Select a plot, then click any two non-adjacent vertices / repeat for more diagonals"}</span>{diagonalStart && <button onClick={() => setDiagonalStart(null)}><X size={13} /> Cancel</button>}</div>}
          {tool === "manual" && <div className="mode-prompt"><PencilLine size={14} /><span>{manualPoints.length ? `${manualPoints.length} nodes / return within 15px of the first node to close / double-click to finish open` : "Tap near a dark line / long-press for magnifier"}</span>{manualPoints.length >= 2 && <button onClick={() => finishManual(manualPoints, false)}><Check size={13} /> Finish</button>}</div>}
          {extendAnchor && <div className="mode-prompt extend"><Plus size={14} /><span>Endpoint armed / click canvas to extend continuously</span><button onClick={() => setExtendAnchor(null)}><X size={13} /> Stop</button></div>}
          {linkSource && <div className="mode-prompt extend"><Link2 size={14} /><span>Relink target armed / tap a target vertex or edge</span><button onClick={() => setLinkSource(null)}><X size={13} /> Cancel</button></div>}
          {selectedIds.length > 1 && <div className="multi-selection-bar">
            <b>{selectedIds.length} SELECTED</b>
            <button className="merge" onClick={mergeSelectedPlots}><Layers3 size={13} /> Merge Plots</button>
            <label title="Batch colour"><input type="color" value={shapes.find((shape) => shape.id === selectedId)?.color ?? "#00ff87"} onChange={(event) => setSelectedColor(event.target.value)} /></label>
            <button onClick={() => setSelectedVisibility(true)}><Eye size={13} /> Show</button>
            <button onClick={() => setSelectedVisibility(false)}><EyeOff size={13} /> Hide</button>
            <button onClick={() => exportFile("svg", selectedIds)}><FileCode2 size={13} /> SVG</button>
            <button onClick={() => exportFile("dxf", selectedIds)}><Download size={13} /> DXF</button>
            <button className="danger" onClick={deleteSelectedShapes}><Trash2 size={13} /> Delete</button>
          </div>}
          {calibrationMode && <div className="calibration-dock">
            <header><span><Ruler size={15} /><b>{calibrationMode === "auto" ? "AUTO GRID CALIBRATION" : calibrationMode === "segments" ? "SHAPE LINE CALIBRATION" : "POINT-TO-POINT CALIBRATION"}</b></span><button onClick={cancelCalibration}><X size={14} /></button></header>
            <p>{calibrationMode === "auto"
              ? "Use any one detected baseline directly, or enter known lengths for up to three lines to average the scale."
              : calibrationMode === "segments"
                ? "Touch any detected or manual shape segment. Selected lines glow purple; touch again to deselect, then enter each known real length."
                : calibrationClickStart
                  ? "First point fixed. Click a second vector vertex, line point, or canvas point to capture this known distance."
                  : "Click the first point, then the second point. Nearby registered vector vertices snap exactly; repeat up to three times if needed."}</p>
            <div className="calibration-line-log">{calibrationLines.map((line, index) => <div key={line.id}><i>{index + 1}</i><span><b>{line.label}</b><small>{distance(line.a, line.b).toFixed(1)} px</small></span><input inputMode="decimal" placeholder={`Distance (${unit})`} value={line.actual} onFocus={() => pushHistory()} onChange={(event) => setCalibrationLines((current) => current.map((item) => item.id === line.id ? { ...item, actual: event.target.value } : item))} /><em>{Number(line.actual) > 0 ? `${(distance(line.a, line.b) / Number(line.actual)).toFixed(3)} px/${unit}` : "--"}</em><button title="Remove calibration line" onClick={() => { pushHistory(); setCalibrationLines((current) => current.filter((item) => item.id !== line.id)); }}><Trash2 size={11} /></button></div>)}</div>
            <footer><select value={unit} onChange={(event) => { pushHistory(); setUnit(event.target.value as "m" | "ft"); }}><option value="m">Meters</option><option value="ft">Feet</option></select><span>{validCalibrationLines.length === 1 ? "SINGLE-LINE SCALE" : "AVERAGED SCALE"}<b>{calibrationPreviewAverage ? `${calibrationPreviewAverage.toFixed(4)} px/${unit} / ${validCalibrationLines.length} line${validCalibrationLines.length === 1 ? "" : "s"}` : "Enter at least one distance"}</b></span><button disabled={!validCalibrationLines.length} onClick={applyAveragedCalibration}><Check size={13} /> Apply Scale</button></footer>
          </div>}
          {toast && <div className="status-toast" role="status"><span />{toast}</div>}
        </div>

        <aside className={`object-panel ${sidebarOpen ? "is-open" : ""}`}>
          <div className="panel-head"><div><Layers3 size={16} /><span>OBJECT LOG</span><b>{shapes.length}</b></div><button onClick={() => setSidebarOpen(false)}><X size={16} /></button></div>
          <div className="panel-metrics"><div><span>TOTAL LENGTH</span><b>{totalLength.toFixed(2)} {unit}</b></div><div><span>CLOSED AREA</span><b>{totalArea.toFixed(2)} {unit}²</b></div></div>
          <div className="scale-row"><span><Ruler size={13} /> GLOBAL AVERAGE SCALE</span><button onClick={() => setCalibrationLauncherOpen(true)}>{pxPerUnit.toFixed(3)} px/{unit}</button></div>
          <div className="object-list" ref={objectListRef}>
            {shapes.map((shape, shapeIndex) => <section key={shape.id} ref={(element) => { if (element) objectCardRefs.current.set(shape.id, element); else objectCardRefs.current.delete(shape.id); }} className={`object-card ${selectedId === shape.id ? "is-selected is-primary" : selectedIds.includes(shape.id) ? "is-selected is-secondary" : ""}`}>
              <div className="object-row">
                <button className="expand-button" onClick={() => setExpanded((current) => ({ ...current, [shape.id]: !current[shape.id] }))}>{expanded[shape.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                <button className="object-main" onClick={(event) => selectShape(shape.id, selectionMode === "multi" || event.ctrlKey || event.metaKey)}><i style={{ background: shape.color }} /><span><strong>{shape.name}</strong><small>{shape.source.toUpperCase()} / #{String(shapeIndex + 1).padStart(2, "0")} / {shape.closed ? "POLYGON" : "POLYLINE"} / {shape.points.length}V{shape.diagonals.length ? ` / ${shape.diagonals.length}D` : ""}</small></span></button>
                <label className="shape-color" title="Change shape colour"><input type="color" value={shape.color} onChange={(event) => { pushHistory(); setShapes((current) => current.map((item) => item.id === shape.id ? { ...item, color: event.target.value } : item)); }} /><span style={{ background: shape.color }} /></label>
                <button className="mini-action" title={shape.visible ? "Hide object" : "Show object"} onClick={() => { pushHistory(); setShapes((current) => current.map((item) => item.id === shape.id ? { ...item, visible: !item.visible } : item)); }}>{shape.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                <button className="mini-action danger" title="Delete shape" onClick={() => deleteShape(shape.id)}><Trash2 size={14} /></button>
              </div>
              <div className="object-stats"><span>PERIMETER <b>{formatLength(pathLength(shape))}</b></span>{shape.closed && <span>AREA <b>{formatArea(polygonArea(shape.points))}</b></span>}</div>
              {expanded[shape.id] && <div className="segment-list">{segmentPairs(shape).map((segment) => <div key={segment.index} className={`${selectedSegment?.shapeId === shape.id && selectedSegment.index === segment.index ? "is-active" : ""} ${calibrationLines.some((line) => line.shapeId === shape.id && line.segmentIndex === segment.index) ? "is-calibration" : ""}`}>
                <button onClick={() => {
                  if (tool === "calibrate" && calibrationMode === "segments") toggleCalibrationSegment(shape, segment.index);
                  else { setSelectedId(shape.id); setSelectedSegment({ shapeId: shape.id, index: segment.index }); }
                }}><span>SEG {String(segment.index + 1).padStart(2, "0")}</span><b>{formatLength(distance(segment.a, segment.b))}</b></button>
                <button title="Highlight segment" onClick={() => { setSelectedId(shape.id); setSelectedSegment({ shapeId: shape.id, index: segment.index }); }}><Eye size={12} /></button>
                <button title="Remove only this segment" onClick={() => deleteSegment(shape.id, segment.index)}><Unlink size={12} /></button>
              </div>)}</div>}
              {expanded[shape.id] && shape.diagonals.length > 0 && <div className="diagonal-list">{diagonalPairs(shape).map((diagonal, index) => <div key={diagonal.id}>
                <button onClick={() => selectShape(shape.id)}><span>DIA {String(index + 1).padStart(2, "0")}</span><b>{formatLength(distance(diagonal.a, diagonal.b))}</b></button>
                <button title="Remove diagonal" onClick={() => deleteDiagonal(shape.id, diagonal.id)}><Trash2 size={12} /></button>
              </div>)}</div>}
              {expanded[shape.id] && <div className="vertex-list">{shape.points.map((point, index) => {
                const shared = (topology.nodes.get(shape.nodeIds[index])?.members.length ?? 0) > 1;
                return <div key={index} className={selectedVertex?.shapeId === shape.id && selectedVertex.index === index ? "is-active" : ""}>
                  <button className="vertex-row-main" onClick={() => { setSelectedId(shape.id); setSelectedVertex({ shapeId: shape.id, index }); }}><span>NODE {String(index + 1).padStart(2, "0")}</span><b>{point.x.toFixed(0)}, {point.y.toFixed(0)}</b></button>
                  {shared
                    ? <button title="Unlink this shape's vertex" onClick={() => unlinkVertex(shape.id, index)}><Unlink size={11} /></button>
                    : <button title="Relink nearest vertex or edge" onClick={() => relinkNearest(shape.id, index)}><Link2 size={11} /></button>}
                  {!shared && <button title="Choose an explicit link target" onClick={() => { setLinkSource({ shapeId: shape.id, index }); setSelectedId(shape.id); notify("Tap a target vertex or edge"); }}><Crosshair size={11} /></button>}
                  <button title="Remove only this vertex" onClick={() => deleteVertex(shape.id, index)}><Trash2 size={11} /></button>
                </div>;
              })}</div>}
            </section>)}
            {!shapes.length && <div className="empty-log"><ScanLine size={30} /><b>No vector objects</b><span>Run Auto-Vectorize, tap a parcel with Plot Pick, or start a manual trace.</span></div>}
          </div>
          <div className="panel-export"><button onClick={() => exportFile("svg")}><FileCode2 size={14} /> SVG</button><button onClick={() => exportFile("dxf")}><Download size={14} /> DXF</button></div>
        </aside>
        {!sidebarOpen && <button className="floating-panel" onClick={() => setSidebarOpen(true)}><Layers3 size={18} /></button>}
      </section>

      <footer className="cad-footer"><span>RASTER <b>{mapSource.toUpperCase()} / REV {mapRevision}</b></span><span>SNAP <b>{snapSettings.enabled ? `${snapKind} / ${snapSettings.linkedEdit === "all" ? "ALL LINKED" : "SELECTED ONLY"}` : "OFF"} / 15PX LOOP</b></span><span>{shapes.length} SHAPES / {shapes.reduce((sum, shape) => sum + segmentPairs(shape).length, 0)} SEGMENTS / {shapes.reduce((sum, shape) => sum + shape.diagonals.length, 0)} DIAGONALS / {[...topology.edges.values()].filter((edge) => edge.members.length > 1).length} SHARED</span></footer>

      {calibrationLauncherOpen && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="calibration-launcher"><header><Ruler size={18} /><div><b>CHOOSE CALIBRATION ENGINE</b><span>Use one known line directly or average any set up to three.</span></div></header><button onClick={() => beginCalibration("auto")}><Sparkles size={18} /><span><b>Auto grid / flexible 1-3 lines</b><small>Detect candidate grid lines, retain one verified baseline or average up to three.</small></span></button><button onClick={() => beginCalibration("segments")}><ScanLine size={18} /><span><b>Use existing shape lines</b><small>Touch detected or manually drawn segments and enter their known real-world lengths.</small></span></button><button onClick={() => beginCalibration("manual")}><PencilLine size={18} /><span><b>Point-to-point / flexible 1-3 lines</b><small>Click the first vertex or point, then click the second point to set the calibration distance.</small></span></button><footer><button onClick={() => setCalibrationLauncherOpen(false)}>Cancel</button></footer></div></div>}
      {processing && <div className="processing"><Sparkles size={18} /><span><b>{tool === "pick" ? "Tracing selected parcel" : tool === "line-pick" ? "Tracing raster centreline" : "Mapping cadastral geometry"}</b><small>Processing native raster coordinates in the background</small></span></div>}
    </main>
  );
}
