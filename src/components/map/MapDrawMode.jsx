/**
 * MapDrawMode — Full-featured map surveying tool.
 * Features: Location search (Autocomplete), fullscreen (mobile/desktop),
 *           label toggle, unit selectors, map type toggle,
 *           GeoJSON/KML export & import, save, conversions panel.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Trash2, Undo2, MapPin, Maximize2, Minimize2, Eye, EyeOff, Ruler, Square, BookMarked, FileDown, FileText, Upload, ChevronDown, ChevronUp, Layers, Satellite, Mountain, Map as MapIcon, Tag, ZoomIn, Lock, Unlock, Crosshair, Check, SlidersHorizontal, X, Eraser, Navigation } from 'lucide-react';
import { BUILTIN_LENGTH_UNITS, BUILTIN_AREA_UNITS, mergeUnits, sortUnits, sqmToUnit, formatValue } from '../../lib/unitConversion';
import { exportToGeoJSON, exportToKML, parseGeoJSON, parseKML, getGeoJSONBlob, getKMLBlob } from '../../lib/geoExport';
import { exportMapModePDF } from '../../lib/mapPdfExport';
import { getGoogleMapsApiKey } from '../../lib/secrets';
import UnitDropdown from '../units/UnitDropdown';
import AreaConversionList from '../calculator/AreaConversionList.jsx';
import MapShareDialog from '../calculator/MapShareDialog.jsx';
import PlotActionModal from '../calculator/PlotActionModal.jsx';
import { getCrosshairSvgUrl } from '../common/PointMarker';
import { OffsetDragHandleOverlay } from '../common/OffsetDragHandle';

let gmapsLoaded = false;
let gmapsLoading = false;
const gmapsCallbacks = [];

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (gmapsLoaded && window.google?.maps) { resolve(window.google.maps); return; }
    gmapsCallbacks.push({ resolve, reject });
    if (gmapsLoading) return;
    gmapsLoading = true;
    window.__gmaps_init__ = () => {
      gmapsLoaded = true; gmapsLoading = false;
      gmapsCallbacks.forEach((cb) => cb.resolve(window.google.maps));
      gmapsCallbacks.length = 0;
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&callback=__gmaps_init__&loading=async`;
    script.async = true; script.defer = true;
    script.onerror = () => {
      gmapsLoading = false;
      gmapsCallbacks.forEach((cb) => cb.reject(new Error('Failed to load Google Maps')));
      gmapsCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function MapDrawMode({ onAreaChange, onPointsChange, onNavigationPointChange, onSave, areaOutputUnit: propAreaOutputUnit, onAreaOutputUnitChange, initialPoints, navigationPoint, initialNavigationPoint, initialEntrancePoint, onFullscreenChange, initialPlotInfo }) {
  const [points, setPoints] = useState([]);
  const [areaSqft, setAreaSqft] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showConversions, setShowConversions] = useState(false);
  const [lengthDisplayUnit, setLengthDisplayUnit] = useState('FOOT');
  const [internalAreaUnit, setInternalAreaUnit] = useState(null);
  const [mapType, setMapType] = useState('hybrid');
  const [showMapFeatures, setShowMapFeatures] = useState(true);
  const [showMapTypeMenu, setShowMapTypeMenu] = useState(false);
  const [showMagnifier, setShowMagnifier] = useState(true);
  const [showMapControls, setShowMapControls] = useState(true);
  const [magnifierScale, setMagnifierScale] = useState(1);
  const [markerScale, setMarkerScale] = useState(7);
  const [shareDialog, setShareDialog] = useState({ open: false, blob: null, filename: '', title: '' });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [plotActionModal, setPlotActionModal] = useState({ open: false, mode: 'save' });
  const [mapApiKey, setMapApiKey] = useState('');
  const [parsedPdfConfig, setParsedPdfConfig] = useState(null);
  const [livePlotInfo, setLivePlotInfo] = useState(initialPlotInfo);
  const [dbUnits, setDbUnits] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [locked, setLocked] = useState(false);
  const [baseDiagMode, setBaseDiagMode] = useState(false);
  const [diagGroups, setDiagGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [avgElevation, setAvgElevation] = useState(null);
  const [entrancePoint, setEntrancePoint] = useState(initialNavigationPoint || initialEntrancePoint || navigationPoint || null);
  const [entranceMode, setEntranceMode] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const selectedPointIndexRef = useRef(null);
  const overlayViewRef = useRef(null);
  const [mapViewportKey, setMapViewportKey] = useState(0);

  useEffect(() => { selectedPointIndexRef.current = selectedPointIndex; }, [selectedPointIndex]);

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null);
  const polylineRef = useRef(null);
  const markersRef = useRef([]);
  const labelMarkersRef = useRef([]);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialPointsDrawn = useRef(false);
  const lockedRef = useRef(false);
  const baseDiagModeRef = useRef(false);
  const activeGroupIdRef = useRef(null);
  const groupCounterRef = useRef(0);
  const magnifierRef = useRef(null);
  const magnifierMapRef = useRef(null);
  const magnifierMarkersRef = useRef([]);
  const magnifierPolygonRef = useRef(null);
  const magnifierIdleListenerRef = useRef(null);
  const diagPolylinesRef = useRef([]);
  const entrancePointRef = useRef(entrancePoint);
  const entranceModeRef = useRef(entranceMode);
  const entranceMarkerRef = useRef(null);

  const updateEntrancePoint = useCallback((pt) => {
    setEntrancePoint(pt);
    onNavigationPointChange?.(pt);
  }, [onNavigationPointChange]);

  useEffect(() => { entrancePointRef.current = entrancePoint; }, [entrancePoint]);
  useEffect(() => { entranceModeRef.current = entranceMode; }, [entranceMode]);
  useEffect(() => { if (navigationPoint) setEntrancePoint(navigationPoint); }, [navigationPoint]);

  const allLengthUnits = useMemo(() => sortUnits(mergeUnits(dbUnits.filter((u) => u.unit_type === 'length'), BUILTIN_LENGTH_UNITS)), [dbUnits]);
  const allAreaUnits = useMemo(() => sortUnits(mergeUnits(dbUnits.filter((u) => u.unit_type === 'area'), BUILTIN_AREA_UNITS)), [dbUnits]);
  
  const areaOutputUnit = useMemo(() => {
    if (propAreaOutputUnit && typeof propAreaOutputUnit === 'object') return propAreaOutputUnit;
    if (propAreaOutputUnit && typeof propAreaOutputUnit === 'string') {
      const found = allAreaUnits.find(u => u.unit_id === propAreaOutputUnit || u.id === propAreaOutputUnit);
      if (found) return found;
    }
    if (internalAreaUnit) return internalAreaUnit;
    return allAreaUnits.find(u => u.unit_id === 'SQFT') || allAreaUnits[0];
  }, [propAreaOutputUnit, internalAreaUnit, allAreaUnits]);

  const areaSqm = areaSqft / 10.7639;
  const displayArea = areaSqft > 0 && areaOutputUnit ? sqmToUnit(areaSqm, areaOutputUnit) : 0;

  const computedSideLabels = useMemo(() => {
    const maps = window.google?.maps;
    const lengthUnit = allLengthUnits.find((u) => u.unit_id === lengthDisplayUnit);
    const lengthFactor = lengthUnit?.factor_to_base || 0.3048;
    const lengthSymbol = lengthUnit?.unit_symbol || 'ft';
    return points.map((p, i) => {
      const next = points[(i + 1) % points.length];
      let distM;
      if (maps) {
        distM = maps.geometry.spherical.computeDistanceBetween(
          new maps.LatLng(p.lat, p.lng), new maps.LatLng(next.lat, next.lng)
        );
      } else {
        const R = 6371000;
        const dLat = (next.lat - p.lat) * Math.PI / 180;
        const dLng = (next.lng - p.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * Math.PI / 180) * Math.cos(next.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      return `${formatValue(distM / lengthFactor, 2)} ${lengthSymbol}`;
    });
  }, [points, lengthDisplayUnit, allLengthUnits]);

  useEffect(() => { setLivePlotInfo(initialPlotInfo); }, [initialPlotInfo]);

  useEffect(() => {
    if (!livePlotInfo?.pdf_config) return;
    try {
      const cfg = typeof livePlotInfo.pdf_config === 'string'
        ? JSON.parse(livePlotInfo.pdf_config)
        : livePlotInfo.pdf_config;
      setParsedPdfConfig(cfg);
      if (cfg.diagGroups && Array.isArray(cfg.diagGroups) && cfg.diagGroups.length > 0) {
        setDiagGroups(cfg.diagGroups);
        groupCounterRef.current = cfg.diagGroups.reduce((max, g) => Math.max(max, g.id || 0), 0);
      }
    } catch {}
  }, [livePlotInfo]);

  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { baseDiagModeRef.current = baseDiagMode; }, [baseDiagMode]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);

  const pointStatus = useMemo(() => {
    const baseSet = new Set();
    const connSet = new Set();
    diagGroups.forEach(g => { baseSet.add(g.base); g.connected.forEach(c => connSet.add(c)); });
    return { baseSet, connSet };
  }, [diagGroups]);

  const updatePolygon = useCallback((pts) => {
    if (!window.google || pts.length < 2) return;
    const maps = window.google.maps;
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    if (pts.length < 3) {
      polylineRef.current = new maps.Polyline({
        path: pts, strokeColor: '#22c55e', strokeWeight: 3, map: mapInstanceRef.current
      });
      return;
    }
    polygonRef.current = new maps.Polygon({
      paths: pts, strokeColor: '#22c55e', strokeWeight: 3,
      fillColor: '#22c55e', fillOpacity: 0.18, map: mapInstanceRef.current
    });
    const area = maps.geometry.spherical.computeArea(pts) * 10.7639;
    setAreaSqft(area);
    setTimeout(() => onAreaChange?.(area), 0);
  }, [onAreaChange]);

  const createMarker = useCallback((maps, pt, map) => {
    const marker = new maps.Marker({
      position: pt,
      map,
      draggable: false,
      icon: {
        url: getCrosshairSvgUrl('#22c55e'),
        scaledSize: new maps.Size(16, 16),
        anchor: new maps.Point(8, 8),
      },
    });

    marker.addListener('click', () => {
      if (baseDiagModeRef.current) {
        const idx = markersRef.current.indexOf(marker);
        if (idx < 0) return;
        const activeId = activeGroupIdRef.current;
        if (activeId === null) {
          const id = ++groupCounterRef.current;
          setActiveGroupId(id);
          setDiagGroups(prev => [...prev, { id, base: idx, connected: [] }]);
        } else {
          setDiagGroups(prev => {
            const active = prev.find(g => g.id === activeId);
            if (!active || idx === active.base) return prev;
            return prev.map(g => g.id !== activeId ? g : {
              ...g,
              connected: g.connected.includes(idx) ? g.connected.filter(c => c !== idx) : [...g.connected, idx]
            });
          });
        }
        return;
      }
      const idx = markersRef.current.indexOf(marker);
      if (idx >= 0) {
        setSelectedPointIndex((curr) => (curr === idx ? null : idx));
      }
    });
    return marker;
  }, []);

  useEffect(() => {
    if (!mapLoaded || !window.google) return;
    const maps = window.google.maps;
    labelMarkersRef.current.forEach((m) => m.setMap(null));
    labelMarkersRef.current = [];
    if (!showLabels || points.length < 2) return;

    const lengthUnit = allLengthUnits.find((u) => u.unit_id === lengthDisplayUnit);
    const lengthFactor = lengthUnit?.factor_to_base || 0.3048;
    const lengthSymbol = lengthUnit?.unit_symbol || 'ft';
    const numSides = points.length >= 3 ? points.length : points.length - 1;

    for (let i = 0; i < numSides; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const mid = { lat: (p1.lat + p2.lat) / 2, lng: (p1.lng + p2.lng) / 2 };
      const distMeters = maps.geometry.spherical.computeDistanceBetween(p1, p2);
      const distInUnit = distMeters / lengthFactor;
      labelMarkersRef.current.push(new maps.Marker({
        position: mid, map: mapInstanceRef.current, clickable: false,
        label: { text: `${formatValue(distInUnit, 2)} ${lengthSymbol}`, className: 'map-side-label', fontSize: '10px' },
        icon: { path: maps.SymbolPath.CIRCLE, scale: 0 }
      }));
    }

    if (points.length >= 3 && areaOutputUnit) {
      const centroid = points.reduce((acc, p) => ({
        lat: acc.lat + p.lat / points.length, lng: acc.lng + p.lng / points.length
      }), { lat: 0, lng: 0 });
      const areaInUnit = areaSqm / (areaOutputUnit.factor_to_base || 0.092903);
      labelMarkersRef.current.push(new maps.Marker({
        position: centroid, map: mapInstanceRef.current, clickable: false,
        label: { text: `${formatValue(areaInUnit, 2)} ${areaOutputUnit.unit_symbol || ''}`, className: 'map-area-label', fontSize: '12px' },
        icon: { path: maps.SymbolPath.CIRCLE, scale: 0 }
      }));
    }
  }, [points, showLabels, lengthDisplayUnit, areaOutputUnit, mapLoaded, allLengthUnits, areaSqm]);

  useEffect(() => {
    if (!mapLoaded || !window.google) return;
    markersRef.current.forEach((marker, i) => {
      let color = '#22c55e';
      if (pointStatus.baseSet.has(i)) color = '#3b82f6';
      else if (pointStatus.connSet.has(i)) color = '#8b5cf6';
      else if (selectedPointIndex === i) color = '#3b82f6';
      marker.setIcon({
        url: getCrosshairSvgUrl(color),
        scaledSize: new window.google.maps.Size(16, 16),
        anchor: new window.google.maps.Point(8, 8),
      });
      marker.setDraggable(false);
    });
  }, [pointStatus, mapLoaded, baseDiagMode, points, selectedPointIndex]);

  const selectedPointScreenPos = useMemo(() => {
    if (selectedPointIndex === null || !points[selectedPointIndex] || !mapLoaded || !overlayViewRef.current || !window.google) return null;
    const proj = overlayViewRef.current.getProjection();
    if (!proj) return null;
    const pt = points[selectedPointIndex];
    const pixel = proj.fromLatLngToContainerPixel(new window.google.maps.LatLng(pt.lat, pt.lng));
    return pixel ? { x: pixel.x, y: pixel.y } : null;
  }, [selectedPointIndex, points, mapLoaded, mapViewportKey]);

  const prevPointScreenPos = useMemo(() => {
    if (selectedPointIndex === null || points.length < 2 || !mapLoaded || !overlayViewRef.current || !window.google) return null;
    const proj = overlayViewRef.current.getProjection();
    if (!proj) return null;
    const N = points.length;
    const prevIdx = (selectedPointIndex - 1 + N) % N;
    const pt = points[prevIdx];
    if (!pt) return null;
    const pixel = proj.fromLatLngToContainerPixel(new window.google.maps.LatLng(pt.lat, pt.lng));
    return pixel ? { x: pixel.x, y: pixel.y } : null;
  }, [selectedPointIndex, points, mapLoaded, mapViewportKey]);

  const nextPointScreenPos = useMemo(() => {
    if (selectedPointIndex === null || points.length < 2 || !mapLoaded || !overlayViewRef.current || !window.google) return null;
    const proj = overlayViewRef.current.getProjection();
    if (!proj) return null;
    const N = points.length;
    const nextIdx = (selectedPointIndex + 1) % N;
    const pt = points[nextIdx];
    if (!pt) return null;
    const pixel = proj.fromLatLngToContainerPixel(new window.google.maps.LatLng(pt.lat, pt.lng));
    return pixel ? { x: pixel.x, y: pixel.y } : null;
  }, [selectedPointIndex, points, mapLoaded, mapViewportKey]);

  const dragStartPixelRef = useRef(null);

  const handleDragStart = useCallback(() => {
    if (selectedPointIndex === null || !points[selectedPointIndex] || !overlayViewRef.current || !window.google) return;
    const proj = overlayViewRef.current.getProjection();
    if (!proj) return;
    const origPt = points[selectedPointIndex];
    const origPixel = proj.fromLatLngToContainerPixel(new window.google.maps.LatLng(origPt.lat, origPt.lng));
    if (origPixel) {
      dragStartPixelRef.current = { x: origPixel.x, y: origPixel.y };
    }
    if (showMagnifier) setShowMagnifier(true);
  }, [selectedPointIndex, points, showMagnifier]);

  const handleDragPoint = useCallback(({ dx, dy }) => {
    if (selectedPointIndex === null || !dragStartPixelRef.current || !overlayViewRef.current || !window.google) return;
    const proj = overlayViewRef.current.getProjection();
    if (!proj) return;
    const startPixel = dragStartPixelRef.current;
    const newPixel = new window.google.maps.Point(startPixel.x + dx, startPixel.y + dy);
    const newLatLng = proj.fromContainerPixelToLatLng(newPixel);
    if (!newLatLng) return;
    const newPt = { lat: newLatLng.lat(), lng: newLatLng.lng() };

    if (markersRef.current[selectedPointIndex]) {
      markersRef.current[selectedPointIndex].setPosition(newLatLng);
    }
    if (magnifierMapRef.current) {
      magnifierMapRef.current.setCenter(newLatLng);
    }

    setPoints((prev) => {
      const next = [...prev];
      next[selectedPointIndex] = newPt;
      updatePolygon(next);
      setTimeout(() => onPointsChange?.(next), 0);
      return next;
    });
  }, [selectedPointIndex, updatePolygon, onPointsChange]);

  const handleDragEnd = useCallback(() => {
    dragStartPixelRef.current = null;
  }, []);

  // ── Render live diagonal polylines & diagonal length labels on the map ──
  useEffect(() => {
    if (!mapLoaded || !window.google) return;
    const maps = window.google.maps;

    diagPolylinesRef.current.forEach((item) => item.setMap(null));
    diagPolylinesRef.current = [];

    if (!points || points.length < 4 || !diagGroups || diagGroups.length === 0) return;

    const lengthUnit = allLengthUnits.find((u) => u.unit_id === lengthDisplayUnit);
    const lengthFactor = lengthUnit?.factor_to_base || 0.3048;
    const lengthSymbol = lengthUnit?.unit_symbol || 'ft';

    diagGroups.forEach((group) => {
      const basePt = points[group.base];
      if (!basePt) return;

      group.connected.forEach((connIdx) => {
        const connPt = points[connIdx];
        if (!connPt) return;

        // Draw dashed blue diagonal polyline on the map
        const polyline = new maps.Polyline({
          path: [basePt, connPt],
          strokeColor: '#2563eb',
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
            offset: '0',
            repeat: '10px'
          }],
          map: mapInstanceRef.current,
        });
        diagPolylinesRef.current.push(polyline);

        // Midpoint length label for diagonal
        const mid = { lat: (basePt.lat + connPt.lat) / 2, lng: (basePt.lng + connPt.lng) / 2 };
        const distMeters = maps.geometry.spherical.computeDistanceBetween(basePt, connPt);
        const distInUnit = distMeters / lengthFactor;

        const labelMarker = new maps.Marker({
          position: mid,
          map: mapInstanceRef.current,
          clickable: false,
          label: {
            text: `(P${group.base + 1}→P${connIdx + 1}) ${formatValue(distInUnit, 2)} ${lengthSymbol}`,
            className: 'map-diag-label',
            fontSize: '11px',
            color: '#ffffff',
          },
          icon: { path: maps.SymbolPath.CIRCLE, scale: 0 }
        });
        diagPolylinesRef.current.push(labelMarker);
      });
    });
  }, [diagGroups, points, mapLoaded, lengthDisplayUnit, allLengthUnits]);

  useEffect(() => {
    if (!mapLoaded || !window.google?.maps || points.length < 3) {
      setAvgElevation(null);
      return;
    }
    let cancelled = false;
    const maps = window.google.maps;
    const elevator = new maps.ElevationService();
    const locations = points.map(p => new maps.LatLng(p.lat, p.lng));
    elevator.getElevationForLocations({ locations }, (results, status) => {
      if (cancelled) return;
      if (status === 'OK' && results) {
        const valid = results.filter(r => r.elevation != null);
        if (valid.length > 0) {
          setAvgElevation(valid.reduce((s, r) => s + r.elevation, 0) / valid.length);
        }
      }
    });
    return () => { cancelled = true; };
  }, [mapLoaded, points]);

  useEffect(() => {
    let cancelled = false;
    getGoogleMapsApiKey().
    then((key) => {
      if (cancelled) return;
      return loadGoogleMaps(key);
    }).
    then((maps) => {
      if (!maps || cancelled || !mapRef.current) return;
      const map = new maps.Map(mapRef.current, {
        center: { lat: 26.8467, lng: 80.9462 }, zoom: 19, mapTypeId: 'hybrid',
        zoomControl: true,
        zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
        mapTypeControl: false,
        streetViewControl: false, fullscreenControl: false,
        gestureHandling: 'greedy'
      });
      mapInstanceRef.current = map;

      const overlay = new maps.OverlayView();
      overlay.draw = function() {};
      overlay.setMap(map);
      overlayViewRef.current = overlay;

      map.addListener('bounds_changed', () => {
        setMapViewportKey((k) => k + 1);
      });

      if (navigator.geolocation && !(initialPoints && initialPoints.length >= 3)) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (!cancelled) map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
          () => {}
        );
      }

      map.addListener('click', (e) => {
        if (selectedPointIndexRef.current !== null) {
          setSelectedPointIndex(null);
          return;
        }
        if (!e.latLng) return;
        const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        if (entranceModeRef.current) {
          updateEntrancePoint(pt);
          setEntranceMode(false);
          return;
        }
        if (lockedRef.current) return;
        const marker = createMarker(maps, pt, map);
        markersRef.current.push(marker);
        setPoints((prev) => {
          const next = [...prev, pt];
          updatePolygon(next);
          setTimeout(() => onPointsChange?.(next), 0);
          return next;
        });
      });

      setMapLoaded(true);
    }).
    catch((err) => { if (!cancelled) setLoadError(err?.message || 'Failed to load map.'); });

    return () => {
      cancelled = true;
      if (overlayViewRef.current) {
        overlayViewRef.current.setMap(null);
        overlayViewRef.current = null;
      }
      if (polygonRef.current) polygonRef.current.setMap(null);
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (entranceMarkerRef.current) { entranceMarkerRef.current.setMap(null); entranceMarkerRef.current = null; }
      markersRef.current.forEach((m) => m.setMap(null));
      labelMarkersRef.current.forEach((m) => m.setMap(null));
      if (magnifierMapRef.current) { magnifierMapRef.current = null; }
    };
  }, [createMarker, onPointsChange, updateEntrancePoint]);

  // ── Render & update Vehicle Entrance / Navigation Marker ──
  useEffect(() => {
    if (!mapLoaded || !window.google || !mapInstanceRef.current) return;
    const maps = window.google.maps;

    if (entranceMarkerRef.current) {
      entranceMarkerRef.current.setMap(null);
      entranceMarkerRef.current = null;
    }

    if (entrancePoint) {
      const marker = new maps.Marker({
        position: entrancePoint,
        map: mapInstanceRef.current,
        draggable: true,
        title: 'Vehicle Entrance / Navigation Point',
        icon: {
          path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('dragend', (e) => {
        if (e.latLng) {
          updateEntrancePoint({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });

      entranceMarkerRef.current = marker;
    }
  }, [mapLoaded, entrancePoint, updateEntrancePoint]);

  useEffect(() => {
    if (!mapLoaded || !window.google || !searchInputRef.current || !mapInstanceRef.current) return;
    const maps = window.google.maps;
    const input = searchInputRef.current;

    const autocomplete = new maps.places.Autocomplete(input, {
      fields: ['geometry', 'name', 'formatted_address']
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        mapInstanceRef.current.setCenter(place.geometry.location);
        mapInstanceRef.current.setZoom(19);
      }
    });

    const geocoder = new maps.Geocoder();
    const handleKeyDown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          mapInstanceRef.current.setCenter(results[0].geometry.location);
          mapInstanceRef.current.setZoom(19);
        }
      });
    };
    input.addEventListener('keydown', handleKeyDown);
    return () => input.removeEventListener('keydown', handleKeyDown);
  }, [mapLoaded]);

  const initialPointsRef = useRef(initialPoints);

  useEffect(() => {
    if (!mapLoaded || initialPointsDrawn.current) return;
    const pts = initialPointsRef.current;
    if (!pts || pts.length < 3) {
      initialPointsDrawn.current = true;
      return;
    }
    initialPointsDrawn.current = true;
    const maps = window.google.maps;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    pts.forEach((pt) => {
      markersRef.current.push(createMarker(maps, pt, mapInstanceRef.current));
    });

    setPoints(pts);
    updatePolygon(pts);
    onPointsChange?.(pts);

    const bounds = new maps.LatLngBounds();
    pts.forEach((pt) => bounds.extend(pt));
    mapInstanceRef.current.fitBounds(bounds);
  }, [mapLoaded, updatePolygon, onPointsChange, createMarker]);

  useEffect(() => {
    if (!mapLoaded || !window.google || !showMagnifier || !magnifierRef.current) return;
    const maps = window.google.maps;
    const mainMap = mapInstanceRef.current;
    if (!mainMap) return;

    magnifierMapRef.current = new maps.Map(magnifierRef.current, {
      center: mainMap.getCenter(),
      zoom: 24,
      mapTypeId: mainMap.getMapTypeId(),
      disableDefaultUI: true,
      draggable: false,
      scrollwheel: false,
      gestureHandling: 'none',
      keyboardShortcuts: false
    });

    const mainStyles = mainMap.get('styles');
    if (mainStyles) magnifierMapRef.current.setOptions({ styles: mainStyles });

    magnifierIdleListenerRef.current = mainMap.addListener('idle', () => {
      if (magnifierMapRef.current) magnifierMapRef.current.setCenter(mainMap.getCenter());
    });

    return () => {
      if (magnifierIdleListenerRef.current) {
        magnifierIdleListenerRef.current.remove();
        magnifierIdleListenerRef.current = null;
      }
      magnifierMarkersRef.current.forEach((m) => m.setMap(null));
      magnifierMarkersRef.current = [];
      if (magnifierPolygonRef.current) { magnifierPolygonRef.current.setMap(null); magnifierPolygonRef.current = null; }
      magnifierMapRef.current = null;
    };
  }, [mapLoaded, showMagnifier]);

  useEffect(() => {
    if (!magnifierMapRef.current || !window.google) return;
    const maps = window.google.maps;
    const mMap = magnifierMapRef.current;

    magnifierMarkersRef.current.forEach((m) => m.setMap(null));
    magnifierMarkersRef.current = [];
    if (magnifierPolygonRef.current) { magnifierPolygonRef.current.setMap(null); magnifierPolygonRef.current = null; }

    if (points.length >= 3) {
      magnifierPolygonRef.current = new maps.Polygon({
        paths: points, strokeColor: '#22c55e', strokeWeight: 3,
        fillColor: '#22c55e', fillOpacity: 0.18, map: mMap
      });
    }
    points.forEach((pt, i) => {
      let color = '#22c55e';
      if (pointStatus.baseSet.has(i)) color = '#3b82f6';
      else if (pointStatus.connSet.has(i)) color = '#8b5cf6';
      else if (selectedPointIndex === i) color = '#3b82f6';
      magnifierMarkersRef.current.push(new maps.Marker({
        position: pt, map: mMap, draggable: false,
        icon: {
          url: getCrosshairSvgUrl(color),
          scaledSize: new window.google.maps.Size(16 * magnifierScale, 16 * magnifierScale),
          anchor: new window.google.maps.Point(8 * magnifierScale, 8 * magnifierScale),
        }
      }));
    });
  }, [points, showMagnifier, pointStatus, markerScale, magnifierScale, selectedPointIndex]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      onFullscreenChange?.(next);
      if (mapInstanceRef.current && window.google) {
        setTimeout(() => {
          window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
          if (points.length >= 3) {
            const bounds = new window.google.maps.LatLngBounds();
            points.forEach((pt) => bounds.extend(pt));
            mapInstanceRef.current.fitBounds(bounds);
          }
        }, 300);
      }
      return next;
    });
  };

  const changeMapType = (type) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setMapTypeId(type);
    setMapType(type);
    if (magnifierMapRef.current) magnifierMapRef.current.setMapTypeId(type);
    setShowMapTypeMenu(false);
  };

  const toggleMapFeatures = () => {
    setShowMapFeatures((prev) => {
      const next = !prev;
      if (mapInstanceRef.current && window.google) {
        const styles = next ? [] : [
          { featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] }];

        mapInstanceRef.current.setOptions({ styles });
        if (magnifierMapRef.current) magnifierMapRef.current.setOptions({ styles });
      }
      return next;
    });
  };

  const handleUndo = () => {
    setSelectedPointIndex(null);
    const last = markersRef.current.pop();
    if (last) last.setMap(null);
    setPoints((prev) => {
      const next = prev.slice(0, -1);
      updatePolygon(next);
      onPointsChange?.(next);
      if (next.length < 3) { setAreaSqft(0); onAreaChange?.(0); }
      return next;
    });
    setDiagGroups([]);
    setActiveGroupId(null);
    groupCounterRef.current = 0;
  };

  const handleReset = () => {
    setSelectedPointIndex(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (entranceMarkerRef.current) { entranceMarkerRef.current.setMap(null); entranceMarkerRef.current = null; }
    setPoints([]); setAreaSqft(0);
    onAreaChange?.(0); onPointsChange?.([]);
    updateEntrancePoint(null);
    setEntranceMode(false);
    setDiagGroups([]);
    setActiveGroupId(null);
    groupCounterRef.current = 0;
    setBaseDiagMode(false);
    setLocked(false);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { mapInstanceRef.current.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }); mapInstanceRef.current.setZoom(20); setGeoLoading(false); },
      () => setGeoLoading(false)
    );
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const ext = file.name.split('.').pop().toLowerCase();
        const pts = ext === 'kml' ? parseKML(text) : parseGeoJSON(text);
        if (pts.length < 3) { alert('File must contain at least 3 points'); return; }
        handleReset();
        const maps = window.google.maps;
        pts.forEach((pt) => {
          markersRef.current.push(createMarker(maps, pt, mapInstanceRef.current));
        });
        setPoints(pts);
        updatePolygon(pts);
        onPointsChange?.(pts);
        const bounds = new maps.LatLngBounds();
        pts.forEach((pt) => bounds.extend(pt));
        mapInstanceRef.current.fitBounds(bounds);
      } catch { alert('Invalid file format'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleBaseDiagMode = () => {
    setBaseDiagMode(prev => {
      const next = !prev;
      if (next) setLocked(true);
      return next;
    });
  };

  const finishDiagSetup = () => {
    setActiveGroupId(null);
    setBaseDiagMode(false);
  };

  const toggleMapControls = () => {
    setShowMapControls(v => {
      const next = !v;
      if (!next) setShowMagnifier(false);
      return next;
    });
  };

  const cycleMarkerScale = () => {
    setMarkerScale(prev => {
      const sizes = [4, 7, 10, 13];
      const idx = sizes.indexOf(prev);
      return sizes[(idx + 1) % sizes.length];
    });
  };

  const clearAllDiagGroups = () => {
    setDiagGroups([]);
    setActiveGroupId(null);
    groupCounterRef.current = 0;
  };

  const removeDiagGroup = (id) => {
    setDiagGroups(prev => prev.filter(g => g.id !== id));
    if (activeGroupId === id) setActiveGroupId(null);
  };

  const openPlotActionModal = (mode) => {
    setLocked(true);
    if (isFullscreen) {
      setIsFullscreen(false);
      onFullscreenChange?.(false);
      setTimeout(() => setPlotActionModal({ open: true, mode }), 300);
    } else {
      setPlotActionModal({ open: true, mode });
    }
  };

  const handleShareGeoJSON = () => {
    const result = getGeoJSONBlob(points, areaSqft);
    if (result) setShareDialog({ open: true, blob: result.blob, filename: result.filename, title: 'GeoJSON Export' });
  };

  const handleShareKML = () => {
    const result = getKMLBlob(points, areaSqft);
    if (result) setShareDialog({ open: true, blob: result.blob, filename: result.filename, title: 'KML Export' });
  };

  const handleExportMapPDF = async (plotInfo = {}, pdfConfig = {}) => {
    if (points.length < 3 || areaSqft <= 0) return;
    setPdfLoading(true);
    try {
      const lengthUnit = allLengthUnits.find((u) => u.unit_id === lengthDisplayUnit);
      const lengthFactor = lengthUnit?.factor_to_base || 0.3048;
      const lengthSymbol = lengthUnit?.unit_symbol || 'ft';

      const sideLabels = computedSideLabels;

      let apiKey = mapApiKey;
      if (!apiKey) {
        apiKey = await getGoogleMapsApiKey();
        setMapApiKey(apiKey);
      }

      await exportMapModePDF({
        points, areaSqm, sideLabels, lengthUnitSymbol: lengthSymbol,
        lengthFactor, plotName: plotInfo.plotName || '', mapApiKey: apiKey, regionalConversions: [],
        areaOutputUnit, config: {
          ...pdfConfig,
          elevation: pdfConfig.elevation ?? avgElevation,
          plotName: pdfConfig.plotName || plotInfo.plotName || '',
          address: pdfConfig.address || plotInfo.address || '',
          owner: pdfConfig.owner || plotInfo.owner || '',
          notes: pdfConfig.notes || plotInfo.notes || '',
          boundaryNames: pdfConfig.boundaryNames?.length ? pdfConfig.boundaryNames : (plotInfo.boundaryNames || []),
          diagGroups: pdfConfig.diagGroups || diagGroups,
        }
      });
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className="w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border" style={{ height: '60vw', minHeight: 260 }}>
        <span className="text-4xl">🗺️</span>
        <p className="text-sm font-semibold text-foreground">Map failed to load</p>
        <p className="text-xs text-muted-foreground text-center px-6">{loadError}</p>
        <button onClick={() => { setLoadError(''); setMapLoaded(false); }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold">Retry</button>
      </div>);
  }

  return (
    <div className={`w-full h-full flex flex-col gap-0 min-h-0 ${isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-950 overflow-hidden' : 'relative flex-1 overflow-hidden'}`}>
      {/* ─── Map Container ─── */}
      <div ref={mapContainerRef} className="relative w-full flex-1 min-h-0 overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />

        {!mapLoaded &&
          <div className="absolute inset-0 bg-background/80 rounded-t-2xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading satellite map...</p>
            </div>
          </div>
        }

        {mapLoaded &&
          <>
            {/* Top-left: Search Bar (hidden during diagonal setup) */}
            {!baseDiagMode && (
              <input
                ref={searchInputRef}
                type="text"
                placeholder="🔍 Search location..."
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="absolute top-3 left-3 z-[1000] px-3.5 py-2.5 bg-white/95 backdrop-blur-md shadow-lg rounded-xl text-xs font-medium text-slate-800 border border-slate-200/90 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 transition-all duration-300 font-sans"
                style={{ width: isSearchFocused ? 'min(calc(100vw - 130px), 22rem)' : '9rem' }} />
            )}

            {/* Control Buttons — Toggle + Point Size hide when search is focused */}
            <div className="absolute top-3 right-3 flex flex-col gap-1.5 sm:gap-2 z-[1000] font-sans">
              {!isSearchFocused && !baseDiagMode && (
                <>
                  <button onClick={toggleMapControls} className={`bg-white/95 backdrop-blur-md shadow-md rounded-xl p-2 sm:p-2.5 hover:bg-blue-50/80 transition-all duration-200 border border-slate-200/90 active:scale-95 ${showMapControls ? 'text-[#2563eb] border-[#2563eb]/40 bg-blue-50/50' : 'text-slate-600'}`} title="Toggle map tools (Map Type, Features, Magnifier, Location)">
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                  <button onClick={cycleMarkerScale} className="bg-white/95 backdrop-blur-md shadow-md rounded-xl p-2 sm:p-2.5 hover:bg-blue-50/80 transition-all duration-200 border border-slate-200/90 flex items-center justify-center active:scale-95" title={`Point Size: ${markerScale <= 4 ? 'Small' : markerScale <= 7 ? 'Medium' : markerScale <= 10 ? 'Large' : 'X-Large'}`}>
                    <span className="text-[10px] font-extrabold text-[#2563eb] font-mono">{markerScale <= 4 ? 'S' : markerScale <= 7 ? 'M' : markerScale <= 10 ? 'L' : 'XL'}</span>
                  </button>
                </>
              )}
              <button onClick={toggleFullscreen} className="bg-white/95 backdrop-blur-md shadow-md rounded-xl p-2 sm:p-2.5 hover:bg-blue-50/80 transition-all duration-200 border border-slate-200/90 active:scale-95" title="Fullscreen">
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#2563eb]" /> : <Maximize2 className="w-4 h-4 text-[#2563eb]" />}
              </button>
              {showMapControls && !baseDiagMode && (<>
                <div className="relative">
                  <button onClick={() => setShowMapTypeMenu((v) => !v)} className="bg-white/95 backdrop-blur-md shadow-md rounded-xl p-2 sm:p-2.5 hover:bg-blue-50/80 transition-all duration-200 border border-slate-200/90 active:scale-95" title="Map Type">
                    <Layers className="w-4 h-4 text-[#2563eb]" />
                  </button>
                  {showMapTypeMenu &&
                    <>
                      <div className="fixed inset-0 z-[1000]" onClick={() => setShowMapTypeMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 bg-white/98 backdrop-blur-md shadow-xl rounded-xl border border-slate-200/90 overflow-hidden w-36 sm:w-40 z-[1001] p-1 font-sans">
                        {[
                          { id: 'hybrid', label: 'Hybrid', Icon: Layers },
                          { id: 'satellite', label: 'Satellite', Icon: Satellite },
                          { id: 'roadmap', label: 'Roadmap', Icon: MapIcon },
                          { id: 'terrain', label: 'Terrain', Icon: Mountain }].
                          map((opt) =>
                            <button key={opt.id} onClick={() => changeMapType(opt.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${mapType === opt.id ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100/80'}`}>
                              <opt.Icon className="w-3.5 h-3.5" />
                              {opt.label}
                            </button>
                          )}
                      </div>
                    </>
                  }
                </div>
                <button onClick={toggleMapFeatures} className={`shadow-md rounded-xl p-2 sm:p-2.5 border transition-all duration-200 active:scale-95 ${showMapFeatures ? 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white border-transparent shadow-blue-500/20' : 'bg-white/95 backdrop-blur-md text-slate-600 border-slate-200/90 hover:bg-blue-50/80'}`} title="Toggle All Map Features (Labels, Roads, Borders, POI)">
                  <Tag className="w-4 h-4" />
                </button>
                <button onClick={() => setShowMagnifier((v) => !v)} className={`shadow-md rounded-xl p-2 sm:p-2.5 border transition-all duration-200 active:scale-95 ${showMagnifier ? 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white border-transparent shadow-blue-500/20' : 'bg-white/95 backdrop-blur-md text-slate-600 border-slate-200/90 hover:bg-blue-50/80'}`} title="Toggle Magnifier">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={handleMyLocation} className="bg-white/95 backdrop-blur-md shadow-md rounded-xl p-2 sm:p-2.5 hover:bg-blue-50/80 transition-all duration-200 border border-slate-200/90 active:scale-95" title="My Location">
                  {geoLoading ? <div className="w-4 h-4 border-2 border-[#2563eb]/30 border-t-[#2563eb] rounded-full animate-spin" /> : <MapPin className="w-4 h-4 text-[#2563eb]" />}
                </button>
              </>)}
            </div>

            {/* Magnifier Window — zoomed inset for precise point placement */}
            {showMagnifier &&
              <div className="absolute bottom-12 left-3 z-[1000] font-sans">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-white/90 shadow-2xl bg-slate-950">
                  <div className="absolute inset-0 origin-center" style={{ transform: `scale(${magnifierScale})` }}>
                    <div ref={magnifierRef} className="w-full h-full" />
                  </div>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-[#22c55e] rounded-full bg-[#22c55e]/15 shadow-sm" />
                  </div>
                  <div className="absolute top-0 left-0 right-0 bg-slate-950/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 text-center flex items-center justify-center gap-1 border-b border-white/10">
                    <span>🔍</span><span>Magnify</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center gap-0.5 py-0.5 border-t border-white/10">
                    {[1, 2, 3, 4].map((s) =>
                      <button
                        key={s}
                        onClick={() => setMagnifierScale(s)}
                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-all ${magnifierScale === s ? 'bg-[#22c55e] text-white shadow-sm' : 'text-white/70 hover:bg-white/20'}`}>
                        {s}x
                      </button>
                    )}
                  </div>
                </div>
              </div>
            }

            {/* Entrance Point Placement Banner — shown at top during entrance setup */}
            {entranceMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-3.5 py-2 rounded-2xl shadow-xl border border-white/20 font-sans">
                <Navigation className="w-4 h-4 animate-bounce" />
                <span className="text-[11px] font-bold whitespace-nowrap">
                  Tap on the map to set vehicle entrance / navigation point
                </span>
                {entrancePoint && (
                  <button onClick={() => { updateEntrancePoint(null); setEntranceMode(false); }} className="flex items-center gap-1 px-2 py-0.5 bg-red-500/90 hover:bg-red-600 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap">
                    Clear
                  </button>
                )}
                <button onClick={() => setEntranceMode(false)} className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition-all">
                  Cancel
                </button>
              </div>
            )}

            {/* Diagonal Grouping Controls — shown at top during diagonal setup */}
            {baseDiagMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#1e3a8a] text-white px-3.5 py-2 rounded-2xl shadow-xl border border-white/20 font-sans">
                <span className="text-[11px] font-bold whitespace-nowrap">
                  {activeGroupId === null ? '① Tap a base point' : '② Tap connected points'}
                </span>
                {activeGroupId !== null && (
                  <button onClick={() => setActiveGroupId(null)} className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap active:scale-95">
                    + New Group
                  </button>
                )}
                {diagGroups.length > 0 && (
                  <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-lg whitespace-nowrap">
                    {diagGroups.length} group{diagGroups.length > 1 ? 's' : ''}
                  </span>
                )}
                {diagGroups.length > 0 && (
                  <button onClick={clearAllDiagGroups} className="flex items-center gap-1 px-2.5 py-1 bg-red-500/90 hover:bg-red-600 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap active:scale-95" title="Clear all diagonal groups">
                    <Eraser className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                )}
                <button onClick={finishDiagSetup} className="flex items-center gap-1 px-3 py-1 bg-[#22c55e] hover:bg-[#16a34a] rounded-lg text-[10px] font-extrabold transition-all whitespace-nowrap active:scale-95 shadow-sm">
                  <Check className="w-3.5 h-3.5" />
                  Finish
                </button>
              </div>
            )}

            {/* Diagonal Group List */}
            {baseDiagMode && diagGroups.length > 0 && (
              <div className="absolute top-16 left-3 z-[1000] flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto font-sans">
                {diagGroups.map(g => (
                  <div key={g.id} className="flex items-center gap-2 bg-white/95 backdrop-blur-md shadow-lg rounded-xl px-2.5 py-1.5 border border-slate-200/90">
                    <span className="text-[10px] font-extrabold text-[#2563eb]">P{g.base + 1}</span>
                    <span className="text-[10px] text-slate-400">→</span>
                    <span className="text-[10px] font-semibold text-slate-800 truncate max-w-[130px]">
                      {g.connected.map(c => `P${c + 1}`).join(', ') || '—'}
                    </span>
                    <button onClick={() => removeDiagGroup(g.id)} className="flex-shrink-0 p-1 rounded-md hover:bg-red-50 text-red-500 transition-colors" title="Delete this group">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tap-to-Reveal Offset Drag Handle Overlay */}
            {selectedPointScreenPos && (
              <OffsetDragHandleOverlay
                point={selectedPointScreenPos}
                prevPoint={prevPointScreenPos}
                nextPoint={nextPointScreenPos}
                containerRect={mapContainerRef.current?.getBoundingClientRect()}
                onDragStart={handleDragStart}
                onDrag={handleDragPoint}
                onDragEnd={handleDragEnd}
                onDeselect={() => setSelectedPointIndex(null)}
              />
            )}

            {/* Status Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-md px-4 py-2.5 z-[1000] border-t border-slate-800/80 font-sans">
              {points.length < 3 ?
                <p className="text-slate-200 text-xs text-center font-medium">
                  {points.length === 0 ? '📍 Tap on the map to mark plot corners' : `${points.length} point${points.length > 1 ? 's' : ''} — add more to form polygon`}
                </p> :
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-xs font-semibold">{points.length} corners</span>
                  <span className="text-[#22c55e] text-sm font-extrabold tracking-tight">
                    {displayArea > 0 ? `${formatValue(displayArea)} ${areaOutputUnit?.unit_symbol || ''}` : '—'}
                  </span>
                </div>
              }
            </div>
          </>
        }
      </div>

      {/* ─── Options Bar ─── */}
      {mapLoaded &&
        <div className="flex items-center gap-1.5 sm:gap-2 bg-white/98 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 sm:py-2 overflow-x-auto flex-nowrap sm:flex-wrap flex-shrink-0 font-sans shadow-sm z-[1001] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-1 flex-shrink-0">
            <Ruler className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <UnitDropdown
              units={allLengthUnits}
              value={lengthDisplayUnit}
              onChange={(u) => setLengthDisplayUnit(u.unit_id)}
              align="right"
              width="w-56"
              buttonClassName="flex items-center gap-1 px-2 py-1 bg-slate-100/90 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 hover:border-[#2563eb]/50 transition-colors whitespace-nowrap"
              renderButton={(sel) => <span>{sel?.unit_symbol || lengthDisplayUnit}</span>} />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Square className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <UnitDropdown
              units={allAreaUnits}
              value={areaOutputUnit?.unit_id}
              onChange={(u) => { setInternalAreaUnit(u); onAreaOutputUnitChange?.(u); }}
              align="right"
              width="w-56"
              buttonClassName="flex items-center gap-1 px-2 py-1 bg-slate-100/90 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 hover:border-[#2563eb]/50 transition-colors whitespace-nowrap"
              renderButton={(sel) => <span>{sel?.unit_symbol || 'sqft'}</span>} />
          </div>
          {areaSqft > 0 && (
            <button
              onClick={() => setShowConversions((v) => !v)}
              className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all flex-shrink-0 ${showConversions ? 'bg-[#1e3a8a] text-white border-transparent' : 'bg-slate-100/90 text-slate-700 border-slate-200 hover:bg-slate-200/60'}`}
              title="Toggle All Area Unit Conversions"
            >
              Conversions
            </button>
          )}
          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
          <button onClick={() => setShowLabels((v) => !v)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 active:scale-95 ${showLabels ? 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white border-transparent shadow-sm' : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200/60'}`} title="Toggle Labels">
            {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleUndo} disabled={points.length === 0} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border border-transparent transition-all flex-shrink-0 bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white hover:opacity-90 active:scale-95 disabled:opacity-40 shadow-sm" title="Undo">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleReset} disabled={points.length === 0} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border border-transparent transition-all flex-shrink-0 bg-red-500 text-white hover:bg-red-600 active:scale-95 disabled:opacity-40 shadow-sm" title="Delete All">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
          <button onClick={() => setLocked(v => !v)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 active:scale-95 ${locked ? 'bg-amber-500 text-white border-transparent shadow-sm' : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200/60'}`} title={locked ? 'Unlock Pointing' : 'Lock Pointing (stop adding points)'}>
            {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button onClick={toggleBaseDiagMode} disabled={points.length < 3} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 active:scale-95 ${baseDiagMode ? 'bg-[#2563eb] text-white border-transparent shadow-sm' : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200/60'} disabled:opacity-40`} title="Diagonal Setup — select base + connected point groups for PDF">
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEntranceMode(v => { const next = !v; if (next) setBaseDiagMode(false); return next; }); }} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 active:scale-95 ${entranceMode || entrancePoint ? 'bg-amber-500 text-white border-transparent shadow-sm' : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200/60'}`} title={entrancePoint ? 'Vehicle Entrance Set (click to relocate or clear)' : 'Set Vehicle Entrance / Navigation Point'}>
            <Navigation className="w-3.5 h-3.5" />
          </button>
        </div>
      }

      {/* ─── Action Bar ─── */}
      {mapLoaded && (
        <div className="grid grid-cols-5 gap-1 bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#1e3a8a] text-white px-2 py-1.5 flex-shrink-0 font-sans shadow-md z-[1001]">
          <button onClick={() => openPlotActionModal('save')} disabled={points.length < 3} className="flex flex-col items-center gap-0.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all disabled:opacity-40">
            <BookMarked className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">Save</span>
          </button>
          <button onClick={handleShareGeoJSON} disabled={points.length < 3} className="flex flex-col items-center gap-0.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all disabled:opacity-40">
            <FileDown className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">GeoJSON</span>
          </button>
          <button onClick={handleShareKML} disabled={points.length < 3} className="flex flex-col items-center gap-0.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all disabled:opacity-40">
            <FileDown className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">KML</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-0.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">Import</span>
          </button>
          <button onClick={() => openPlotActionModal('pdf')} disabled={pdfLoading || points.length < 3} className="flex flex-col items-center gap-0.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all disabled:opacity-40">
            <FileText className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">{pdfLoading ? '...' : 'PDF'}</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml" className="hidden" onChange={handleImportFile} />
        </div>
      )}

      {/* ─── Conversions Floating Drawer Panel ─── */}
      {mapLoaded && areaSqft > 0 && showConversions && (
        <div className="absolute bottom-24 left-3 right-3 sm:left-auto sm:right-3 sm:w-96 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xl max-h-[50vh] overflow-y-auto z-[1002]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Square className="w-3.5 h-3.5 text-[#2563eb]" />
              All Area Unit Conversions
            </span>
            <button onClick={() => setShowConversions(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <AreaConversionList areaSqm={areaSqm} primaryUnitId={areaOutputUnit?.unit_id} />
        </div>
      )}

      <MapShareDialog
        open={shareDialog.open}
        blob={shareDialog.blob}
        filename={shareDialog.filename}
        title={shareDialog.title}
        onClose={() => setShareDialog((prev) => ({ ...prev, open: false }))} />

      <PlotActionModal
        open={plotActionModal.open}
        mode={plotActionModal.mode}
        onClose={() => setPlotActionModal({ open: false, mode: 'save' })}
        plotData={{
          shape_type: 'map',
          calc_mode: 'map',
          unit_id: lengthDisplayUnit,
          area_sqft: areaSqft,
          area_sqm: areaSqm,
          is_map_mode: true,
          map_points: JSON.stringify(points),
          navigation_point: entrancePoint ? JSON.stringify(entrancePoint) : null,
          ...(livePlotInfo?.id ? { id: livePlotInfo.id } : {}),
        }}
        onSaved={(savedRecord) => {
          if (savedRecord) setLivePlotInfo(savedRecord);
          setPlotActionModal({ open: false, mode: 'save' });
        }}
        onGeneratePDF={(plotInfo, pdfConfig) => {
          setPlotActionModal({ open: false, mode: 'save' });
          handleExportMapPDF(plotInfo, pdfConfig);
        }}
        points={points}
        sideLabels={computedSideLabels}
        diagGroups={diagGroups}
        initialPlotInfo={livePlotInfo ? {
          plotName: livePlotInfo.plot_name || '',
          address: livePlotInfo.address || '',
          owner: livePlotInfo.owner || '',
          notes: livePlotInfo.notes || '',
          boundaryNames: livePlotInfo.chauhaddi || [],
          id: livePlotInfo.id,
        } : undefined}
        elevation={avgElevation ?? (livePlotInfo?.elevation || null)}
        initialPdfConfig={parsedPdfConfig || undefined}
      />
    </div>
  );
}
