import "./cadMeasure.css";

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileCode2,
  FileUp,
  Layers,
  MousePointer2,
  Crosshair,
  Ruler,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  loadCadDrawing,
  calculatePolygonArea,
  calculatePerimeter,
  isPointInsidePolygon,
  type CadDrawing,
  type CadEntity,
  type CadLayer,
  type CadParcel,
} from "../services/cad/cadService";

const CONVERSIONS = {
  sqft: 10.7639,
  gaj: 1.19599,
  acre: 0.000247105,
  bigha: 0.0003953686, // Standard 2500 sq.m bigha reference
  katha: 0.00790737,
  guntha: 0.00988421,
};

export default function CadMeasurePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cad, setCad] = useState<CadDrawing | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"pan" | "inspect" | "pick" | "measure">("pan");
  const [unit, setUnit] = useState<"ft" | "m" | "yd">("ft");

  // Transform (Zoom / Pan)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, origX: 0, origY: 0 });

  // Layers & Selections
  const [layersOpen, setLayersOpen] = useState(false);
  const [visibleLayerNames, setVisibleLayerNames] = useState<Set<string>>(new Set());
  const [selectedEntity, setSelectedEntity] = useState<CadEntity | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [parcels, setParcels] = useState<CadParcel[]>([]);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, []);

  // Fit CAD drawing in viewport
  const fitDrawingToView = useCallback((drawing: CadDrawing) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;

    const spanX = Math.max(drawing.bounds.maxX - drawing.bounds.minX, 1e-4);
    const spanY = Math.max(drawing.bounds.maxY - drawing.bounds.minY, 1e-4);

    const padding = 60;
    const scale = Math.min((w - padding * 2) / spanX, (h - padding * 2) / spanY);

    const centerX = (drawing.bounds.minX + drawing.bounds.maxX) / 2;
    const centerY = (drawing.bounds.minY + drawing.bounds.maxY) / 2;

    setTransform({
      scale,
      x: w / 2 - centerX * scale,
      y: h / 2 + centerY * scale, // Invert CAD Y for SVG
    });
  }, []);

  // Load CAD file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const drawing = await loadCadDrawing(file);
      setCad(drawing);
      setParcels(drawing.parcels);
      setVisibleLayerNames(new Set(drawing.layers.map((l) => l.name)));
      setUnit(drawing.nativeUnit === "ft" ? "ft" : "m");

      window.requestAnimationFrame(() => fitDrawingToView(drawing));
      notify(`Loaded ${drawing.fileName} (${drawing.entities.length} entities, ${drawing.parcels.length} plots auto-detected)`);
    } catch (err) {
      console.error("CAD Load Error:", err);
      notify(err instanceof Error ? err.message : "Failed to parse CAD file");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Toggle Layer Visibility
  const toggleLayer = (name: string) => {
    setVisibleLayerNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Screen to CAD coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;
    return {
      x: (localX - transform.x) / transform.scale,
      y: (transform.y - localY) / transform.scale,
    };
  }, [transform]);

  // Pointer Handlers for Pan/Zoom
  const handlePointerDown = (e: ReactPointerEvent) => {
    if (activeTool === "pan" || e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, origX: transform.x, origY: transform.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } else if (activeTool === "measure") {
      const pt = screenToWorld(e.clientX, e.clientY);
      setMeasurePoints((curr) => curr.length >= 2 ? [pt] : [...curr, pt]);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((t) => ({ ...t, x: panStartRef.current.origX + dx, y: panStartRef.current.origY + dy }));
    }
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  const handleWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8333;
    const newScale = Math.max(0.0001, Math.min(10000, transform.scale * zoomFactor));

    setTransform({
      scale: newScale,
      x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
      y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
    });
  };

  // 1-Click Parcel Pick
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTool !== "pick" || !cad) return;
    const pt = screenToWorld(e.clientX, e.clientY);

    // Find any closed polygon containing this point
    for (const ent of cad.entities) {
      if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.points && ent.points.length >= 3) {
        if (isPointInsidePolygon(pt, ent.points)) {
          const area = calculatePolygonArea(ent.points);
          const perimeter = calculatePerimeter(ent.points);
          const newParcel: CadParcel = {
            id: `parcel-${Date.now()}`,
            name: `Plot ${String(parcels.length + 1).padStart(2, "0")}`,
            khasraNo: `K-${100 + parcels.length + 1}`,
            points: ent.points,
            layer: ent.layer,
            color: "#22c55e",
            areaSqM: cad.nativeUnit === "ft" ? area * 0.092903 : area,
            perimeterM: cad.nativeUnit === "ft" ? perimeter * 0.3048 : perimeter,
          };
          setParcels((curr) => [...curr, newParcel]);
          setSelectedParcelId(newParcel.id);
          notify(`Created ${newParcel.name} (${(newParcel.areaSqM * CONVERSIONS.sqft).toFixed(1)} sq.ft)`);
          return;
        }
      }
    }
  };

  // Selected Parcel Area breakdown
  const selectedParcel = useMemo(() => {
    return parcels.find((p) => p.id === selectedParcelId) || parcels[0] || null;
  }, [parcels, selectedParcelId]);

  const areaSummaries = useMemo(() => {
    if (!selectedParcel) return { sqft: "0", sqm: "0", gaj: "0", bigha: "0", acre: "0", guntha: "0" };
    const sqm = selectedParcel.areaSqM;
    return {
      sqm: sqm.toFixed(2),
      sqft: (sqm * CONVERSIONS.sqft).toFixed(2),
      gaj: (sqm * CONVERSIONS.gaj).toFixed(2),
      bigha: (sqm * CONVERSIONS.bigha).toFixed(3),
      acre: (sqm * CONVERSIONS.acre).toFixed(3),
      guntha: (sqm * CONVERSIONS.guntha).toFixed(2),
    };
  }, [selectedParcel]);

  return (
    <div className="cad-page">
      {/* Header Bar */}
      <header className="cad-header-bar">
        <div className="cad-header-left">
          <button type="button" className="cad-btn-icon" onClick={() => navigate("/dashboard")} title="Back to Dashboard">
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/assets/plotscale_logo_primary.svg" alt="PlotScale" style={{ width: 26, height: 26 }} />
            <strong style={{ fontFamily: "Montserrat, sans-serif", fontSize: 16, color: "#1e3a8a" }}>
              Plot<span style={{ color: "#22c55e" }}>Scale</span>
            </strong>
          </div>
          {cad && (
            <div className="cad-file-badge" title={cad.fileName}>
              <FileCode2 size={14} color="#2563eb" />
              <span>{cad.fileName}</span>
            </div>
          )}
        </div>

        <div className="cad-header-right">
          <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className="cad-unit-select" title="Measurement Unit">
            <option value="ft">Survey Feet (ft)</option>
            <option value="m">Meters (m)</option>
            <option value="yd">Yards / Gaj (yd)</option>
          </select>
          <button type="button" className={`cad-btn-icon ${layersOpen ? "is-active" : ""}`} onClick={() => setLayersOpen(!layersOpen)} title="CAD Layers">
            <Layers size={18} />
          </button>
          <button type="button" className="cad-btn-icon" onClick={() => fileInputRef.current?.click()} title="Open DWG / DXF Drawing">
            <FileUp size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept=".dwg,.dxf,application/dxf,application/dwg,application/x-dwg,application/x-autocad" hidden onChange={handleFileUpload} />
        </div>
      </header>

      {/* Main CAD Workspace */}
      <div className="cad-workspace">
        <div
          ref={containerRef}
          className={`cad-canvas-container is-${activeTool} ${isPanning ? "is-panning" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
        >
          {cad ? (
            <svg className="cad-svg-canvas">
              <g transform={`matrix(${transform.scale},0,0,${-transform.scale},${transform.x},${transform.y})`}>
                {/* CAD Entities (filtered by layer visibility) */}
                {cad.entities.map((ent) => {
                  if (!visibleLayerNames.has(ent.layer)) return null;

                  if (ent.type === "LINE" && ent.points && ent.points.length >= 2) {
                    const isSelected = selectedEntity?.id === ent.id;
                    return (
                      <line
                        key={ent.id}
                        x1={ent.points[0].x}
                        y1={ent.points[0].y}
                        x2={ent.points[1].x}
                        y2={ent.points[1].y}
                        stroke={isSelected ? "#2563eb" : ent.color || "#0f172a"}
                        strokeWidth={(isSelected ? 3.5 : 1.8) / transform.scale}
                        onClick={(e) => {
                          if (activeTool === "inspect") {
                            e.stopPropagation();
                            setSelectedEntity(ent);
                            const len = Math.hypot(ent.points![1].x - ent.points![0].x, ent.points![1].y - ent.points![0].y);
                            notify(`Line on Layer "${ent.layer}": ${len.toFixed(2)} ${unit}`);
                          }
                        }}
                      />
                    );
                  }

                  if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.points && ent.points.length >= 2) {
                    const pts = ent.points.map((p) => `${p.x},${p.y}`).join(" ");
                    const isSelected = selectedEntity?.id === ent.id;
                    return (
                      <polygon
                        key={ent.id}
                        points={pts}
                        fill={ent.closed ? "rgba(37, 99, 235, 0.05)" : "none"}
                        stroke={isSelected ? "#2563eb" : ent.color || "#0f172a"}
                        strokeWidth={(isSelected ? 3.5 : 2) / transform.scale}
                        onClick={(e) => {
                          if (activeTool === "inspect") {
                            e.stopPropagation();
                            setSelectedEntity(ent);
                            notify(`Polyline on Layer "${ent.layer}" (${ent.points?.length} vertices)`);
                          }
                        }}
                      />
                    );
                  }

                  if (ent.type === "CIRCLE" && ent.center && ent.radius) {
                    return (
                      <circle
                        key={ent.id}
                        cx={ent.center.x}
                        cy={ent.center.y}
                        r={ent.radius}
                        fill="none"
                        stroke={ent.color || "#0f172a"}
                        strokeWidth={1.8 / transform.scale}
                      />
                    );
                  }

                  if (ent.type === "TEXT" && ent.points && ent.points.length > 0 && ent.text) {
                    return (
                      <text
                        key={ent.id}
                        x={ent.points[0].x}
                        y={ent.points[0].y}
                        transform={`scale(1, -1) translate(0, ${-2 * ent.points[0].y})`}
                        fontSize={(ent.height || 10) / transform.scale * 1.5}
                        fill={ent.color || "#475569"}
                        fontWeight="600"
                      >
                        {ent.text}
                      </text>
                    );
                  }

                  return null;
                })}

                {/* Highlighted Khasra Parcels */}
                {parcels.map((parcel) => {
                  const pts = parcel.points.map((p) => `${p.x},${p.y}`).join(" ");
                  const isSelected = selectedParcelId === parcel.id;
                  return (
                    <polygon
                      key={parcel.id}
                      points={pts}
                      fill={isSelected ? "rgba(34, 197, 94, 0.28)" : "rgba(34, 197, 94, 0.12)"}
                      stroke="#22c55e"
                      strokeWidth={(isSelected ? 3.5 : 2.2) / transform.scale}
                      strokeDasharray={isSelected ? "none" : "6 4"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedParcelId(parcel.id);
                        notify(`Selected ${parcel.name}: ${(parcel.areaSqM * CONVERSIONS.sqft).toFixed(1)} sq.ft`);
                      }}
                    />
                  );
                })}

                {/* Distance Measurement Tape */}
                {measurePoints.length === 2 && (
                  <g>
                    <line
                      x1={measurePoints[0].x}
                      y1={measurePoints[0].y}
                      x2={measurePoints[1].x}
                      y2={measurePoints[1].y}
                      stroke="#f59e0b"
                      strokeWidth={2.5 / transform.scale}
                      strokeDasharray="4 4"
                    />
                    <circle cx={measurePoints[0].x} cy={measurePoints[0].y} r={5 / transform.scale} fill="#f59e0b" />
                    <circle cx={measurePoints[1].x} cy={measurePoints[1].y} r={5 / transform.scale} fill="#f59e0b" />
                  </g>
                )}
              </g>
            </svg>
          ) : (
            <div className="cad-empty-card">
              <FileCode2 size={42} color="#2563eb" />
              <b>AutoCAD 2D CAD Measurement</b>
              <p>Upload any AutoCAD <strong>.DWG</strong> or <strong>.DXF</strong> cadastral survey map to inspect layers, calculate 1:1 ground parcel area, and measure boundaries.</p>
              <button type="button" className="cad-btn-upload" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={18} />
                <span>Open CAD Drawing</span>
              </button>
            </div>
          )}

          {/* Floating Action Toolbar */}
          {cad && (
            <div className="cad-floating-toolbar">
              <button
                type="button"
                className={`cad-tool-button ${activeTool === "pan" ? "is-active" : ""}`}
                onClick={() => setActiveTool("pan")}
              >
                <MousePointer2 size={15} />
                <span>Pan / View</span>
              </button>
              <button
                type="button"
                className={`cad-tool-button ${activeTool === "pick" ? "is-active" : ""}`}
                onClick={() => setActiveTool("pick")}
              >
                <Crosshair size={15} />
                <span>Pick Plot</span>
              </button>
              <button
                type="button"
                className={`cad-tool-button ${activeTool === "inspect" ? "is-active" : ""}`}
                onClick={() => setActiveTool("inspect")}
              >
                <MousePointer2 size={15} />
                <span>Inspect</span>
              </button>
              <button
                type="button"
                className={`cad-tool-button ${activeTool === "measure" ? "is-active" : ""}`}
                onClick={() => { setActiveTool("measure"); setMeasurePoints([]); }}
              >
                <Ruler size={15} />
                <span>Tape Measure</span>
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          {cad && (
            <div className="cad-zoom-dock">
              <button type="button" className="cad-zoom-btn" onClick={() => setTransform((t) => ({ ...t, scale: t.scale * 1.3 }))} title="Zoom In">
                <ZoomIn size={16} />
              </button>
              <span className="cad-zoom-pct">{Math.round(transform.scale * 100)}%</span>
              <button type="button" className="cad-zoom-btn" onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.0001, t.scale / 1.3) }))} title="Zoom Out">
                <ZoomOut size={16} />
              </button>
              <button type="button" className="cad-zoom-btn" onClick={() => fitDrawingToView(cad)} title="Fit Extents (Fit All)">
                <Maximize2 size={16} />
              </button>
            </div>
          )}

          {/* Bottom Parcels Dock */}
          {parcels.length > 0 && selectedParcel && (
            <div className="cad-parcels-dock">
              <div className="cad-parcels-header">
                <b>PARCEL: {selectedParcel.name}</b>
                <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 700 }}>{selectedParcel.khasraNo}</span>
              </div>
              <div className="cad-parcels-list">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, padding: "4px 8px" }}>
                  <div>Sq.Ft: <strong>{areaSummaries.sqft}</strong></div>
                  <div>Sq.M: <strong>{areaSummaries.sqm}</strong></div>
                  <div>Gaj: <strong>{areaSummaries.gaj}</strong></div>
                  <div>Bigha: <strong>{areaSummaries.bigha}</strong></div>
                  <div>Acre: <strong>{areaSummaries.acre}</strong></div>
                  <div>Guntha: <strong>{areaSummaries.guntha}</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Layer Management Drawer */}
          {layersOpen && cad && (
            <aside className="cad-layer-drawer">
              <header className="cad-drawer-header">
                <h3>CAD Layers ({cad.layers.length})</h3>
                <button type="button" className="cad-btn-icon" onClick={() => setLayersOpen(false)} style={{ width: 28, height: 28 }}>
                  <X size={15} />
                </button>
              </header>
              <div className="cad-layer-list">
                {cad.layers.map((layer) => {
                  const isVisible = visibleLayerNames.has(layer.name);
                  return (
                    <div key={layer.name} className="cad-layer-row">
                      <div className="cad-layer-info">
                        <span className="cad-layer-dot" style={{ background: layer.color || "#0f172a" }} />
                        <span className="cad-layer-name">{layer.name}</span>
                        <span className="cad-layer-count">({layer.entityCount})</span>
                      </div>
                      <button
                        type="button"
                        className="cad-btn-icon"
                        onClick={() => toggleLayer(layer.name)}
                        style={{ width: 30, height: 30 }}
                        title={isVisible ? "Hide Layer" : "Show Layer"}
                      >
                        {isVisible ? <Eye size={14} color="#2563eb" /> : <EyeOff size={14} color="#94a3b8" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="cad-toast">
          <Sparkles size={16} className="animate-spin" />
          <span>Decoding AutoCAD CAD vector geometry in WebAssembly...</span>
        </div>
      )}

      {/* Notification Toast */}
      {notification && !loading && (
        <div className="cad-toast">
          {notification}
        </div>
      )}
    </div>
  );
}
