import "./sketchPad.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  GitCommit,
  Hand,
  Image,
  Maximize2,
  Minus,
  PencilRuler,
  PlayCircle,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  TableProperties,
  Trash2,
  Triangle,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Brand } from "../components/Brand";
import { exportPlotPdf } from "../services/PlotReportService";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { CrosshairPointMarker } from "../components/common/PointMarker";
import { OffsetDragHandleOverlay } from "../components/common/OffsetDragHandle";
import { SketchTutorialModal } from "../components/SketchTutorialModal";
import {
  adjustSideCanvasLength,
  calculateHeronArea,
  calculateInteriorAngle,
  exportToCsv,
  exportToDxf,
  exportToSvg,
  getRequiredDiagonalsCount,
  recalibrateUnlockedSides,
  solveClosedLinkagePhysics,
  solveCornerAngleEdit,
  solveLinkageDrag,
  solveTriangulatedPolygon,
  type DiagonalMeasurement,
  type Point,
  type SideMeasurement,
  type SurveyTriangle,
} from "../services/imageTrace/sketch-solver";

const DEFAULT_SCALE = 20;

const CONVERSIONS = {
  sqft: 10.7639104,
  sqm: 1,
  acre: 0.000247105,
  hectare: 0.0001,
  gaj: 1.19599,
  guntha: 0.0098842,
  bigha_standard: 0.000395368,
  katha_standard: 0.00790737,
};

interface HistorySnapshot {
  points: Point[];
  closed: boolean;
  outerSides: SideMeasurement[];
  diagonals: DiagonalMeasurement[];
}

export default function SketchPadPage() {
  const navigate = useNavigate();
  const viewerRef = useRef<HTMLDivElement>(null);

  // Tools: draw, pan, dimension, customDiagonal, angles, triangles
  const [activeTool, setActiveTool] = useState<"draw" | "pan" | "dimension" | "customDiagonal" | "angles" | "triangles">("draw");

  // Custom Diagonal Sub-Mode: 'add' (➕) vs 'delete' (➖ Less)
  const [customDiagSubMode, setCustomDiagSubMode] = useState<"add" | "delete">("add");

  // Core Drawing State
  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed] = useState<boolean>(false);
  const [outerSides, setOuterSides] = useState<SideMeasurement[]>([]);
  const [diagonals, setDiagonals] = useState<DiagonalMeasurement[]>([]);
  const [calibrationScale, setCalibrationScale] = useState<number | null>(null);

  // Selected vertex state for tap-to-reveal drag handle
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const dragStartPointRef = useRef<Point | null>(null);

  // Custom Diagonal Group Pivot Base & Multi-Selected Target Indices
  const [pivotBaseIndex, setPivotBaseIndex] = useState<number | null>(null);
  const [selectedGroupTargets, setSelectedGroupTargets] = useState<number[]>([]);
  const [groupInputLengths, setGroupInputLengths] = useState<Record<number, string>>({});
  const [isGroupDockCollapsed, setIsGroupDockCollapsed] = useState<boolean>(false);

  // Active Highlighted Triangle on Canvas
  const [activeTriangleIdx, setActiveTriangleIdx] = useState<number | null>(null);

  // Warning Banner Dismissed State
  const [warningDismissed, setWarningDismissed] = useState<boolean>(false);

  // Collapsible Area Summary State
  const [isAreaCollapsed, setIsAreaCollapsed] = useState<boolean>(true);

  // Selection & Input Popover (side, diagonal, or angle)
  const [selectedElement, setSelectedElement] = useState<{
    type: "side" | "diagonal" | "angle";
    indexOrId: string | number;
    fromIndex: number;
    toIndex: number;
    currentVal: number;
    isLocked?: boolean;
  } | null>(null);
  const [inputValue, setInputValue] = useState<string>("");

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Viewport Transform (Zoom & Pan)
  const [transform, setTransform] = useState({ x: 200, y: 200, scale: 1 });
  const panStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const touchPinchRef = useRef<{ initDist: number; initScale: number } | null>(null);
  const lastPointerDownRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastInsertionTimeRef = useRef<number>(0);

  // Units
  const [unit, setUnit] = useState<"ft" | "m" | "yd">("ft");

  // Modals & Notifications
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [plotName, setPlotName] = useState("Khasra Field Survey Plot");
  const [notification, setNotification] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    window.setTimeout(() => setNotification(null), 3000);
  }, []);

  // Mathematical Auto-Center & Fit Viewport Algorithm with Smart Clear Zone Padding
  const fitPlotToViewport = useCallback(() => {
    if (!viewerRef.current || points.length === 0) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const bboxWidth = maxX - minX || 100;
    const bboxHeight = maxY - minY || 100;

    const isMobile = width < 640;
    const topPadding = isMobile ? 120 : 80;
    const bottomPadding = isMobile ? 100 : 60;
    const sidePadding = isMobile ? 30 : 60;

    const availableWidth = width - sidePadding * 2;
    const availableHeight = height - topPadding - bottomPadding;

    const scaleX = availableWidth / bboxWidth;
    const scaleY = availableHeight / bboxHeight;
    const fitScale = Math.max(0.35, Math.min(2.2, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const translateX = width / 2 - centerX * fitScale;
    const translateY = topPadding + availableHeight / 2 - centerY * fitScale;

    setTransform({ x: translateX, y: translateY, scale: fitScale });
    notify("Plot centered to clear canvas!");
  }, [points, notify]);

  // Auto-Center map when polygon closes
  useEffect(() => {
    if (closed && points.length >= 3) {
      fitPlotToViewport();
    }
  }, [closed]);

  // Auto-Pan canvas upwards when a pivot base vertex is selected so bottom dock never covers it
  useEffect(() => {
    if (pivotBaseIndex !== null && points[pivotBaseIndex]) {
      const p = points[pivotBaseIndex];
      const pivotScreenY = p.y * transform.scale + transform.y;
      if (viewerRef.current) {
        const height = viewerRef.current.clientHeight;
        if (pivotScreenY > height - 220) {
          const shiftY = height - 260 - pivotScreenY;
          setTransform((t) => ({ ...t, y: t.y + shiftY }));
        }
      }
    }
  }, [pivotBaseIndex, points]);

  // Save Snapshot to History
  const pushHistory = useCallback(
    (newPts: Point[], newClosed: boolean, newSides: SideMeasurement[], newDiags: DiagonalMeasurement[]) => {
      const snap: HistorySnapshot = {
        points: [...newPts],
        closed: newClosed,
        outerSides: [...newSides],
        diagonals: [...newDiags],
      };
      setHistory((curr) => [...curr.slice(0, historyIndex + 1), snap]);
      setHistoryIndex((i) => i + 1);
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setPoints(prev.points);
      setClosed(prev.closed);
      setOuterSides(prev.outerSides);
      setDiagonals(prev.diagonals);
      setHistoryIndex((i) => i - 1);
      notify("Undo applied");
    }
  }, [history, historyIndex, notify]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setPoints(next.points);
      setClosed(next.closed);
      setOuterSides(next.outerSides);
      setDiagonals(next.diagonals);
      setHistoryIndex((i) => i + 1);
      notify("Redo applied");
    }
  }, [history, historyIndex, notify]);

  // Update Outer Sides Array when polygon closes or calibration scale changes
  useEffect(() => {
    if (closed && points.length >= 3) {
      const sides: SideMeasurement[] = [];
      for (let i = 0; i < points.length; i++) {
        const next = (i + 1) % points.length;
        const distPx = Math.hypot(points[next].x - points[i].x, points[next].y - points[i].y);
        const existing = outerSides.find((s) => s.fromIndex === i && s.toIndex === next);
        const isLocked = existing ? !!existing.isLocked : false;

        let lengthVal = 0;
        if (isLocked && existing && existing.length > 0) {
          lengthVal = existing.length;
        } else if (calibrationScale && calibrationScale > 0) {
          lengthVal = Math.round(distPx / calibrationScale);
        } else if (existing && existing.length > 0 && !calibrationScale) {
          lengthVal = existing.length;
        }

        sides.push({
          id: `side-${i}-${next}`,
          fromIndex: i,
          toIndex: next,
          length: lengthVal,
          rawPxLength: distPx,
          isLocked,
        });
      }
      setOuterSides(sides);
    }
  }, [closed, points, calibrationScale]);

  // Determine whether to display default automatic candidate diagonals from Vertex 0
  const hasCustomOrLockedDiags = useMemo(
    () => activeTool === "customDiagonal" || diagonals.some((d) => d.isLocked),
    [activeTool, diagonals]
  );

  // Active Diagonals List with strict deduplication & unique keys
  const activeDiagonalsList = useMemo(() => {
    if (!closed || points.length < 4) return [];
    const list: DiagonalMeasurement[] = [];
    const seen = new Set<string>();

    // Add user/locked diagonals first
    for (const d of diagonals) {
      const u = Math.min(d.fromIndex, d.toIndex);
      const v = Math.max(d.fromIndex, d.toIndex);
      const key = `${u}-${v}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          ...d,
          fromIndex: u,
          toIndex: v,
          id: `diag-${key}`,
        });
      }
    }

    const N = points.length;
    if (!hasCustomOrLockedDiags) {
      for (let i = 2; i < N - 1; i++) {
        const u = 0;
        const v = i;
        const key = `${u}-${v}`;
        if (!seen.has(key)) {
          seen.add(key);
          const p1 = points[0];
          const p2 = points[i];
          const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const estimatedLen = calibrationScale ? Math.round(distPx / calibrationScale) : 0;
          list.push({
            id: `diag-${key}`,
            fromIndex: 0,
            toIndex: i,
            length: estimatedLen,
            isLocked: false,
          });
        }
      }
    }

    return list;
  }, [closed, diagonals, points, calibrationScale, hasCustomOrLockedDiags]);

  // Calculated Interior Angles at each vertex corner
  const cornerAngles = useMemo(() => {
    if (!closed || points.length < 3) return [];
    const N = points.length;
    return points.map((pCurr, i) => {
      const pPrev = points[(i - 1 + N) % N];
      const pNext = points[(i + 1) % N];
      return calculateInteriorAngle(pPrev, pCurr, pNext);
    });
  }, [closed, points]);

  // $N-3$ Triangulation Counter
  const reqDiagonalsCount = useMemo(() => getRequiredDiagonalsCount(points.length), [points.length]);
  const enteredDiagonalsCount = useMemo(
    () => activeDiagonalsList.filter((d) => d.isLocked && d.length > 0).length,
    [activeDiagonalsList]
  );
  const isTriangulationComplete = closed && points.length >= 3 && enteredDiagonalsCount >= reqDiagonalsCount;

  // Dynamically compute all constituent triangles formed by boundary edges and active diagonals
  const dynamicTrianglesList = useMemo<SurveyTriangle[]>(() => {
    if (!closed || points.length < 3) return [];
    const N = points.length;

    const edgeSet = new Set<string>();
    const addEdge = (u: number, v: number) => {
      const min = Math.min(u, v);
      const max = Math.max(u, v);
      edgeSet.add(`${min}-${max}`);
    };

    for (let i = 0; i < N; i++) {
      addEdge(i, (i + 1) % N);
    }

    activeDiagonalsList.forEach((d) => {
      if (d.isLocked || !hasCustomOrLockedDiags) {
        addEdge(d.fromIndex, d.toIndex);
      }
    });

    const activeScale = calibrationScale ?? DEFAULT_SCALE;
    const trianglesList: SurveyTriangle[] = [];
    let tCounter = 1;

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (!edgeSet.has(`${i}-${j}`)) continue;
        for (let k = j + 1; k < N; k++) {
          if (edgeSet.has(`${j}-${k}`) && edgeSet.has(`${i}-${k}`)) {
            const p0 = points[i];
            const p1 = points[j];
            const p2 = points[k];

            const s1 = Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / activeScale);
            const s2 = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / activeScale);
            const s3 = Math.round(Math.hypot(p2.x - p0.x, p2.y - p0.y) / activeScale);

            // Exact mathematical triangle area via Heron's Formula in user units (e.g. sq.ft)
            const areaInUnits = calculateHeronArea(s1, s2, s3);
            const areaSqM =
              unit === "ft"
                ? areaInUnits / CONVERSIONS.sqft
                : unit === "yd"
                ? areaInUnits / CONVERSIONS.gaj
                : areaInUnits;

            trianglesList.push({
              id: `T-${i}-${j}-${k}`,
              name: `Triangle ${tCounter++} (V${i + 1}-V${j + 1}-V${k + 1})`,
              indices: [i, j, k],
              a: s1,
              b: s2,
              c: s3,
              areaSqM,
            });
          }
        }
      }
    }

    return trianglesList;
  }, [closed, points, activeDiagonalsList, calibrationScale, hasCustomOrLockedDiags]);

  // Triangulation Solver for Mode A
  const triangulationResult = useMemo(() => {
    if (!closed || points.length < 3) return null;
    const sideVals = outerSides.map((s) => s.length);
    const activeScale = calibrationScale ?? DEFAULT_SCALE;
    return solveTriangulatedPolygon(sideVals, activeDiagonalsList, activeScale, points);
  }, [activeDiagonalsList, closed, outerSides, points, calibrationScale]);

  // Morph Points when triangulation is complete
  useEffect(() => {
    if (isTriangulationComplete && triangulationResult && triangulationResult.ok && triangulationResult.solvedPoints) {
      setPoints(triangulationResult.solvedPoints);
      notify("Plot morphed to exact triangulated 2D shape!");
    }
  }, [isTriangulationComplete]);

  // Area Calculations (100% Accurate Shoelace formula in Square Meters)
  const rawAreaInSqMeters = useMemo(() => {
    if (points.length < 3) return 0;
    let areaPx = 0;
    const N = points.length;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      areaPx += points[i].x * points[j].y;
      areaPx -= points[j].x * points[i].y;
    }
    const absAreaPx = Math.abs(areaPx) / 2;
    const activeScale = calibrationScale ?? DEFAULT_SCALE;

    const physicalAreaUnits = absAreaPx / (activeScale * activeScale);

    if (unit === "ft") return physicalAreaUnits / CONVERSIONS.sqft;
    if (unit === "yd") return physicalAreaUnits / CONVERSIONS.gaj;
    return physicalAreaUnits;
  }, [points, calibrationScale, unit]);

  const areaSummaries = useMemo(() => {
    const sqM = rawAreaInSqMeters;
    return {
      sqft: (sqM * CONVERSIONS.sqft).toFixed(2),
      sqm: sqM.toFixed(2),
      acre: (sqM * CONVERSIONS.acre).toFixed(4),
      hectare: (sqM * CONVERSIONS.hectare).toFixed(4),
      gaj: (sqM * CONVERSIONS.gaj).toFixed(2),
      guntha: (sqM * CONVERSIONS.guntha).toFixed(3),
      bigha: (sqM * CONVERSIONS.bigha_standard).toFixed(3),
      katha: (sqM * CONVERSIONS.katha_standard).toFixed(2),
    };
  }, [rawAreaInSqMeters]);

  // Single Tap on Vertex 0 Action to Close Polygon
  const closePolygonAtVertex0 = () => {
    if (points.length >= 3 && !closed) {
      setClosed(true);
      setActiveTool("dimension");
      pushHistory(points, true, outerSides, diagonals);
      notify("Polygon closed by tapping starting point!");
    }
  };

  // Reset / Clear All Diagonals
  const resetAllDiagonals = () => {
    setDiagonals([]);
    setPivotBaseIndex(null);
    setSelectedGroupTargets([]);
    setGroupInputLengths({});
    pushHistory(points, closed, outerSides, []);
    notify("All diagonals reset!");
  };

  // Bulk Lock & Save Group Diagonals
  const saveGroupDiagonalsBatch = () => {
    if (pivotBaseIndex === null || selectedGroupTargets.length === 0) return;

    const newDiags = [...diagonals];
    for (const targetIdx of selectedGroupTargets) {
      const from = Math.min(pivotBaseIndex, targetIdx);
      const to = Math.max(pivotBaseIndex, targetIdx);
      const strVal = groupInputLengths[targetIdx];
      const p1 = points[from];
      const p2 = points[to];
      const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const est = calibrationScale ? Math.round(pxDist / calibrationScale) : 0;
      const val = strVal ? parseFloat(strVal) : est;

      if (val > 0) {
        const existIdx = newDiags.findIndex((d) => d.fromIndex === from && d.toIndex === to);
        const diagObj: DiagonalMeasurement = {
          id: `diag-${from}-${to}`,
          fromIndex: from,
          toIndex: to,
          length: val,
          isLocked: true,
        };
        if (existIdx >= 0) {
          newDiags[existIdx] = diagObj;
        } else {
          newDiags.push(diagObj);
        }
      }
    }

    setDiagonals(newDiags);
    const activeScale = calibrationScale ?? DEFAULT_SCALE;
    const solved = solveClosedLinkagePhysics(points, outerSides, newDiags, activeScale);
    setPoints(solved);
    pushHistory(solved, closed, outerSides, newDiags);

    setPivotBaseIndex(null);
    setSelectedGroupTargets([]);
    setGroupInputLengths({});
    notify(`Group Diagonals locked & saved successfully!`);
  };

  // Remove a specific diagonal by ID
  const removeDiagonalById = (diagId: string) => {
    const nextDiags = diagonals.filter((d) => d.id !== diagId);
    setDiagonals(nextDiags);
    const activeScale = calibrationScale ?? DEFAULT_SCALE;
    const solved = solveClosedLinkagePhysics(points, outerSides, nextDiags, activeScale);
    setPoints(solved);
    pushHistory(solved, closed, outerSides, nextDiags);
    notify("Diagonal removed!");
  };

  // Find nearest boundary line segment index to click coordinates
  const findNearestSegmentIndex = useCallback(
    (clickX: number, clickY: number, maxDistPx: number = 25) => {
      if (points.length < 2) return -1;
      const numSegments = closed ? points.length : points.length - 1;
      let bestSegIdx = -1;
      let minDist = Infinity;

      for (let i = 0; i < numSegments; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;

        const t = Math.max(0, Math.min(1, ((clickX - p1.x) * dx + (clickY - p1.y) * dy) / lenSq));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        const dist = Math.hypot(clickX - closestX, clickY - closestY);

        if (dist < minDist && dist <= maxDistPx / transform.scale) {
          minDist = dist;
          bestSegIdx = i;
        }
      }

      return bestSegIdx;
    },
    [points, closed, transform.scale]
  );

  // Insert a new point onto a boundary line segment upon double tap / double click
  const insertPointOnSegment = useCallback(
    (segIndex: number, clickX: number, clickY: number) => {
      if (Date.now() - lastInsertionTimeRef.current < 400) return;
      lastInsertionTimeRef.current = Date.now();

      if (segIndex < 0 || segIndex >= points.length) return;
      const p1 = points[segIndex];
      const nextIdx = (segIndex + 1) % points.length;
      const p2 = points[nextIdx];

      if (!p1 || !p2) return;

      // Project click point onto segment
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      let projX = clickX;
      let projY = clickY;

      let ratio = 0.5;
      if (lenSq > 0) {
        const t = Math.max(0.05, Math.min(0.95, ((clickX - p1.x) * dx + (clickY - p1.y) * dy) / lenSq));
        projX = Math.round((p1.x + t * dx) / 4) * 4;
        projY = Math.round((p1.y + t * dy) / 4) * 4;
        ratio = t;
      }

      const insertIdx = segIndex + 1;
      const newPoint = { x: projX, y: projY };

      const newPoints = [
        ...points.slice(0, insertIdx),
        newPoint,
        ...points.slice(insertIdx),
      ];

      // Calculate split side lengths according to calibration / ratio
      const oldSide = outerSides.find((s) => s.fromIndex === segIndex && s.toIndex === nextIdx);

      const actualDist1 = Math.hypot(projX - p1.x, projY - p1.y);
      const actualDist2 = Math.hypot(p2.x - projX, p2.y - projY);

      let len1 = 0;
      let len2 = 0;

      if (oldSide && oldSide.length > 0) {
        // Split existing calibrated side length proportionally
        len1 = Math.max(1, Math.round(oldSide.length * ratio));
        len2 = Math.max(1, oldSide.length - len1);
      } else if (calibrationScale && calibrationScale > 0) {
        // Use global calibration scale
        len1 = Math.round(actualDist1 / calibrationScale);
        len2 = Math.round(actualDist2 / calibrationScale);
      }

      const isLocked = oldSide ? !!oldSide.isLocked : false;

      // Construct new outerSides array with split segment and shifted indices
      const newOuterSides: SideMeasurement[] = [];
      const newTotalPoints = newPoints.length;

      for (let i = 0; i < points.length; i++) {
        const oldFrom = i;
        const oldTo = (i + 1) % points.length;

        if (i < segIndex) {
          const existing = outerSides.find((s) => s.fromIndex === oldFrom && s.toIndex === oldTo);
          newOuterSides.push({
            id: `side-${oldFrom}-${oldTo}`,
            fromIndex: oldFrom,
            toIndex: oldTo,
            length: existing ? existing.length : (calibrationScale ? Math.round(Math.hypot(points[oldTo].x - points[oldFrom].x, points[oldTo].y - points[oldFrom].y) / calibrationScale) : 0),
            rawPxLength: Math.hypot(points[oldTo].x - points[oldFrom].x, points[oldTo].y - points[oldFrom].y),
            isLocked: existing ? !!existing.isLocked : false,
          });
        } else if (i === segIndex) {
          // Part 1
          newOuterSides.push({
            id: `side-${segIndex}-${insertIdx}`,
            fromIndex: segIndex,
            toIndex: insertIdx,
            length: len1,
            rawPxLength: actualDist1,
            isLocked,
          });
          // Part 2
          const nextTarget = (insertIdx + 1) % newTotalPoints;
          newOuterSides.push({
            id: `side-${insertIdx}-${nextTarget}`,
            fromIndex: insertIdx,
            toIndex: nextTarget,
            length: len2,
            rawPxLength: actualDist2,
            isLocked,
          });
        } else {
          // Shifted side
          const existing = outerSides.find((s) => s.fromIndex === oldFrom && s.toIndex === oldTo);
          const newFrom = oldFrom + 1;
          const newTo = (oldTo + 1) % newTotalPoints;
          newOuterSides.push({
            id: `side-${newFrom}-${newTo}`,
            fromIndex: newFrom,
            toIndex: newTo,
            length: existing ? existing.length : 0,
            rawPxLength: Math.hypot(points[oldTo].x - points[oldFrom].x, points[oldTo].y - points[oldFrom].y),
            isLocked: existing ? !!existing.isLocked : false,
          });
        }
      }

      // Shift index references for diagonals
      const updatedDiags = diagonals.map((d) => ({
        ...d,
        fromIndex: d.fromIndex >= insertIdx ? d.fromIndex + 1 : d.fromIndex,
        toIndex: d.toIndex >= insertIdx ? d.toIndex + 1 : d.toIndex,
      }));

      setPoints(newPoints);
      setOuterSides(newOuterSides);
      setDiagonals(updatedDiags);
      pushHistory(newPoints, closed, newOuterSides, updatedDiags);

      const msg = len1 > 0 || len2 > 0
        ? `New vertex V${insertIdx + 1} added! Line split into ${len1} ${unit} and ${len2} ${unit}.`
        : `New vertex V${insertIdx + 1} added on line segment!`;
      notify(msg);
    },
    [points, diagonals, closed, outerSides, calibrationScale, unit, pushHistory, notify]
  );

  // Delete a vertex node upon double tap / double click
  const deletePointAtIndex = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= points.length) return;
      if (Date.now() - lastInsertionTimeRef.current < 300) return;
      lastInsertionTimeRef.current = Date.now();

      const newPoints = points.filter((_, idx) => idx !== targetIdx);

      // Remove diagonals connected to targetIdx and shift indices for index > targetIdx
      const updatedDiags = diagonals
        .filter((d) => d.fromIndex !== targetIdx && d.toIndex !== targetIdx)
        .map((d) => ({
          ...d,
          fromIndex: d.fromIndex > targetIdx ? d.fromIndex - 1 : d.fromIndex,
          toIndex: d.toIndex > targetIdx ? d.toIndex - 1 : d.toIndex,
        }));

      const isStillClosed = closed && newPoints.length >= 3;

      // Rebuild outerSides for remaining vertices
      const newOuterSides: SideMeasurement[] = [];
      if (isStillClosed) {
        const N = newPoints.length;
        for (let i = 0; i < N; i++) {
          const next = (i + 1) % N;
          const distPx = Math.hypot(newPoints[next].x - newPoints[i].x, newPoints[next].y - newPoints[i].y);
          const lengthVal = calibrationScale && calibrationScale > 0 ? Math.round(distPx / calibrationScale) : 0;
          newOuterSides.push({
            id: `side-${i}-${next}`,
            fromIndex: i,
            toIndex: next,
            length: lengthVal,
            rawPxLength: distPx,
            isLocked: false,
          });
        }
      }

      // Reset selection pivots if removed vertex was selected
      if (pivotBaseIndex === targetIdx) {
        setPivotBaseIndex(null);
        setSelectedGroupTargets([]);
      } else if (pivotBaseIndex !== null && pivotBaseIndex > targetIdx) {
        setPivotBaseIndex(pivotBaseIndex - 1);
      }

      setPoints(newPoints);
      setClosed(isStillClosed);
      setOuterSides(newOuterSides);
      setDiagonals(updatedDiags);
      setSelectedVertexIndex(null);
      pushHistory(newPoints, isStillClosed, newOuterSides, updatedDiags);
      notify(`Vertex V${targetIdx + 1} deleted!`);
    },
    [points, diagonals, closed, calibrationScale, pivotBaseIndex, pushHistory, notify]
  );

  // SVG double click handler
  const handleSvgDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const rect = viewerRef.current!.getBoundingClientRect();
    const rawX = (event.clientX - rect.left - transform.x) / transform.scale;
    const rawY = (event.clientY - rect.top - transform.y) / transform.scale;

    const hitVertexIdx = points.findIndex((p) => Math.hypot(p.x - rawX, p.y - rawY) < 22 / transform.scale);
    if (hitVertexIdx >= 0) {
      deletePointAtIndex(hitVertexIdx);
      return;
    }

    const segIdx = findNearestSegmentIndex(rawX, rawY, 25);
    if (segIdx >= 0) {
      insertPointOnSegment(segIdx, rawX, rawY);
    }
  };

  // Pointer Handlers with 1-Finger Canvas Panning Support & Double-Tap Detection (Vertex Delete / Line Add)
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = viewerRef.current!.getBoundingClientRect();
    const rawX = (event.clientX - rect.left - transform.x) / transform.scale;
    const rawY = (event.clientY - rect.top - transform.y) / transform.scale;

    const hitIdx = points.findIndex((p) => Math.hypot(p.x - rawX, p.y - rawY) < 22 / transform.scale);

    // Double tap / double click detection on vertex or line segment
    const now = Date.now();
    if (
      lastPointerDownRef.current &&
      now - lastPointerDownRef.current.time < 350 &&
      Math.hypot(event.clientX - lastPointerDownRef.current.x, event.clientY - lastPointerDownRef.current.y) < 25
    ) {
      lastPointerDownRef.current = null;
      if (hitIdx >= 0) {
        deletePointAtIndex(hitIdx);
        return;
      }
      const segIdx = findNearestSegmentIndex(rawX, rawY, 25);
      if (segIdx >= 0) {
        insertPointOnSegment(segIdx, rawX, rawY);
        return;
      }
    }
    lastPointerDownRef.current = { time: now, x: event.clientX, y: event.clientY };

    // Drawing Phase: Add points without showing drag handle; tap Vertex 0 to close
    if (activeTool === "draw" && !closed) {
      if (hitIdx === 0 && points.length >= 3) {
        closePolygonAtVertex0();
        return;
      }
      setSelectedVertexIndex(null);
      const snapX = Math.round(rawX / 12) * 12;
      const snapY = Math.round(rawY / 12) * 12;
      const updated = [...points, { x: snapX, y: snapY }];
      setPoints(updated);
      pushHistory(updated, closed, outerSides, diagonals);
      return;
    }

    // Custom Group Diagonal Mode Node Selection
    if (activeTool === "customDiagonal" && closed && customDiagSubMode === "add" && hitIdx >= 0) {
      if (pivotBaseIndex === null) {
        setPivotBaseIndex(hitIdx);
        setSelectedGroupTargets([]);
        setGroupInputLengths({});
        setIsGroupDockCollapsed(false);
        notify(`Selected Vertex ${hitIdx + 1} as Pivot Base! Tap target vertices to add diagonals.`);
      } else if (pivotBaseIndex === hitIdx) {
        setPivotBaseIndex(null);
        setSelectedGroupTargets([]);
        setGroupInputLengths({});
        notify("Pivot base cleared.");
      } else {
        setSelectedGroupTargets((curr) => {
          const exists = curr.includes(hitIdx);
          const updated = exists ? curr.filter((i) => i !== hitIdx) : [...curr, hitIdx];

          if (!exists) {
            const p1 = points[pivotBaseIndex];
            const p2 = points[hitIdx];
            const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const est = calibrationScale ? Math.round(distPx / calibrationScale) : 0;
            setGroupInputLengths((prev) => ({ ...prev, [hitIdx]: String(est) }));
          }
          return updated;
        });
      }
      return;
    }

    // Tap on an existing vertex to reveal / switch offset drag handle
    if (hitIdx >= 0) {
      setSelectedVertexIndex(hitIdx);
      return;
    }

    // If touched empty space on canvas (hitIdx === -1), deselect vertex and enable 1-finger canvas panning!
    if (hitIdx < 0) {
      setSelectedVertexIndex(null);
      if (activeTool === "pan" || closed) {
        panStartRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          initX: transform.x,
          initY: transform.y,
        };
        return;
      }
    }
  };

  const handleDragStart = useCallback(() => {
    if (selectedVertexIndex !== null && points[selectedVertexIndex]) {
      dragStartPointRef.current = { ...points[selectedVertexIndex] };
    }
  }, [selectedVertexIndex, points]);

  const handleDragPoint = useCallback(({ dx, dy }: { dx: number; dy: number }) => {
    if (selectedVertexIndex === null || !dragStartPointRef.current) return;
    const start = dragStartPointRef.current;
    const rawX = start.x + dx / transform.scale;
    const rawY = start.y + dy / transform.scale;
    if (closed) {
      const activeScale = calibrationScale ?? DEFAULT_SCALE;
      const solved = solveLinkageDrag(points, selectedVertexIndex, { x: rawX, y: rawY }, outerSides, diagonals, activeScale);
      setPoints(solved);
    } else {
      const nextPts = [...points];
      nextPts[selectedVertexIndex] = { x: rawX, y: rawY };
      setPoints(nextPts);
    }
  }, [selectedVertexIndex, closed, calibrationScale, outerSides, diagonals, transform.scale, points]);

  const handleDragEnd = useCallback(() => {
    dragStartPointRef.current = null;
    pushHistory(points, closed, outerSides, diagonals);
  }, [points, closed, outerSides, diagonals, pushHistory]);

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panStartRef.current) {
      const { startX, startY, initX, initY } = panStartRef.current;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      setTransform((t) => ({ ...t, x: initX + dx, y: initY + dy }));
      return;
    }
  };

  const handlePointerUp = () => {
    panStartRef.current = null;
  };

  // Mobile Touch Gestures (1-finger Pan & 2-finger Pinch Zoom)
  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchPinchRef.current = { initDist: dist, initScale: transform.scale };
    }
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && touchPinchRef.current) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchPinchRef.current.initDist;
      const newScale = Math.max(0.4, Math.min(3.5, touchPinchRef.current.initScale * ratio));
      setTransform((t) => ({ ...t, scale: newScale }));
    }
  };

  const handleTouchEnd = () => {
    touchPinchRef.current = null;
  };

  // Popover input opener (side, diagonal, or angle)
  const openPopoverForElement = (
    type: "side" | "diagonal" | "angle",
    indexOrId: string | number,
    fromIndex: number,
    toIndex: number,
    currentVal: number,
    isLocked?: boolean
  ) => {
    if (type === "diagonal" && activeTool === "customDiagonal" && customDiagSubMode === "delete") {
      removeDiagonalById(String(indexOrId));
      return;
    }

    setSelectedElement({ type, indexOrId, fromIndex, toIndex, currentVal, isLocked });
    setInputValue(currentVal > 0 ? String(currentVal) : "");
  };

  // Save entered value
  const saveEnteredValue = () => {
    if (!selectedElement) return;
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) {
      notify("Please enter a valid positive value");
      return;
    }

    const activeScale = calibrationScale ?? DEFAULT_SCALE;

    if (selectedElement.type === "side") {
      const sideIdx = outerSides.findIndex((s) => s.fromIndex === selectedElement.fromIndex && s.toIndex === selectedElement.toIndex);

      if (sideIdx >= 0) {
        if (!calibrationScale) {
          const p1 = points[selectedElement.fromIndex];
          const p2 = points[selectedElement.toIndex];
          const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const newScale = pxDist / val;
          setCalibrationScale(newScale);

          const nextSides = recalibrateUnlockedSides(outerSides, sideIdx, val);
          setOuterSides(nextSides);
          pushHistory(points, closed, nextSides, diagonals);
          notify(`Base Line calibrated to ${val} ${unit}! Estimated lengths updated.`);
        } else {
          const nextPts = adjustSideCanvasLength(points, sideIdx, val, activeScale);
          setPoints(nextPts);

          const nextSides = outerSides.map((s, idx) => (idx === sideIdx ? { ...s, length: val, isLocked: true } : s));
          setOuterSides(nextSides);

          const solved = solveClosedLinkagePhysics(nextPts, nextSides, diagonals, activeScale);
          setPoints(solved);
          pushHistory(solved, closed, nextSides, diagonals);
          notify(`Side ${sideIdx + 1} HARD-LOCKED 🔒 to ${val} ${unit}`);
        }
      }
    } else if (selectedElement.type === "diagonal") {
      const filtered = diagonals.filter((d) => !(d.fromIndex === selectedElement.fromIndex && d.toIndex === selectedElement.toIndex));
      const nextDiags = [
        ...filtered,
        {
          id: `diag-${selectedElement.fromIndex}-${selectedElement.toIndex}`,
          fromIndex: selectedElement.fromIndex,
          toIndex: selectedElement.toIndex,
          length: val,
          isLocked: true,
        },
      ];
      setDiagonals(nextDiags);
      const solved = solveClosedLinkagePhysics(points, outerSides, nextDiags, activeScale);
      setPoints(solved);
      pushHistory(solved, closed, outerSides, nextDiags);
      notify(`Diagonal HARD-LOCKED 🔒 to ${val} ${unit}`);
    } else if (selectedElement.type === "angle") {
      const solved = solveCornerAngleEdit(points, selectedElement.fromIndex, val, outerSides, activeScale);
      setPoints(solved);
      pushHistory(solved, closed, outerSides, diagonals);
      notify(`Corner ${selectedElement.fromIndex + 1} angle set to ${val}°`);
    }

    setSelectedElement(null);
  };

  const handleClear = () => {
    setPoints([]);
    setClosed(false);
    setOuterSides([]);
    setDiagonals([]);
    setCalibrationScale(null);
    setPivotBaseIndex(null);
    setSelectedGroupTargets([]);
    setGroupInputLengths({});
    setSelectedElement(null);
    setActiveTool("draw");
    pushHistory([], false, [], []);
    notify("Canvas reset");
  };

  const savePlotToLocal = async () => {
    if (!closed || points.length < 3) return;
    try {
      await localDatabaseService.savePlot({
        name: plotName,
        mode: "sketch",
        sketchData: { points, outerSides, diagonals },
      });
      setSaveModalOpen(false);
      notify("Plot saved to local database!");
    } catch (err) {
      notify("Failed to save plot");
    }
  };

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
    notify(`Exported ${filename}!`);
  };

  const handleExportPdf = async () => {
    if (!closed || points.length < 3) {
      notify("Please complete and close the plot before exporting PDF");
      return;
    }
    try {
      notify("Generating high-resolution survey PDF report...");
      const activeScale = calibrationScale ?? DEFAULT_SCALE;
      const unitFactor = unit === "ft" ? 0.3048 : unit === "yd" ? 0.9144 : 1.0;
      const areaUnitFactor = unit === "ft" ? 0.09290304 : unit === "yd" ? 0.83612736 : 1.0;
      const lengthUnitSymbol = unit === "ft" ? "ft" : unit === "yd" ? "gaj" : "m";
      const areaUnitSymbol = unit === "ft" ? "sq.ft" : unit === "yd" ? "sq.yd" : "m²";

      // Physical side lengths
      const sideLengthsMeters = outerSides.map((s) => {
        const p1 = points[s.fromIndex];
        const p2 = points[s.toIndex];
        const distPx = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : 0;
        const distPhysical = s.length > 0 ? s.length : (distPx / activeScale);
        return distPhysical * unitFactor;
      });

      const sideLabels = outerSides.map((s) => {
        const p1 = points[s.fromIndex];
        const p2 = points[s.toIndex];
        const distPx = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : 0;
        const distPhysical = s.length > 0 ? s.length : (distPx / activeScale);
        return `${distPhysical.toFixed(2)} ${lengthUnitSymbol}`;
      });

      const activeDiags = (activeDiagonalsList && activeDiagonalsList.length > 0) ? activeDiagonalsList : diagonals;
      const diagonalPairs = activeDiags.map((d) => [d.fromIndex, d.toIndex]);
      const diagonalsMeters = activeDiags.map((d) => {
        const from = d.fromIndex;
        const to = d.toIndex;
        const p1 = points[from];
        const p2 = points[to];
        const distPx = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y) : 0;
        const distPhysical = d.length > 0 ? d.length : (distPx / activeScale);
        return distPhysical * unitFactor;
      });

      const perimeterM = sideLengthsMeters.reduce((a, b) => a + b, 0);

      // Triangles data breakdown
      const trianglesData = (dynamicTrianglesList || []).map((tri, idx) => {
        const sides = [tri.a ?? 0, tri.b ?? 0, tri.c ?? 0];
        return {
          name: `Triangle ${idx + 1} (P${(tri.indices?.[0] ?? 0) + 1}-P${(tri.indices?.[1] ?? 1) + 1}-P${(tri.indices?.[2] ?? 2) + 1})`,
          sidesMeters: sides.map((s) => s * unitFactor),
          values: sides.map((s) => s.toFixed(2)),
          areaSqm: tri.areaSqM ?? 0,
          indices: tri.indices ?? [0, 1, 2],
        };
      });

      const snapshot = {
        sourceType: "manual",
        calculationMode: "irregular",
        mode: "irregular",
        inputUnit: {
          id: unit,
          name: unit === "ft" ? "Feet" : unit === "yd" ? "Gaj" : "Meter",
          symbol: lengthUnitSymbol,
          factorToBase: String(unitFactor),
        },
        outputUnit: {
          id: unit === "ft" ? "sqft" : unit === "yd" ? "gaj" : "sqm",
          name: unit === "ft" ? "Square Feet" : unit === "yd" ? "Square Yard" : "Square Meter",
          symbol: areaUnitSymbol,
          factorToBase: String(areaUnitFactor),
        },
        metadata: {
          plotName: plotName || "Sketch Plot",
          owner: "Surveyor / Owner",
          address: "Site Sketch Survey",
          notes: `Generated from PlotScale CAD Sketch Engine. Vertices: ${points.length}. Locked diagonals: ${diagonals.length}.`,
        },
        result: {
          areaSqm: rawAreaInSqMeters,
          perimeterM,
          method: "triangulation_cad",
          exactness: isTriangulationComplete ? "confirmed" : "approximate",
          vertices: points,
          sideLengthsMeters,
          sideLabels,
          diagonalPairs,
          diagonalsMeters,
          triangles: trianglesData,
        },
        boundaries: outerSides.map((_, i) => `Boundary ${i + 1}`),
      };

      setExportModalOpen(false);
      await exportPlotPdf(snapshot);
      notify(`Exported PlotScale-${plotName || "Plot"}.pdf!`);
    } catch (err) {
      console.error("PDF export failed:", err);
      notify("Failed to generate PDF report");
    }
  };

  return (
    <main className="sketch-app">
      {/* Standard PlotScale Header */}
      <header className="calculator-header sketch-top-header">
        <button type="button" className="icon-button" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard">
          <ArrowLeft size={19} />
        </button>
        <Brand compact />
        <span className="calculator-header__chip">
          <PencilRuler size={14} /> Sketch Pad
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            to="/help"
            className="sketch-tutorial-pill-btn"
            title="Help Center & Documentation / सहायता केंद्र"
            style={{ textDecoration: "none", background: "rgba(255,255,255,0.06)", color: "#cbd5e1", borderColor: "rgba(255,255,255,0.12)" }}
          >
            <BookOpen size={14} />
            <span>Help (गाइड)</span>
          </Link>
          <button
            type="button"
            className="sketch-tutorial-pill-btn"
            onClick={() => setTutorialOpen(true)}
            title="Watch Interactive Video Tutorial / वीडियो ट्यूटोरियल देखें"
          >
            <PlayCircle size={15} />
            <span>Video Guide</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Shell */}
      <section className="sketch-shell">
        {/* Top Controls Bar (Action Tools on Left, Zoom & Fit on Right) */}
        <div className="sketch-top-controls-bar">
          {/* Header Action Tools */}
          <div className="sketch-header-actions">
            <button type="button" className="sketch-icon-btn" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo">
              <Undo2 size={16} />
            </button>
            <button type="button" className="sketch-icon-btn" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo">
              <Redo2 size={16} />
            </button>
            <button type="button" className="sketch-icon-btn" onClick={() => setSaveModalOpen(true)} disabled={!closed || points.length < 3} title="Save Plot">
              <Save size={16} />
            </button>
            <button type="button" className="sketch-icon-btn" onClick={() => setExportModalOpen(true)} disabled={!closed || points.length < 3} title="Export (PDF, GeoJSON, KML, DXF)">
              <Download size={16} />
            </button>
            <button type="button" className="sketch-icon-btn" onClick={handleClear} title="Clear Canvas" style={{ color: "#ef4444" }}>
              <Trash2 size={16} />
            </button>
          </div>

          {/* Zoom & Fit Map Controls */}
          <div className="sketch-zoom">
            <button type="button" onClick={() => setTransform((t) => ({ ...t, scale: Math.min(3.5, t.scale * 1.25) }))} title="Zoom In">
              <ZoomIn size={15} />
            </button>
            <span>{Math.round(transform.scale * 100)}%</span>
            <button type="button" onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.4, t.scale / 1.25) }))} title="Zoom Out">
              <ZoomOut size={15} />
            </button>
            <button type="button" onClick={fitPlotToViewport} title="Fit & Center Map to Viewport" style={{ color: "#2563eb", borderLeft: "1px solid #e2e8f0" }}>
              <Maximize2 size={15} />
            </button>
          </div>
        </div>

        {/* Dismissable Warning Banner */}
        {closed && points.length >= 4 && !warningDismissed && (
          <div className="sketch-warning-banner">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <strong>Triangulation:</strong> {enteredDiagonalsCount} / {reqDiagonalsCount} diagonal(s) locked.
            </span>
            {diagonals.length > 0 && (
              <button type="button" className="sketch-btn sketch-btn-outline" onClick={resetAllDiagonals} style={{ height: 24, fontSize: 10, padding: "0 6px", borderColor: "#b45309", color: "#b45309" }}>
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
            <button type="button" className="sketch-icon-btn" onClick={() => setWarningDismissed(true)} style={{ width: 22, height: 22, border: 0, background: "transparent", color: "#b45309" }} title="Dismiss Warning">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Floating 3-Button Action Dock for Custom Diagonals Mode (➕ Add, ➖ Less, ✔️ Finish) */}
        {activeTool === "customDiagonal" && (
          <div className="sketch-diag-action-dock">
            <button
              type="button"
              className={`sketch-diag-action-btn ${customDiagSubMode === "add" ? "is-active-add" : ""}`}
              onClick={() => setCustomDiagSubMode("add")}
              title="Add Diagonals (➕ Mode)"
            >
              <Plus size={15} />
              <span>Add (➕)</span>
            </button>

            <button
              type="button"
              className={`sketch-diag-action-btn ${customDiagSubMode === "delete" ? "is-active-delete" : ""}`}
              onClick={() => { setCustomDiagSubMode("delete"); setPivotBaseIndex(null); }}
              title="Delete Diagonals (➖ Less Mode)"
            >
              <Minus size={15} />
              <span>Less (➖)</span>
            </button>

            <button
              type="button"
              className="sketch-diag-action-btn is-finish"
              onClick={() => { setActiveTool("dimension"); setPivotBaseIndex(null); setSelectedGroupTargets([]); }}
              title="Finish Custom Diagonals (✔️ Done)"
            >
              <Check size={15} />
              <span>Finish (✔️)</span>
            </button>
          </div>
        )}

        {/* Streamlined Floating Toolbar for Closed Plot */}
        {closed ? (
          <nav className="sketch-toolbar">
            <button
              type="button"
              className={`sketch-tool-btn ${activeTool === "customDiagonal" ? "is-active" : ""}`}
              onClick={() => {
                if (activeTool === "customDiagonal") {
                  setActiveTool("dimension");
                  setPivotBaseIndex(null);
                  setSelectedGroupTargets([]);
                } else {
                  setActiveTool("customDiagonal");
                }
              }}
            >
              <GitCommit size={15} />
              <span>Diagonals</span>
            </button>
            <button
              type="button"
              className={`sketch-tool-btn ${activeTool === "triangles" ? "is-active" : ""}`}
              onClick={() => setActiveTool(activeTool === "triangles" ? "dimension" : "triangles")}
            >
              <Triangle size={15} />
              <span>Triangles ({dynamicTrianglesList.length})</span>
            </button>
          </nav>
        ) : (
          <div className="sketch-draw-hint">
            <span>Tap on canvas to add plot corners. Tap green pulsing ring (V1) to close.</span>
          </div>
        )}

        {/* Interactive SVG Canvas */}
        <div ref={viewerRef} className="sketch-viewer" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="sketch-grid-bg" />
          <svg className="sketch-svg-layer" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onDoubleClick={handleSvgDoubleClick}>
            <g transform={`matrix(${transform.scale},0,0,${transform.scale},${transform.x},${transform.y})`}>
              {/* Highlighted Triangle Overlay */}
              {activeTriangleIdx !== null && dynamicTrianglesList[activeTriangleIdx] && (
                <polygon
                  points={dynamicTrianglesList[activeTriangleIdx].indices.map((idx) => `${points[idx].x},${points[idx].y}`).join(" ")}
                  fill="rgba(34, 197, 94, 0.28)"
                  stroke="#22c55e"
                  strokeWidth={3 / transform.scale}
                />
              )}

              {/* Temporary Rotational Arc Guide Overlay during Vertex Drag */}
              {selectedVertexIndex !== null && closed && (() => {
                const N = points.length;
                const prevIdx = (selectedVertexIndex - 1 + N) % N;
                const nextIdx = (selectedVertexIndex + 1) % N;
                const pPrev = points[prevIdx];
                const pNext = points[nextIdx];
                const r1 = Math.hypot(points[selectedVertexIndex].x - pPrev.x, points[selectedVertexIndex].y - pPrev.y);
                const r2 = Math.hypot(pNext.x - points[selectedVertexIndex].x, pNext.y - points[selectedVertexIndex].y);
                return (
                  <g key="rotary-arc-guides">
                    <circle cx={pPrev.x} cy={pPrev.y} r={r1} fill="none" stroke="#eab308" strokeWidth={1.5 / transform.scale} strokeDasharray="4 4" />
                    <circle cx={pNext.x} cy={pNext.y} r={r2} fill="none" stroke="#eab308" strokeWidth={1.5 / transform.scale} strokeDasharray="4 4" />
                  </g>
                );
              })()}

              {/* Outer Boundary Polygon & Interactive Line Segments */}
              {points.length >= 2 && (() => {
                const numSegments = closed ? points.length : points.length - 1;
                const segElements = [];
                for (let i = 0; i < numSegments; i++) {
                  const p1 = points[i];
                  const p2 = points[(i + 1) % points.length];
                  segElements.push(
                    <g key={`boundary-seg-${i}`}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#2563eb"
                        strokeWidth={2.5 / transform.scale}
                      />
                      {/* Invisible Wide Hit Target for Double Tap / Click */}
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="transparent"
                        strokeWidth={22 / transform.scale}
                        style={{ cursor: "crosshair" }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          const midX = (p1.x + p2.x) / 2;
                          const midY = (p1.y + p2.y) / 2;
                          insertPointOnSegment(i, midX, midY);
                        }}
                      />
                    </g>
                  );
                }
                return (
                  <g key="boundary-group">
                    {closed && points.length >= 3 && (
                      <polygon
                        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="rgba(37, 99, 235, 0.12)"
                        stroke="none"
                      />
                    )}
                    {segElements}
                  </g>
                );
              })()}

              {/* Group Multi-Selected Target Lines */}
              {activeTool === "customDiagonal" &&
                customDiagSubMode === "add" &&
                pivotBaseIndex !== null &&
                selectedGroupTargets.map((targetIdx) => {
                  const p1 = points[pivotBaseIndex];
                  const p2 = points[targetIdx];
                  if (!p1 || !p2) return null;
                  return (
                    <line
                      key={`grp-${pivotBaseIndex}-${targetIdx}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="#eab308"
                      strokeWidth={2.5 / transform.scale}
                      strokeDasharray="4 3"
                    />
                  );
                })}

              {/* Active Diagonals */}
              {closed &&
                activeDiagonalsList.map((diag) => {
                  const p1 = points[diag.fromIndex];
                  const p2 = points[diag.toIndex];
                  if (!p1 || !p2) return null;
                  const isLocked = !!diag.isLocked;
                  const isDeleteMode = activeTool === "customDiagonal" && customDiagSubMode === "delete";
                  return (
                    <g key={diag.id} onClick={(e) => { e.stopPropagation(); openPopoverForElement("diagonal", diag.id, diag.fromIndex, diag.toIndex, diag.length, isLocked); }}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={isDeleteMode ? "#ef4444" : isLocked ? "#22c55e" : "#94a3b8"}
                        strokeWidth={(isDeleteMode ? 3 : 2) / transform.scale}
                        strokeDasharray={isLocked ? "none" : "5 4"}
                        style={{ cursor: "pointer" }}
                      />
                      <g transform={`translate(${(p1.x + p2.x) / 2}, ${(p1.y + p2.y) / 2})`}>
                        <rect
                          x={-26 / transform.scale}
                          y={-10 / transform.scale}
                          width={52 / transform.scale}
                          height={20 / transform.scale}
                          rx={4 / transform.scale}
                          fill={isDeleteMode ? "#fef2f2" : isLocked ? "#dcfce7" : "#f1f5f9"}
                          stroke={isDeleteMode ? "#ef4444" : isLocked ? "#22c55e" : "#cbd5e1"}
                          strokeWidth={1 / transform.scale}
                        />
                        <text fontSize={9 / transform.scale} fontWeight="700" fill={isDeleteMode ? "#b91c1c" : isLocked ? "#15803d" : "#64748b"} textAnchor="middle" dominantBaseline="middle">
                          {isDeleteMode ? "✖ Delete" : diag.length > 0 ? `${diag.length} ${unit}` : "+ Diag"} {isLocked && !isDeleteMode ? "🔒" : ""}
                        </text>
                      </g>
                    </g>
                  );
                })}

              {/* Outer Side Labels */}
              {closed &&
                outerSides.map((side) => {
                  const p1 = points[side.fromIndex];
                  const p2 = points[side.toIndex];
                  if (!p1 || !p2) return null;
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  return (
                    <g key={side.id} transform={`translate(${midX}, ${midY})`} onClick={(e) => { e.stopPropagation(); openPopoverForElement("side", side.id, side.fromIndex, side.toIndex, side.length); }} style={{ cursor: "pointer" }}>
                      <rect x={-28 / transform.scale} y={-10 / transform.scale} width={56 / transform.scale} height={20 / transform.scale} rx={4 / transform.scale} fill={side.isLocked ? "#f0fdf4" : "#ffffff"} stroke={side.isLocked ? "#22c55e" : "#2563eb"} strokeWidth={1.5 / transform.scale} />
                      <text fontSize={10 / transform.scale} fontWeight="700" fill={side.isLocked ? "#15803d" : "#1e3a8a"} textAnchor="middle" dominantBaseline="middle">
                        {side.length > 0 ? `${side.length} ${unit}` : "Set Base Line"} {side.isLocked ? "🔒" : ""}
                      </text>
                    </g>
                  );
                })}

              {/* Corner Interior Angle Badges */}
              {closed &&
                cornerAngles.map((deg, idx) => {
                  const p = points[idx];
                  if (!p) return null;
                  return (
                    <g key={`angle-${idx}`} transform={`translate(${p.x + 14 / transform.scale}, ${p.y - 14 / transform.scale})`} onClick={(e) => { e.stopPropagation(); openPopoverForElement("angle", `angle-${idx}`, idx, idx, deg); }} style={{ cursor: "pointer" }}>
                      <rect x={-18 / transform.scale} y={-8 / transform.scale} width={36 / transform.scale} height={16 / transform.scale} rx={4 / transform.scale} fill="#fef3c7" stroke="#eab308" strokeWidth={1 / transform.scale} />
                      <text fontSize={9 / transform.scale} fontWeight="700" fill="#a16207" textAnchor="middle" dominantBaseline="middle">
                        {deg}°
                      </text>
                    </g>
                  );
                })}

              {/* Vertex 0 Pulsing Ring Target for 1-Tap Closing */}
              {points.length >= 3 && !closed && (
                <g onClick={closePolygonAtVertex0} style={{ cursor: "pointer" }}>
                  <circle cx={points[0].x} cy={points[0].y} r={18 / transform.scale} fill="none" stroke="#22c55e" strokeWidth={2.5 / transform.scale} className="sketch-pulsing-ring" />
                  <text x={points[0].x} y={points[0].y - 24 / transform.scale} fontSize={10 / transform.scale} fontWeight="700" fill="#22c55e" textAnchor="middle">
                    Tap to Close
                  </text>
                </g>
              )}

              {/* Vertices */}
              {points.map((p, idx) => {
                const isPivot = pivotBaseIndex === idx;
                const isGroupTarget = selectedGroupTargets.includes(idx);
                const isSelected = selectedVertexIndex === idx;
                let color = "#22c55e";
                if (isPivot) color = "#eab308";
                else if (isGroupTarget) color = "#8b5cf6";
                else if (isSelected) color = "#3b82f6";
                else if (idx === 0) color = "#22c55e";

                return (
                  <CrosshairPointMarker
                    key={`v-${idx}`}
                    cx={p.x}
                    cy={p.y}
                    scale={transform.scale}
                    color={color}
                    selected={isSelected}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deletePointAtIndex(idx);
                    }}
                  />
                );
              })}
            </g>
          </svg>

          {/* Tap-to-Reveal Offset Drag Handle Overlay */}
          {selectedVertexIndex !== null && points[selectedVertexIndex] && viewerRef.current && (() => {
            const N = points.length;
            const prevPt = N >= 2 ? points[(selectedVertexIndex - 1 + N) % N] : null;
            const nextPt = N >= 2 ? points[(selectedVertexIndex + 1) % N] : null;
            return (
              <OffsetDragHandleOverlay
                point={{
                  x: points[selectedVertexIndex].x * transform.scale + transform.x,
                  y: points[selectedVertexIndex].y * transform.scale + transform.y,
                }}
                prevPoint={prevPt ? {
                  x: prevPt.x * transform.scale + transform.x,
                  y: prevPt.y * transform.scale + transform.y,
                } : null}
                nextPoint={nextPt ? {
                  x: nextPt.x * transform.scale + transform.x,
                  y: nextPt.y * transform.scale + transform.y,
                } : null}
                containerRect={viewerRef.current.getBoundingClientRect()}
                onDragStart={handleDragStart}
                onDrag={handleDragPoint}
                onDragEnd={handleDragEnd}
                onDeselect={() => setSelectedVertexIndex(null)}
              />
            );
          })()}
        </div>

        {/* Collapsible Group Diagonals Setup Dock */}
        {activeTool === "customDiagonal" && customDiagSubMode === "add" && pivotBaseIndex !== null && (
          <aside className={`sketch-dock ${isGroupDockCollapsed ? "is-collapsed" : ""}`}>
            <header className="sketch-dock-header" onClick={() => setIsGroupDockCollapsed(!isGroupDockCollapsed)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="sketch-dock-badge">Base V{pivotBaseIndex + 1}</span>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>Diagonals Setup</h3>
                {isGroupDockCollapsed ? <ChevronUp size={15} color="#1e3a8a" /> : <ChevronDown size={15} color="#1e3a8a" />}
              </div>
              <button
                type="button"
                className="sketch-icon-btn"
                onClick={(e) => { e.stopPropagation(); setPivotBaseIndex(null); }}
                title="Close"
              >
                <X size={15} />
              </button>
            </header>

            {!isGroupDockCollapsed && (
              <>
                <div className="sketch-dock-body">
                  {selectedGroupTargets.length === 0 ? (
                    <div className="sketch-dock-empty">
                      <GitCommit size={20} color="#94a3b8" />
                      <span>Tap any other corner on canvas to connect a diagonal from <strong>V{pivotBaseIndex + 1}</strong></span>
                    </div>
                  ) : (
                    selectedGroupTargets.map((tIdx) => {
                      const val = groupInputLengths[tIdx] ?? "";
                      return (
                        <div key={`grp-input-${pivotBaseIndex}-${tIdx}`} className="sketch-diag-card-row">
                          <div className="sketch-diag-label-pill">
                            <span className="sketch-node-tag">V{pivotBaseIndex + 1}</span>
                            <span className="sketch-node-arrow">⟷</span>
                            <span className="sketch-node-tag">V{tIdx + 1}</span>
                          </div>
                          <div className="sketch-diag-input-box">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={val}
                              onChange={(e) => setGroupInputLengths({ ...groupInputLengths, [tIdx]: e.target.value })}
                              placeholder="Length"
                              className="sketch-diag-field"
                            />
                            <span className="sketch-field-unit">{unit}</span>
                          </div>
                          <button
                            type="button"
                            className="sketch-diag-remove-btn"
                            onClick={() => setSelectedGroupTargets((curr) => curr.filter((i) => i !== tIdx))}
                            title="Remove diagonal"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedGroupTargets.length > 0 && (
                  <footer className="sketch-dock-footer">
                    <button
                      type="button"
                      className="sketch-btn sketch-btn-success"
                      onClick={saveGroupDiagonalsBatch}
                      style={{ width: "100%", height: 38, fontSize: 13 }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Lock & Save Diagonals ({selectedGroupTargets.length})</span>
                    </button>
                  </footer>
                )}
              </>
            )}
          </aside>
        )}

        {/* Side / Diagonal / Angle Input Popover Modal */}
        {selectedElement && (
          <div className="sketch-popover-backdrop" onClick={() => setSelectedElement(null)}>
            <div className="sketch-popover-card" onClick={(e) => e.stopPropagation()}>
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h5>
                  Enter {selectedElement.type === "side" ? "Side Length" : selectedElement.type === "diagonal" ? "Diagonal Length" : "Corner Angle Degrees"}
                </h5>
                <button type="button" className="sketch-icon-btn" onClick={() => setSelectedElement(null)} style={{ width: 24, height: 24, border: 0 }}>
                  <X size={14} />
                </button>
              </header>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={selectedElement.type === "angle" ? "Degrees (e.g. 90)" : `Length in ${unit}`}
                  autoFocus
                  style={{ flex: 1, height: 38, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                />
                <button type="button" className="sketch-btn sketch-btn-primary" onClick={saveEnteredValue} style={{ height: 38, padding: "0 14px" }}>
                  Set
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <button type="button" className="sketch-btn sketch-btn-outline" onClick={() => setSelectedElement(null)} style={{ height: 30, fontSize: 11 }}>
                  Cancel
                </button>
                {selectedElement.type === "diagonal" && (
                  <button type="button" className="sketch-btn sketch-btn-outline" onClick={() => removeDiagonalById(String(selectedElement.indexOrId))} style={{ height: 30, fontSize: 11, borderColor: "#ef4444", color: "#ef4444" }}>
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Area Summary Chip */}
        {closed && points.length >= 3 && (
          <div className={`sketch-area-chip ${isAreaCollapsed ? "is-collapsed" : ""}`}>
            <header onClick={() => setIsAreaCollapsed(!isAreaCollapsed)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <small style={{ fontWeight: 700, color: "#64748b" }}>AREA</small>
                {isAreaCollapsed ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              </div>
              <select value={unit} onChange={(e) => { e.stopPropagation(); setUnit(e.target.value as "ft" | "m" | "yd"); }} onClick={(e) => e.stopPropagation()} style={{ fontSize: 10, border: "1px solid #cbd5e1", borderRadius: 6, padding: "1px 4px" }}>
                <option value="ft">ft</option>
                <option value="m">m</option>
                <option value="yd">yd</option>
              </select>
            </header>

            <div className="area-main">
              {areaSummaries.sqft} <span style={{ fontSize: 12 }}>sq.ft</span>
            </div>

            {!isAreaCollapsed && (
              <div className="sketch-area-grid">
                <span>Meters: <strong>{areaSummaries.sqm} m²</strong></span>
                <span>Acres: <strong>{areaSummaries.acre}</strong></span>
                <span>Gaj: <strong>{areaSummaries.gaj}</strong></span>
                <span>Guntha: <strong>{areaSummaries.guntha}</strong></span>
                <span>Bigha: <strong>{areaSummaries.bigha}</strong></span>
                <span>Katha: <strong>{areaSummaries.katha}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Individual Triangle Areas Dock */}
        {activeTool === "triangles" && closed && (
          <aside className="sketch-dock">
            <header className="sketch-dock-header">
              <h3>Survey Triangles ({dynamicTrianglesList.length})</h3>
              <button type="button" className="sketch-icon-btn" onClick={() => setActiveTool("dimension")}>
                <X size={16} />
              </button>
            </header>
            <div className="sketch-dock-body">
              {dynamicTrianglesList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 12 }}>
                  No triangles formed yet. Add diagonals to build survey triangles.
                </div>
              ) : (
                dynamicTrianglesList.map((t, idx) => {
                  let displayArea = (t.areaSqM * CONVERSIONS.sqft).toFixed(2);
                  let unitLabel = "sq.ft";
                  if (unit === "m") {
                    displayArea = t.areaSqM.toFixed(2);
                    unitLabel = "sq.m";
                  } else if (unit === "yd") {
                    displayArea = (t.areaSqM * CONVERSIONS.gaj).toFixed(2);
                    unitLabel = "gaj";
                  }
                  const isHovered = activeTriangleIdx === idx;
                  return (
                    <div
                      key={t.id}
                      className={`sketch-triangle-card ${isHovered ? "is-active" : ""}`}
                      onMouseEnter={() => setActiveTriangleIdx(idx)}
                      onMouseLeave={() => setActiveTriangleIdx(null)}
                      onClick={() => setActiveTriangleIdx(idx)}
                      style={{ cursor: "pointer" }}
                    >
                      <header>
                        <strong>{t.name}</strong>
                        <span>{displayArea} {unitLabel}</span>
                      </header>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Sides: {t.a} {unit}, {t.b} {unit}, {t.c} {unit}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </section>

      {/* Toast Notification */}
      {notification && (
        <div className="sketch-toast">
          {notification}
        </div>
      )}

      {/* Save Modal */}
      {saveModalOpen && (
        <div className="sketch-modal-backdrop">
          <div className="sketch-modal">
            <header className="sketch-modal-header">
              <h3>Save Field Survey Plot</h3>
              <button type="button" className="sketch-icon-btn" onClick={() => setSaveModalOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <div className="sketch-modal-body">
              <div className="sketch-input-group">
                <label>Plot Name / Khasra No.</label>
                <input type="text" value={plotName} onChange={(e) => setPlotName(e.target.value)} style={{ height: 40, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px", fontSize: 13 }} />
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Total Area: <strong>{areaSummaries.sqft} sq.ft</strong> ({areaSummaries.bigha} Bigha)
              </div>
            </div>
            <footer className="sketch-modal-footer">
              <button type="button" className="sketch-btn sketch-btn-outline" onClick={() => setSaveModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="sketch-btn sketch-btn-success" onClick={savePlotToLocal}>
                <Save size={16} />
                <span>Save Plot</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Multi-Format Export Modal */}
      {exportModalOpen && (
        <div className="sketch-modal-backdrop">
          <div className="sketch-modal">
            <header className="sketch-modal-header">
              <h3>Export Survey Drawing</h3>
              <button type="button" className="sketch-icon-btn" onClick={() => setExportModalOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <div className="sketch-modal-body">
              <div className="sketch-export-grid">
                <div className="sketch-export-card" onClick={() => downloadFile(`${plotName || "Plot"}.dxf`, exportToDxf(plotName, points, calibrationScale ?? DEFAULT_SCALE), "application/dxf")}>
                  <FileCode2 size={24} color="#2563eb" />
                  <strong>AutoCAD (.DXF)</strong>
                  <small>CAD Vector Drawings (1:1)</small>
                </div>
                <div className="sketch-export-card" onClick={handleExportPdf}>
                  <FileSpreadsheet size={24} color="#9333ea" />
                  <strong>PDF Plot Sheet</strong>
                  <small>Official Survey Report</small>
                </div>
                <div className="sketch-export-card" onClick={() => downloadFile(`${plotName || "Plot"}.svg`, exportToSvg(plotName, points, outerSides, diagonals, unit, calibrationScale ?? DEFAULT_SCALE), "image/svg+xml")}>
                  <FileImage size={24} color="#16a34a" />
                  <strong>SVG Vector Drawing</strong>
                  <small>Scalable Graphic with Labels</small>
                </div>
                <div className="sketch-export-card" onClick={() => downloadFile(`${plotName || "Plot"}-data.csv`, exportToCsv(plotName, points, outerSides, diagonals, areaSummaries, unit, calibrationScale ?? DEFAULT_SCALE), "text/csv")}>
                  <TableProperties size={24} color="#ea580c" />
                  <strong>Survey Data (.CSV)</strong>
                  <small>Excel Coordinates & Dimensions</small>
                </div>
              </div>
            </div>
            <footer className="sketch-modal-footer">
              <button type="button" className="sketch-btn sketch-btn-outline" onClick={() => setExportModalOpen(false)}>
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
      {/* Interactive Video / Animated Tutorial Modal */}
      <SketchTutorialModal
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onLoadSamplePlot={() => {
          const samplePoints: Point[] = [
            { x: 260, y: 120 },
            { x: 500, y: 110 },
            { x: 520, y: 320 },
            { x: 680, y: 350 },
            { x: 640, y: 490 },
            { x: 270, y: 480 },
          ];
          setPoints(samplePoints);
          setClosed(true);
          setPlotName("Sample Irregular Plot");
          const s0: SideMeasurement = { id: "side-0-1", fromIndex: 0, toIndex: 1, length: 24, isLocked: true, rawPxLength: 240 };
          const s1: SideMeasurement = { id: "side-1-2", fromIndex: 1, toIndex: 2, length: 35, isLocked: true, rawPxLength: 350 };
          const s2: SideMeasurement = { id: "side-2-3", fromIndex: 2, toIndex: 3, length: 18, isLocked: true, rawPxLength: 180 };
          const s3: SideMeasurement = { id: "side-3-4", fromIndex: 3, toIndex: 4, length: 26, isLocked: true, rawPxLength: 260 };
          const s4: SideMeasurement = { id: "side-4-5", fromIndex: 4, toIndex: 5, length: 43, isLocked: true, rawPxLength: 430 };
          const s5: SideMeasurement = { id: "side-5-0", fromIndex: 5, toIndex: 0, length: 56, isLocked: true, rawPxLength: 560 };
          setOuterSides([s0, s1, s2, s3, s4, s5]);
          const d0: DiagonalMeasurement = { id: "diag-2-0", fromIndex: 2, toIndex: 0, length: 40, isLocked: true, rawPxLength: 400 };
          const d1: DiagonalMeasurement = { id: "diag-2-5", fromIndex: 2, toIndex: 5, length: 33, isLocked: true, rawPxLength: 330 };
          const d2: DiagonalMeasurement = { id: "diag-2-4", fromIndex: 2, toIndex: 4, length: 35.5, isLocked: true, rawPxLength: 355 };
          setDiagonals([d0, d1, d2]);
          setCalibrationScale(10);
          notify("Loaded 6-Corner Field Survey Plot (4 Triangles: 1,864.47 sq.ft)");
        }}
      />
    </main>
  );
}
