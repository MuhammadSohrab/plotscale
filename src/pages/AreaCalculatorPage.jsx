import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Download,
  Grid3X3,
  Layers,
  Lock,
  MapPinned,
  Plus,
  Save,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Triangle,
  Unlock,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { FeatureCard } from "../components/FeatureCard";
import { PlotActionDialog } from "../components/calculator/PlotActionDialog";
import { PlotDiagram } from "../components/calculator/PlotDiagram";
import { CrosshairPointMarker } from "../components/common/PointMarker";
import { OffsetDragHandleOverlay } from "../components/common/OffsetDragHandle";
import {
  calculateCustomShape,
  calculateIrregularPlot,
  calculateRegularShape,
  calculateTriangleRows,
} from "../services/GeometryService";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";

import MapDrawMode from "../components/map/MapDrawMode";

const MANUAL_MODES = [
  { id: "triangles", label: "Triangle Plot", description: "Calculate one or several connected survey triangles", icon: Triangle, tone: "blue" },
  { id: "irregular", label: "Irregular Plot", description: "Measure a four-sided plot with an optional diagonal", icon: Square, tone: "green" },
  { id: "regular", label: "Regular Shapes", description: "Use exact formulas for standard equal-angle shapes", icon: Shapes, tone: "blue" },
];

const CALCULATION_MODE_IDS = new Set([...MANUAL_MODES.map((mode) => mode.id), "map", "map_mode"]);

const MODE_DETAILS = {
  triangles: {
    title: "Triangle Plot",
    description: "Calculate a single triangle or combine multiple survey triangles.",
    icon: Triangle,
  },
  irregular: {
    title: "Irregular Plot",
    description: "Enter four boundary sides and add one diagonal when an exact split is available.",
    icon: Square,
  },
  regular: {
    title: "Regular Shapes",
    description: "Choose a standard shape and enter only the dimensions required by its exact formula.",
    icon: Shapes,
  },
  map: {
    title: "Map Measurement",
    description: "Mark and refine plot corners directly on Google satellite imagery.",
    icon: MapPinned,
  },
  map_mode: {
    title: "Map Mode",
    description: "Full-featured map surveying tool with autocomplete, satellite layers, and GeoJSON/KML export.",
    icon: MapPinned,
  },
};

const REGULAR_SHAPES = [
  { id: "square", label: "Square", fields: ["Side"] },
  { id: "rectangle", label: "Rectangle", fields: ["Length", "Width"] },
  { id: "pentagon", label: "Pentagon", fields: ["Side"] },
  { id: "hexagon", label: "Hexagon", fields: ["Side"] },
];

const fallbackLengthUnits = [
  { id: "METER", name: "Metre", symbol: "m", factorToBase: "1" },
  { id: "FOOT", name: "Foot", symbol: "ft", factorToBase: "0.3048" },
  { id: "YARD", name: "Yard", symbol: "yd", factorToBase: "0.9144" },
];

const fallbackAreaUnits = [
  { id: "SQM", name: "Square metre", symbol: "m²", factorToBase: "1" },
  { id: "SQFT", name: "Square foot", symbol: "ft²", factorToBase: "0.09290304" },
  { id: "SQYD", name: "Square yard", symbol: "yd²", factorToBase: "0.83612736" },
  { id: "ACRE", name: "Acre", symbol: "ac", factorToBase: "4046.8564224" },
  { id: "HECTARE", name: "Hectare", symbol: "ha", factorToBase: "10000" },
];

const newTriangle = (number) => ({
  id: crypto.randomUUID(),
  name: `Triangle ${number}`,
  values: ["", "", ""],
});

const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const format = (value, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);

const diagonalGroupsFromPairs = (pairs = []) => {
  const groups = new Map();
  pairs.forEach(([base, connected]) => {
    if (!groups.has(base)) {
      groups.set(base, { id: crypto.randomUUID(), base, connected: [] });
    }
    groups.get(base).connected.push(connected);
  });
  return [...groups.values()];
};

function ValueField({ label, value, unitSymbol, onChange, placeholder = "0" }) {
  return (
    <label className="measurement-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <small>{unitSymbol}</small>
      </div>
    </label>
  );
}

function computeDynamicVertices(result, defaultCorners) {
  if (result && Array.isArray(result.vertices) && result.vertices.length === 4) {
    const raw = result.vertices;
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);

    const targetW = 310;
    const targetH = 245;
    const scale = Math.min(targetW / spanX, targetH / spanY);

    const offsetX = 45 + ((targetW - (spanX * scale)) / 2);
    const offsetY = 35 + ((targetH - (spanY * scale)) / 2);

    return raw.map((p, idx) => ({
      x: offsetX + ((p.x - minX) * scale),
      y: offsetY + ((maxY - p.y) * scale),
      label: `C${idx + 1}`,
    }));
  }
  return defaultCorners;
}

function solve4BarLinkage(corners, draggedIdx, targetPoint, sides, calibrationScale) {
  const N = 4;
  const pts = corners.map((p, idx) => (idx === draggedIdx ? { ...p, x: targetPoint.x, y: targetPoint.y } : { ...p }));

  const targetPx = new Array(N);
  for (let i = 0; i < N; i++) {
    const nextIdx = (i + 1) % N;
    const lenVal = sides[i] && Number(sides[i]) > 0 ? Number(sides[i]) : null;
    if (lenVal && calibrationScale) {
      targetPx[i] = lenVal * calibrationScale;
    } else {
      targetPx[i] = Math.hypot(corners[nextIdx].x - corners[i].x, corners[nextIdx].y - corners[i].y);
    }
  }

  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < N; i++) {
      const nextIdx = (i + 1) % N;
      const p1 = pts[i];
      const p2 = pts[nextIdx];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const curDist = Math.hypot(dx, dy);
      if (curDist < 1e-4) continue;

      const diff = (curDist - targetPx[i]) / curDist;
      const moveX = dx * 0.5 * diff;
      const moveY = dy * 0.5 * diff;

      if (i === draggedIdx) {
        pts[nextIdx].x -= moveX * 2;
        pts[nextIdx].y -= moveY * 2;
      } else if (nextIdx === draggedIdx) {
        pts[i].x += moveX * 2;
        pts[i].y += moveY * 2;
      } else {
        pts[i].x += moveX;
        pts[i].y += moveY;
        pts[nextIdx].x -= moveX;
        pts[nextIdx].y -= moveY;
      }
    }
  }

  pts[draggedIdx] = { ...pts[draggedIdx], x: targetPoint.x, y: targetPoint.y };
  return pts;
}

function IrregularSingleCanvasCalculator({
  sides,
  onSidesChange,
  diagonalValue,
  onDiagonalValueChange,
  selectedDiagonalType,
  onSelectDiagonalType,
  lengthUnit,
  areaUnit,
  lengthUnits,
  areaUnits,
  onLengthUnitChange,
  onAreaUnitChange,
  onSave,
  onExportPdf,
  result,
  error,
}) {
  const [editingTarget, setEditingTarget] = useState(null);
  const [compassAngle, setCompassAngle] = useState(0);
  const [selectedCornerIndex, setSelectedCornerIndex] = useState(null);
  const [calibrationScale, setCalibrationScale] = useState(null);

  const defaultCorners = useMemo(() => [
    { x: 50, y: 265, label: "C1" },
    { x: 350, y: 265, label: "C2" },
    { x: 310, y: 45, label: "C3" },
    { x: 90, y: 65, label: "C4" },
  ], []);

  const [localCorners, setLocalCorners] = useState(defaultCorners);
  const dragStartPointRef = useRef(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const isLocked = Boolean(diagonalValue && Number(diagonalValue) > 0 && result);

  const corners = useMemo(() => {
    if (isLocked && result?.vertices?.length === 4) {
      return computeDynamicVertices(result, defaultCorners);
    }
    return localCorners;
  }, [isLocked, result, defaultCorners, localCorners]);

  const c1 = corners[0];
  const c2 = corners[1];
  const c3 = corners[2];
  const c4 = corners[3];

  const sideLabels = ["Side 1", "Side 2", "Side 3", "Side 4"];

  const rotateCompass = () => {
    setCompassAngle((prev) => (prev + 45) % 360);
  };

  const getScreenPos = useCallback((pt) => {
    if (!svgRef.current || !containerRef.current || !pt) return null;
    const svg = svgRef.current;
    const p = svg.createSVGPoint();
    p.x = pt.x;
    p.y = pt.y;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const screenP = p.matrixTransform(ctm);
    const container = containerRef.current.getBoundingClientRect();
    return {
      x: screenP.x - container.left,
      y: screenP.y - container.top,
    };
  }, []);

  const handleCornerDragStart = useCallback(() => {
    if (selectedCornerIndex === null || isLocked) return;
    dragStartPointRef.current = { ...corners[selectedCornerIndex] };
  }, [selectedCornerIndex, isLocked, corners]);

  const handleCornerDrag = useCallback(({ dx, dy }) => {
    if (selectedCornerIndex === null || !dragStartPointRef.current || isLocked) return;
    let svgScale = 1;
    if (svgRef.current) {
      const ctm = svgRef.current.getScreenCTM();
      if (ctm && ctm.a) svgScale = ctm.a;
    }
    const start = dragStartPointRef.current;
    const targetPoint = {
      x: Math.max(15, Math.min(385, start.x + dx / svgScale)),
      y: Math.max(15, Math.min(305, start.y + dy / svgScale)),
    };

    const solved = solve4BarLinkage(corners, selectedCornerIndex, targetPoint, sides, calibrationScale);
    setLocalCorners(solved);

    if (calibrationScale) {
      const next = [...sides];
      for (let i = 0; i < 4; i++) {
        const p1 = solved[i];
        const p2 = solved[(i + 1) % 4];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        next[i] = String(Math.round(d / calibrationScale));
      }
      onSidesChange(next);
    }
  }, [selectedCornerIndex, isLocked, corners, sides, calibrationScale, onSidesChange]);

  const handleCornerDragEnd = useCallback(() => {
    dragStartPointRef.current = null;
  }, []);

  const handleSideSubmit = (index, value) => {
    const num = Number(value);
    if (num > 0) {
      const p1 = corners[index];
      const p2 = corners[(index + 1) % 4];
      const pxDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const newScale = pxDist / num;
      setCalibrationScale(newScale);

      const next = [...sides];
      next[index] = value;
      for (let i = 0; i < 4; i++) {
        if (i !== index && (!next[i] || Number(next[i]) <= 0)) {
          const pa = corners[i];
          const pb = corners[(i + 1) % 4];
          const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
          next[i] = String(Math.round(d / newScale));
        }
      }
      onSidesChange(next);
    } else {
      onSidesChange(sides.map((v, i) => i === index ? value : v));
    }
    setEditingTarget(null);
  };

  return (
    <div className="irregular-single-canvas-calculator flex flex-col gap-3">
      {/* 1. Header Bar: Unit Selectors & Linkage Mode Status */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
              <Lock size={13} className="text-emerald-600" />
              Locked to Diagonal Survey
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
              <Unlock size={13} className="text-blue-600" />
              4-Bar Linkage (Tap corners to drag)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Input length:</span>
            <select
              value={lengthUnit.id}
              onChange={(e) => onLengthUnitChange(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            >
              {lengthUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Output area:</span>
            <select
              value={areaUnit.id}
              onChange={(e) => onAreaUnitChange(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            >
              {areaUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* 2. Stretched & Maximized Drawing Canvas */}
      <div
        ref={containerRef}
        className="relative w-full bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 rounded-3xl p-3 sm:p-5 flex flex-col items-center justify-center overflow-hidden border border-slate-200 shadow-lg min-h-[440px] sm:min-h-[520px] h-[55vh] sm:h-[62vh]"
        onClick={() => setSelectedCornerIndex(null)}
      >
        {/* 360° Rotatable Compass Dial Only (Top-Right) */}
        <div
          className="absolute top-4 right-4 z-10 cursor-pointer group hover:scale-105 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            rotateCompass();
          }}
          title="Click to rotate compass (360°)"
        >
          <svg viewBox="0 0 50 50" className="w-12 h-12 sm:w-14 sm:h-14 select-none drop-shadow-md">
            <circle cx="25" cy="25" r="23" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" className="shadow-md" />
            <circle cx="25" cy="25" r="20" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
            <g style={{ transformOrigin: "25px 25px", transform: `rotate(${compassAngle}deg)`, transition: "transform 300ms ease" }}>
              <polygon points="25,6 29,25 25,21 21,25" fill="#ef4444" />
              <polygon points="25,44 29,25 25,29 21,25" fill="#3b82f6" />
              <circle cx="25" cy="25" r="3" fill="#0f172a" />
              <text x="25" y="14" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="black">N</text>
            </g>
            <text x="25" y="38" textAnchor="middle" fill="#1e293b" fontSize="7.5" fontWeight="bold">
              {compassAngle}°
            </text>
          </svg>
        </div>

        {/* Huge SVG Drawing Canvas */}
        <svg ref={svgRef} viewBox="0 0 400 320" className="w-full h-full max-w-2xl select-none">
          <defs>
            <pattern id="light-grid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#light-grid)" opacity="0.6" rx="16" />

          {/* Polygon Fill */}
          <polygon
            points={`${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y}`}
            fill={result?.exactness === "confirmed" ? "#10b981" : "#2563eb"}
            fillOpacity={result ? "0.14" : "0.05"}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />

          {/* 4 Boundary Sides - CLEAN Lines without ugly S1/S2 badges */}
          {[
            { p1: c1, p2: c2, idx: 0, label: sideLabels[0] },
            { p1: c2, p2: c3, idx: 1, label: sideLabels[1] },
            { p1: c3, p2: c4, idx: 2, label: sideLabels[2] },
            { p1: c4, p2: c1, idx: 3, label: sideLabels[3] },
          ].map(({ p1, p2, idx, label }) => {
            const val = sides[idx];
            const isFilled = Boolean(val && Number(val) > 0);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g
                key={`side-${idx}`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTarget({ type: "side", index: idx, label });
                }}
              >
                {/* Thick Invisible Hitbox Line for Easy Tap */}
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="transparent"
                  strokeWidth="24"
                />

                {/* Visible Boundary Line */}
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={isFilled ? "#16a34a" : "#2563eb"}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  className="group-hover:stroke-blue-600 transition-all filter drop-shadow-sm"
                />

                {/* Display Value Tag ONLY when entered */}
                {isFilled && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-36" y="-13" width="72" height="26" rx="13"
                      fill="#15803d" stroke="#86efac" strokeWidth="1.5"
                      className="shadow-md hover:scale-105 transition-transform"
                    />
                    <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="black">
                      {val} {lengthUnit.symbol}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Interactive Diagonal C1 ↔ C3 - CLEAN Line */}
          <g
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDiagonalType("C1_C3");
              setEditingTarget({ type: "diagonal", typeKey: "C1_C3", label: "Diagonal C1 ↔ C3" });
            }}
          >
            <line x1={c1.x} y1={c1.y} x2={c3.x} y2={c3.y} stroke="transparent" strokeWidth="24" />
            <line
              x1={c1.x} y1={c1.y} x2={c3.x} y2={c3.y}
              stroke={selectedDiagonalType === "C1_C3" ? "#1d4ed8" : "#cbd5e1"}
              strokeWidth={selectedDiagonalType === "C1_C3" ? "4" : "2"}
              strokeDasharray={selectedDiagonalType === "C1_C3" ? "none" : "6 4"}
            />
            {selectedDiagonalType === "C1_C3" && diagonalValue && (
              <g transform={`translate(${(c1.x + c3.x) / 2}, ${(c1.y + c3.y) / 2})`}>
                <rect
                  x="-38" y="-13" width="76" height="26" rx="13"
                  fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.5"
                  className="shadow-md"
                />
                <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="black">
                  {diagonalValue} {lengthUnit.symbol}
                </text>
              </g>
            )}
          </g>

          {/* Interactive Diagonal C2 ↔ C4 - CLEAN Line */}
          <g
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDiagonalType("C2_C4");
              setEditingTarget({ type: "diagonal", typeKey: "C2_C4", label: "Diagonal C2 ↔ C4" });
            }}
          >
            <line x1={c2.x} y1={c2.y} x2={c4.x} y2={c4.y} stroke="transparent" strokeWidth="24" />
            <line
              x1={c2.x} y1={c2.y} x2={c4.x} y2={c4.y}
              stroke={selectedDiagonalType === "C2_C4" ? "#7e22ce" : "#cbd5e1"}
              strokeWidth={selectedDiagonalType === "C2_C4" ? "4" : "2"}
              strokeDasharray={selectedDiagonalType === "C2_C4" ? "none" : "6 4"}
            />
            {selectedDiagonalType === "C2_C4" && diagonalValue && (
              <g transform={`translate(${(c2.x + c4.x) / 2}, ${(c2.y + c4.y) / 2})`}>
                <rect
                  x="-38" y="-13" width="76" height="26" rx="13"
                  fill="#7e22ce" stroke="#d8b4fe" strokeWidth="1.5"
                  className="shadow-md"
                />
                <text x="0" y="4.5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="black">
                  {diagonalValue} {lengthUnit.symbol}
                </text>
              </g>
            )}
          </g>

          {/* Corner Rotary Joint Nodes */}
          {corners.map((pt, idx) => (
            <g
              key={pt.label}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!isLocked) {
                  setSelectedCornerIndex(idx);
                }
              }}
            >
              <CrosshairPointMarker
                cx={pt.x}
                cy={pt.y}
                scale={1}
                color={selectedCornerIndex === idx ? "#3b82f6" : "#22c55e"}
                selected={selectedCornerIndex === idx}
                label={pt.label}
              />
            </g>
          ))}
        </svg>

        {/* Tap-to-Reveal Offset Drag Handle Overlay */}
        {selectedCornerIndex !== null && !isLocked && corners[selectedCornerIndex] && containerRef.current && (() => {
          const curPt = corners[selectedCornerIndex];
          const prevPt = corners[(selectedCornerIndex - 1 + 4) % 4];
          const nextPt = corners[(selectedCornerIndex + 1) % 4];
          const screenPos = getScreenPos(curPt);
          const prevPos = getScreenPos(prevPt);
          const nextPos = getScreenPos(nextPt);
          if (!screenPos) return null;

          return (
            <OffsetDragHandleOverlay
              point={screenPos}
              prevPoint={prevPos}
              nextPoint={nextPos}
              containerRect={containerRef.current.getBoundingClientRect()}
              onDragStart={handleCornerDragStart}
              onDrag={handleCornerDrag}
              onDragEnd={handleCornerDragEnd}
              onDeselect={() => setSelectedCornerIndex(null)}
            />
          );
        })()}
      </div>

      {/* 3. Compact Live Area Result Card & Actions */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {result && (
        <div className={`px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border transition-all ${
          result.exactness === "confirmed"
            ? "bg-emerald-900 text-white border-emerald-700 shadow-md"
            : "bg-amber-950 text-amber-100 border-amber-800 shadow-md"
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div>
              <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full inline-block mb-1 ${
                result.exactness === "confirmed"
                  ? "bg-emerald-400/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-400/20 text-amber-300 border border-amber-500/30"
              }`}>
                {result.exactness === "confirmed" ? "✓ Confirmed 100% Exact Survey" : "⚠️ Estimated Cyclic Area"}
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                {format((result.areaSqm / Number(areaUnit.factorToBase)), 4)} {areaUnit.symbol}
              </h3>
              <p className="text-xs opacity-80 font-mono mt-0.5">
                {format(result.areaSqm, 2)} m² · {format(result.areaSqm * 10.7639104167, 2)} sq.ft
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onExportPdf}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Download size={15} /> Export PDF
              </button>
              <button
                type="button"
                onClick={onSave}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow flex items-center justify-center gap-1.5 transition-all"
              >
                <Save size={15} /> Save Plot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. On-Tap Fly Input Popover Modal */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Calculator className="text-blue-600" size={18} />
                Set Length: {editingTarget.label}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Enter measurement ({lengthUnit.name} - {lengthUnit.symbol}):
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    autoFocus
                    placeholder="e.g. 85.5"
                    defaultValue={editingTarget.type === "side" ? sides[editingTarget.index] : diagonalValue}
                    id="fly-input-val"
                    className="w-full text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value;
                        if (editingTarget.type === "side") {
                          handleSideSubmit(editingTarget.index, val);
                        } else {
                          onDiagonalValueChange(val);
                          setEditingTarget(null);
                        }
                      }
                    }}
                  />
                  <span className="absolute right-3 text-xs font-bold text-slate-400">
                    {lengthUnit.symbol}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (editingTarget.type === "side") {
                      handleSideSubmit(editingTarget.index, "");
                    } else {
                      onDiagonalValueChange("");
                      setEditingTarget(null);
                    }
                  }}
                  className="flex-1 py-2 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("fly-input-val");
                    const val = el ? el.value : "";
                    if (editingTarget.type === "side") {
                      handleSideSubmit(editingTarget.index, val);
                    } else {
                      onDiagonalValueChange(val);
                      setEditingTarget(null);
                    }
                  }}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
                >
                  Done ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AreaCalculatorChooser() {
  return (
    <main className="calculator-page calculator-chooser">
      <header className="calculator-header">
        <Link to="/dashboard" className="icon-button" aria-label="Back to dashboard">
          <ArrowLeft size={19} />
        </Link>
        <Brand compact />
        <span className="calculator-header__chip"><Calculator size={14} /> Area Calculator</span>
      </header>
      <section className="calculator-chooser__intro">
        <small>AREA CALCULATOR</small>
        <h1>Choose your plot type</h1>
        <p>Select the shape that matches your field sketch or survey measurements.</p>
      </section>
      <section className="calculator-choice-grid" aria-label="Area calculator types">
        {MANUAL_MODES.map((mode) => (
          <FeatureCard
            key={mode.id}
            icon={mode.icon}
            title={mode.label}
            description={mode.description}
            tone={mode.tone}
            to={`/calculator?mode=${mode.id}`}
          />
        ))}
      </section>
    </main>
  );
}

export function AreaCalculatorPage() {
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const editId = searchParams.get("edit");
  if (!editId && !CALCULATION_MODE_IDS.has(requestedMode)) {
    return <AreaCalculatorChooser />;
  }
  return (
    <AreaCalculationWorkspace
      key={editId ? `edit-${editId}` : requestedMode}
      requestedMode={requestedMode}
      editId={editId}
    />
  );
}

function AreaCalculationWorkspace({ requestedMode, editId }) {
  const initialMode = CALCULATION_MODE_IDS.has(requestedMode) ? requestedMode : "irregular";
  const [mode, setMode] = useState(initialMode);
  const [lengthUnitId, setLengthUnitId] = useState("FOOT");
  const [areaUnitId, setAreaUnitId] = useState("SQFT");
  const [irregularSides, setIrregularSides] = useState(["", "", "", ""]);
  const [irregularDiagonal, setIrregularDiagonal] = useState("");
  const [selectedDiagonalType, setSelectedDiagonalType] = useState("C1_C3");
  const [triangles, setTriangles] = useState([newTriangle(1)]);
  const [regularShape, setRegularShape] = useState("square");
  const [regularValues, setRegularValues] = useState([""]);
  const [customSideCount, setCustomSideCount] = useState(5);
  const [customSides, setCustomSides] = useState(Array(5).fill(""));
  const [customDiagonals, setCustomDiagonals] = useState(Array(2).fill(""));
  const [mapPoints, setMapPoints] = useState([]);
  const [mapNavigationPoint, setMapNavigationPoint] = useState(null);
  const [mapDiagonalGroups, setMapDiagonalGroups] = useState([]);
  const mapDiagonalPairs = useMemo(
    () => mapDiagonalGroups.flatMap((group) =>
      group.connected.map((connected) => [group.base, connected])),
    [mapDiagonalGroups],
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [actionDialog, setActionDialog] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [boundaries, setBoundaries] = useState([]);
  const [currentPlotId, setCurrentPlotId] = useState(editId);
  const [saveMessage, setSaveMessage] = useState("");

  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    units,
    hydrate,
  } = useUnitStore();

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);

  const lengthUnits = useMemo(() => {
    const available = units.filter((unit) =>
      unit.dimension === "length"
      && unit.factorToBase !== null
      && !unit.isArchived
      && unit.status !== "historical");
    return available.length ? available : fallbackLengthUnits;
  }, [units]);

  const areaUnits = useMemo(() => {
    const available = units.filter((unit) =>
      unit.dimension === "area"
      && unit.factorToBase !== null
      && !unit.isArchived
      && unit.status !== "historical");
    return available.length ? available : fallbackAreaUnits;
  }, [units]);

  const lengthUnit = lengthUnits.find((unit) => unit.id === lengthUnitId)
    ?? lengthUnits[0]
    ?? fallbackLengthUnits[0];
  const areaUnit = areaUnits.find((unit) => unit.id === areaUnitId)
    ?? areaUnits[0]
    ?? fallbackAreaUnits[0];
  const lengthFactor = Number(lengthUnit.factorToBase);

  const convertLengthInputs = (nextId) => {
    const nextUnit = lengthUnits.find((unit) => unit.id === nextId);
    if (!nextUnit) return;
    const ratio = Number(lengthUnit.factorToBase) / Number(nextUnit.factorToBase);
    const convert = (value) => positiveNumber(value)
      ? String(Number((positiveNumber(value) * ratio).toPrecision(12)))
      : value;
    setIrregularSides((current) => current.map(convert));
    setIrregularDiagonal(convert);
    setTriangles((current) => current.map((triangle) => ({
      ...triangle,
      values: triangle.values.map(convert),
    })));
    setRegularValues((current) => current.map(convert));
    setCustomSides((current) => current.map(convert));
    setCustomDiagonals((current) => current.map(convert));
    setLengthUnitId(nextId);
  };

  const toMeters = (value) => positiveNumber(value) * lengthFactor;
  const withDisplayLabels = (calculated) => ({
    ...calculated,
    sideLabels: calculated.sideLengthsMeters.map((side) =>
      `${format(side / lengthFactor, 3)} ${lengthUnit.symbol}`),
    diagonalPairs: calculated.mode === "irregular"
      ? (calculated.diagonalsMeters.length ? (calculated.diagonalType === "C2_C4" ? [[1, 3]] : [[0, 2]]) : [])
      : calculated.mode === "custom"
        ? calculated.diagonalsMeters.map((_, index) => [0, index + 2])
        : [],
  });

  const calculate = () => {
    setError("");
    setSaveMessage("");
    try {
      let calculated;
      if (mode === "irregular") {
        calculated = calculateIrregularPlot(
          irregularSides.map(toMeters),
          selectedDiagonalType !== "none" && irregularDiagonal ? toMeters(irregularDiagonal) : null,
          selectedDiagonalType,
        );
      } else if (mode === "triangles") {
        calculated = calculateTriangleRows(triangles.map((triangle) => ({
          id: triangle.id,
          name: triangle.name,
          sidesMeters: triangle.values.map(toMeters),
        })));
      } else if (mode === "regular") {
        calculated = calculateRegularShape(regularShape, regularValues.map(toMeters));
      } else if (mode === "custom") {
        calculated = calculateCustomShape(
          customSides.map(toMeters),
          customDiagonals.map(toMeters),
        );
      }
      setResult(withDisplayLabels(calculated));
    } catch (caught) {
      setResult(null);
      setError(caught.message);
    }
  };

  useEffect(() => {
    if (mode === "irregular") {
      const hasAnySides = irregularSides.some((val) => positiveNumber(val) > 0);
      if (hasAnySides) {
        try {
          const calculated = calculateIrregularPlot(
            irregularSides.map(toMeters),
            selectedDiagonalType !== "none" && irregularDiagonal ? toMeters(irregularDiagonal) : null,
            selectedDiagonalType,
          );
          setResult(withDisplayLabels(calculated));
          setError("");
        } catch (caught) {
          setResult(null);
          setError(caught.message);
        }
      } else {
        setResult(null);
        setError("");
      }
    }
  }, [mode, irregularSides, irregularDiagonal, selectedDiagonalType, lengthUnitId, areaUnitId]);

  const updateMapResult = useCallback((nextResult) => {
    setResult(nextResult);
  }, []);

  const updateCustomCount = (count) => {
    const nextCount = Math.max(5, Math.min(10, count));
    setCustomSideCount(nextCount);
    setCustomSides((current) => Array.from({ length: nextCount }, (_, index) => current[index] ?? ""));
    setCustomDiagonals((current) =>
      Array.from({ length: nextCount - 3 }, (_, index) => current[index] ?? ""));
    setResult(null);
  };

  const updateTriangleCount = (count) => {
    const nextCount = Math.max(1, Math.min(30, count));
    setTriangles((current) => {
      if (nextCount > current.length) {
        const added = Array.from({ length: nextCount - current.length }, (_, i) =>
          newTriangle(current.length + i + 1)
        );
        return [...current, ...added];
      } else if (nextCount < current.length) {
        return current.slice(0, nextCount);
      }
      return current;
    });
    setResult(null);
  };

  useEffect(() => {
    if (!editId) return;
    let active = true;
    Promise.all([
      localDatabaseService.getPlot(editId),
      localDatabaseService.getMeasurements(editId),
      localDatabaseService.getBoundary(editId),
    ]).then(([plot, measurements, boundary]) => {
      if (!active || !plot || plot.ownerUserId !== user?.id) return;
      const snapshot = plot.resultSnapshot;
      setCurrentPlotId(plot.id);
      setMetadata(plot.metadata ?? { plotName: plot.name });
      setBoundaries(boundary?.sides ?? []);
      setMode(plot.calculationMode ?? (plot.mode === "map" ? "map" : "irregular"));
      setLengthUnitId(plot.inputUnitId ?? "FOOT");
      setAreaUnitId(plot.outputUnitId ?? "SQFT");
      setResult(snapshot ?? null);
      if (plot.mapState) {
        setMapPoints(plot.mapState.points ?? []);
        setMapNavigationPoint(plot.mapState.navigationPoint ?? null);
        setMapDiagonalGroups(
          plot.mapState.diagonalGroups
          ?? diagonalGroupsFromPairs(plot.mapState.diagonalPairs),
        );
      }
      const input = plot.inputSnapshot;
      if (input?.irregularSides) {
        setIrregularSides(input.irregularSides);
        setIrregularDiagonal(input.irregularDiagonal ?? "");
      }
      if (input?.triangles) setTriangles(input.triangles);
      if (input?.regularShape) {
        setRegularShape(input.regularShape);
        setRegularValues(input.regularValues);
      }
      if (input?.customSides) {
        setCustomSideCount(input.customSides.length);
        setCustomSides(input.customSides);
        setCustomDiagonals(input.customDiagonals ?? []);
      }
      if (!snapshot && measurements?.[0]) {
        setResult({
          mode: plot.calculationMode,
          areaSqm: measurements[0].calculatedAreaSqm,
          sideLengthsMeters: measurements[0].sideLengthsMeters,
          diagonalsMeters: measurements[0].diagonalsMeters,
        });
      }
    }).catch(() => setError("The saved plot could not be loaded."));
    return () => {
      active = false;
    };
  }, [editId, user?.id]);

  const inputSnapshot = {
    irregularSides,
    irregularDiagonal,
    triangles,
    regularShape,
    regularValues,
    customSides,
    customDiagonals,
  };

  const reportSnapshot = result ? {
    schemaVersion: 1,
    sourceType: mode === "map" ? "map" : "manual",
    calculationMode: mode,
    mode,
    inputUnit: lengthUnit,
    outputUnit: areaUnit,
    triangles,
    result,
    metadata,
    boundaries,
    map: mode === "map" ? {
      points: mapPoints,
      navigationPoint: mapNavigationPoint,
      diagonalGroups: mapDiagonalGroups,
      centroid: mapPoints.length ? {
        lat: mapPoints.reduce((sum, point) => sum + point.lat, 0) / mapPoints.length,
        lng: mapPoints.reduce((sum, point) => sum + point.lng, 0) / mapPoints.length,
      } : null,
    } : null,
  } : null;

  const savePlot = async ({ metadata: nextMetadata, boundaries: nextBoundaries }) => {
    const plotInput = {
      id: currentPlotId ?? undefined,
      name: nextMetadata.plotName,
      mode: mode === "map" ? "map" : "manual",
      ownerUserId: user.id,
      calculationMode: mode,
      inputUnitId: lengthUnit.id,
      outputUnitId: areaUnit.id,
      inputSnapshot,
      resultSnapshot: result,
      mapState: mode === "map" ? {
        points: mapPoints,
        navigationPoint: mapNavigationPoint,
        diagonalPairs: mapDiagonalPairs,
        diagonalGroups: mapDiagonalGroups,
      } : null,
      metadata: nextMetadata,
    };
    const saved = currentPlotId
      ? await localDatabaseService.updatePlot(currentPlotId, plotInput)
      : await localDatabaseService.savePlot(plotInput);
    await Promise.all([
      localDatabaseService.saveMeasurements(saved.id, {
        sideLengthsMeters: result.sideLengthsMeters,
        diagonalsMeters: result.diagonalsMeters,
        anglesDegrees: [],
        calculatedAreaSqm: result.areaSqm,
        method: result.method,
        exactness: result.exactness,
      }),
      localDatabaseService.saveBoundary(saved.id, { sides: nextBoundaries }),
      localDatabaseService.savePlotUnitSnapshot(saved.id, {
        inputUnit: {
          id: lengthUnit.id,
          name: lengthUnit.name,
          symbol: lengthUnit.symbol,
          factorToBase: String(lengthUnit.factorToBase),
        },
        outputUnit: {
          id: areaUnit.id,
          name: areaUnit.name,
          symbol: areaUnit.symbol,
          factorToBase: String(areaUnit.factorToBase),
        },
      }),
    ]);
    setCurrentPlotId(saved.id);
    setMetadata(nextMetadata);
    setBoundaries(nextBoundaries);
    setSaveMessage("Plot saved securely on this device.");
  };

  const displayedArea = result ? result.areaSqm / Number(areaUnit.factorToBase) : 0;
  const modeDetails = MODE_DETAILS[mode] ?? MODE_DETAILS.irregular;
  const ModeIcon = modeDetails.icon;
  const backPath = mode === "map" || mode === "map_mode" ? "/dashboard" : "/calculator";

  if (mode === "map_mode" || mode === "map") {
    return (
      <main className="calculator-page calculator-page--map_mode p-0 h-[100dvh] max-h-[100dvh] w-screen flex flex-col font-sans overflow-hidden">
        <header className="calculator-header px-4 sm:px-6 py-3 z-[1001] shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm">
          <Link to="/dashboard" className="icon-button" aria-label="Back to dashboard">
            <ArrowLeft size={19} />
          </Link>
          <Brand compact />
          <span className="calculator-header__chip">
            <ModeIcon size={14} /> Map Mode
          </span>
        </header>
        <div className="flex-1 w-full relative overflow-hidden flex flex-col min-h-0">
          <MapDrawMode
            initialPoints={mapPoints}
            onPointsChange={setMapPoints}
            navigationPoint={mapNavigationPoint}
            onNavigationPointChange={setMapNavigationPoint}
            areaOutputUnit={areaUnit.id}
            onAreaOutputUnitChange={(uId) => {
              const found = areaUnits.find((x) => x.id === uId || x.unit_id === uId);
              if (found) setAreaUnitId(found.id);
            }}
            onSave={() => setActionDialog("save")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className={`calculator-page calculator-page--${mode}`}>
      <header className="calculator-header">
        <Link
          to={backPath}
          className="icon-button"
          aria-label={mode === "map" ? "Back to dashboard" : "Back to plot types"}
        >
          <ArrowLeft size={19} />
        </Link>
        <Brand compact />
        <span className="calculator-header__chip"><ModeIcon size={14} /> {modeDetails.title}</span>
      </header>

      <section className="calculator-mode-summary">
        <div className="calculator-mode-summary__icon"><ModeIcon size={23} /></div>
        <span>
          <small>{mode === "map" ? "SATELLITE MEASUREMENT" : "AREA CALCULATOR"}</small>
          <h1>{modeDetails.title}</h1>
          <p>{modeDetails.description}</p>
        </span>
      </section>

      <section className={`calculator-workspace ${mode === "map" ? "calculator-workspace--map" : ""}`}>
        {mode !== "irregular" && (
          <header className="calculator-unit-bar">
            <label>
              <span>Input length</span>
              <select value={lengthUnit.id} onChange={(event) => convertLengthInputs(event.target.value)}>
                {lengthUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Output area</span>
              <select value={areaUnit.id} onChange={(event) => setAreaUnitId(event.target.value)}>
                {areaUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
                ))}
              </select>
            </label>
          </header>
        )}

        {mode === "irregular" && (
          <IrregularSingleCanvasCalculator
            sides={irregularSides}
            onSidesChange={setIrregularSides}
            diagonalValue={irregularDiagonal}
            onDiagonalValueChange={setIrregularDiagonal}
            selectedDiagonalType={selectedDiagonalType}
            onSelectDiagonalType={setSelectedDiagonalType}
            lengthUnit={lengthUnit}
            areaUnit={areaUnit}
            lengthUnits={lengthUnits}
            areaUnits={areaUnits}
            onLengthUnitChange={convertLengthInputs}
            onAreaUnitChange={setAreaUnitId}
            onSave={() => setActionDialog("save")}
            onExportPdf={() => setActionDialog("pdf")}
            result={result}
            error={error}
          />
        )}

        {mode === "triangles" && (
          <section className="calculator-panel">
            {/* Triangle Count Selector Header */}
            <div className="triangle-count-header bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                  <Triangle className="text-blue-600 fill-blue-100 shrink-0" size={18} />
                  How many survey triangles in this plot?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set how many triangles were measured in your field book for this plot.
                </p>
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end shrink-0">
                <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-extrabold text-lg disabled:opacity-40 transition-colors"
                    disabled={triangles.length <= 1}
                    onClick={() => updateTriangleCount(triangles.length - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={triangles.length}
                    onChange={(e) => updateTriangleCount(parseInt(e.target.value) || 1)}
                    className="w-12 text-center font-bold text-slate-800 text-base focus:outline-none border-x border-slate-200 py-1"
                  />
                  <button
                    type="button"
                    className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-extrabold text-lg disabled:opacity-40 transition-colors"
                    disabled={triangles.length >= 30}
                    onClick={() => updateTriangleCount(triangles.length + 1)}
                  >
                    +
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-1 ml-1">
                  {[1, 2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => updateTriangleCount(cnt)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                        triangles.length === cnt
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Surveyor Row-by-Row Table Grid */}
            <div className="surveyor-triangle-table-wrapper border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden mb-4">
              {/* Table Header */}
              <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider items-center">
                <div className="col-span-3 sm:col-span-3 flex items-center gap-1">
                  <Triangle size={13} className="text-blue-600 shrink-0" />
                  <span className="truncate">Triangle</span>
                </div>
                <div className="col-span-3 sm:col-span-3 text-center">
                  <span>Side 1 ({lengthUnit.symbol})</span>
                </div>
                <div className="col-span-3 sm:col-span-3 text-center">
                  <span>Side 2 ({lengthUnit.symbol})</span>
                </div>
                <div className="col-span-3 sm:col-span-3 text-center">
                  <span>Side 3 ({lengthUnit.symbol})</span>
                </div>
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-slate-100">
                {triangles.map((triangle, index) => (
                  <div key={triangle.id} className="grid grid-cols-12 px-2.5 sm:px-3 py-2 sm:py-2.5 items-center gap-1.5 hover:bg-slate-50/80 transition-colors">
                    {/* Col 1: Triangle Icon & Name */}
                    <div className="col-span-3 sm:col-span-3 flex items-center gap-1.5 min-w-0 pr-0.5">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-50 text-blue-700 font-black text-[11px] sm:text-xs flex items-center justify-center border border-blue-200 shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={triangle.name}
                        onChange={(e) => setTriangles(curr => curr.map(item => item.id === triangle.id ? { ...item, name: e.target.value } : item))}
                        className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 truncate border border-transparent hover:border-slate-200"
                        placeholder={`Triangle ${index + 1}`}
                      />
                    </div>

                    {/* Col 2: Side 1 */}
                    <div className="col-span-3 sm:col-span-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={triangle.values[0]}
                        onChange={(e) => setTriangles(curr => curr.map(item => item.id === triangle.id ? { ...item, values: [e.target.value, item.values[1], item.values[2]] } : item))}
                        className="w-full text-center text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
                      />
                    </div>

                    {/* Col 3: Side 2 */}
                    <div className="col-span-3 sm:col-span-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={triangle.values[1]}
                        onChange={(e) => setTriangles(curr => curr.map(item => item.id === triangle.id ? { ...item, values: [item.values[0], e.target.value, item.values[2]] } : item))}
                        className="w-full text-center text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
                      />
                    </div>

                    {/* Col 4: Side 3 & Delete button */}
                    <div className="col-span-3 sm:col-span-3 flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={triangle.values[2]}
                        onChange={(e) => setTriangles(curr => curr.map(item => item.id === triangle.id ? { ...item, values: [item.values[0], item.values[1], e.target.value] } : item))}
                        className="w-full text-center text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
                      />
                      {triangles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTriangles(curr => curr.filter(item => item.id !== triangle.id))}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                          title="Remove triangle"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="bg-slate-50/70 border-t border-slate-200 px-3 py-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTriangles(curr => [...curr, newTriangle(curr.length + 1)])}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 transition-all shadow-sm"
                >
                  <Plus size={14} /> Add Triangle
                </button>
                <span className="text-xs font-medium text-slate-500">
                  Total Triangles: <strong className="text-slate-800">{triangles.length}</strong>
                </span>
              </div>
            </div>
          </section>
        )}

        {mode === "regular" && (
          <section className="calculator-panel">
            <p className="calculator-panel__guidance">
              Triangle is available as a separate plot mode. Choose a shape below.
            </p>
            <div className="regular-shape-tabs">
              {REGULAR_SHAPES.map((shape) => (
                <button
                  type="button"
                  className={regularShape === shape.id ? "is-active" : ""}
                  onClick={() => {
                    setRegularShape(shape.id);
                    setRegularValues(Array(shape.fields.length).fill(""));
                    setResult(null);
                  }}
                  key={shape.id}
                >
                  {shape.label}
                </button>
              ))}
            </div>
            <div className="measurement-grid">
              {REGULAR_SHAPES.find((shape) => shape.id === regularShape).fields.map((field, index) => (
                <ValueField
                  key={`${regularShape}-${field}`}
                  label={field}
                  value={regularValues[index] ?? ""}
                  unitSymbol={lengthUnit.symbol}
                  onChange={(next) => setRegularValues((current) =>
                    current.map((item, itemIndex) => itemIndex === index ? next : item))}
                />
              ))}
            </div>
          </section>
        )}

        {(mode === "map" || mode === "map_mode") && (
          <MapDrawMode
            initialPoints={mapPoints}
            onPointsChange={setMapPoints}
            navigationPoint={mapNavigationPoint}
            onNavigationPointChange={setMapNavigationPoint}
            areaOutputUnit={areaUnit.id}
            onAreaOutputUnitChange={(uId) => {
              const found = areaUnits.find((x) => x.id === uId || x.unit_id === uId);
              if (found) setAreaUnitId(found.id);
            }}
            onSave={() => setActionDialog("save")}
          />
        )}

        {mode !== "map" && mode !== "map_mode" && mode !== "irregular" && (
          <button type="button" className="calculator-calculate" onClick={calculate}>
            <Calculator size={19} /> Calculate area
          </button>
        )}

        {error && mode !== "irregular" && <p className="calculator-error"><AlertTriangle size={17} /> {error}</p>}

        {result && mode !== "irregular" && (
          <section className="calculator-result">
            <header>
              <div>
                {result.exactness === "approximate"
                  ? <AlertTriangle size={20} />
                  : <CheckCircle2 size={20} />}
                <span>
                  <small>{result.exactness === "approximate" ? "APPROXIMATE RESULT" : "MEASUREMENT RESULT"}</small>
                  <strong>{result.method.replaceAll("_", " ")}</strong>
                </span>
              </div>
              <label>
                <span>Show as</span>
                <select value={areaUnit.id} onChange={(event) => setAreaUnitId(event.target.value)}>
                  {areaUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.symbol}</option>)}
                </select>
              </label>
            </header>
            <div className="area-result-card">
              <small>Total area</small>
              <strong>{format(displayedArea, 6)}</strong>
              <span>{areaUnit.symbol} · {areaUnit.name}</span>
              <p>{format(result.areaSqm, 6)} m² · {format(result.areaSqm * 10.7639104167, 6)} ft²</p>
            </div>
            <div className="result-facts">
              <div><span>Perimeter</span><strong>{format(result.perimeterM)} m</strong></div>
              <div><span>Sides</span><strong>{result.sideLengthsMeters.length}</strong></div>
              <div><span>Diagonals</span><strong>{result.diagonalsMeters.length}</strong></div>
            </div>
            {result.warning && <p className="result-warning"><AlertTriangle size={16} /> {result.warning}</p>}
            {result.vertices?.length >= 3 && mode !== "triangles" && (
              <PlotDiagram
                vertices={result.vertices}
                sideLabels={result.sideLabels}
                diagonalPairs={result.diagonalPairs}
                schematic={result.exactness === "approximate"}
              />
            )}
            {mode === "triangles" && result.triangles && (
              <div className="triangle-results-breakdown mt-5 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden text-left">
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Triangle size={15} className="text-emerald-400 fill-emerald-400/20" />
                    Triangles Area Breakdown
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {result.triangles.length} Triangles Combined
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {result.triangles.map((tri, i) => {
                    const areaInUnit = tri.areaSqm / Number(areaUnit.factorToBase);
                    const percentShare = result.areaSqm > 0 ? (tri.areaSqm / result.areaSqm) * 100 : 0;
                    const rawValues = triangles[i]?.values || [];

                    return (
                      <div key={tri.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-black text-sm flex items-center justify-center border border-blue-200 shrink-0">
                            #{i + 1}
                          </span>
                          <div>
                            <h5 className="font-bold text-slate-800 text-sm leading-snug">{tri.name}</h5>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              Sides: {rawValues[0] || '0'} {lengthUnit.symbol} × {rawValues[1] || '0'} {lengthUnit.symbol} × {rawValues[2] || '0'} {lengthUnit.symbol}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            {format(percentShare, 1)}% of total
                          </span>
                          <div className="text-right">
                            <span className="font-extrabold text-base text-slate-900 block leading-tight">
                              {format(areaInUnit, 2)} {areaUnit.symbol}
                            </span>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              ({format(tri.areaSqm, 2)} m²)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {mode !== "map" && (
              <div className="result-actions">
                <button type="button" className="secondary-button" onClick={() => setActionDialog("pdf")}>
                  <Download size={18} /> Export PDF
                </button>
                <button type="button" className="primary-button" onClick={() => setActionDialog("save")}>
                  <Save size={18} /> {currentPlotId ? "Update plot" : "Save plot"}
                </button>
              </div>
            )}
            {saveMessage && <p className="calculator-save-message">{saveMessage}</p>}
          </section>
        )}
      </section>

      <PlotActionDialog
        open={Boolean(actionDialog)}
        action={actionDialog}
        snapshot={reportSnapshot}
        initialMetadata={metadata}
        initialBoundaries={boundaries}
        canSave={Boolean(user)}
        onClose={() => setActionDialog(null)}
        onSave={savePlot}
      />
    </main>
  );
}
