import {
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileUp,
  Focus,
  Layers,
  LocateFixed,
  Lock,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Mountain,
  Navigation,
  Redo2,
  RotateCcw,
  Satellite,
  Save,
  Search,
  Share2,
  SlidersHorizontal,
  Tag,
  Trash2,
  Unlock,
  X,
  ZoomIn,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "../../services/GoogleMapsLoader";
import {
  buildGeoJson,
  buildKml,
  readGeoFile,
  shareOrDownloadTextFile,
} from "../../utils/geoFiles";

const DEFAULT_CENTER = { lat: 26.7606, lng: 83.3732 };

const mapTypeIcons = {
  hybrid: Layers,
  satellite: Satellite,
  roadmap: MapIcon,
  terrain: Mountain,
};

const noFeatureStyles = [
  { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "all", stylers: [{ visibility: "off" }] },
];

const format = (value, digits = 2) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);

const midpoint = (maps, first, second) =>
  maps.geometry.spherical.interpolate(
    new maps.LatLng(first.lat, first.lng),
    new maps.LatLng(second.lat, second.lng),
    0.5,
  );

const centroid = (points) => points.length
  ? {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  }
  : null;

const localVertices = (points) => {
  if (!points.length) return [];
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const cosLat = Math.cos(meanLat * Math.PI / 180);
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  return points.map((point) => ({
    x: (point.lng - minLng) * 111_320 * cosLat,
    y: (maxLat - point.lat) * 111_320,
  }));
};

export function MapMeasurementMode({
  points,
  onPointsChange,
  navigationPoint,
  onNavigationPointChange,
  diagonalGroups,
  onDiagonalGroupsChange,
  lengthUnit,
  areaUnit,
  areaUnits,
  onResultChange,
  onSave,
  onExportPdf,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const markersRef = useRef([]);
  const labelsRef = useRef([]);
  const diagonalLinesRef = useRef([]);
  const navigationMarkerRef = useRef(null);
  const searchRef = useRef(null);
  const importRef = useRef(null);
  const magnifierNodeRef = useRef(null);
  const magnifierMapRef = useRef(null);
  const magnifierHostRef = useRef(null);
  const magnifierPolygonRef = useRef(null);
  const hasInitialPointsRef = useRef(points.length > 0);
  const lockedRef = useRef(false);
  const diagonalModeRef = useRef(false);
  const activeGroupIdRef = useRef(null);
  const navigationModeRef = useRef(false);
  const onPointsChangeRef = useRef(onPointsChange);
  const onNavigationPointChangeRef = useRef(onNavigationPointChange);
  const pointsRef = useRef(points);

  const [maps, setMaps] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locked, setLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showMagnifier, setShowMagnifier] = useState(true);
  const [showMapControls, setShowMapControls] = useState(true);
  const [showMapTypeMenu, setShowMapTypeMenu] = useState(false);
  const [showConversions, setShowConversions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [maximumImageryZoom, setMaximumImageryZoom] = useState(null);
  const [mapType, setMapType] = useState("hybrid");
  const [markerScale, setMarkerScale] = useState(7);
  const [diagonalMode, setDiagonalMode] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [navigationMode, setNavigationMode] = useState(false);
  const [averageElevationM, setAverageElevationM] = useState(null);
  const [locating, setLocating] = useState(false);

  const diagonalPairs = useMemo(
    () => diagonalGroups.flatMap((group) =>
      group.connected.map((connected) => [group.base, connected])),
    [diagonalGroups],
  );
  const pointStatus = useMemo(() => {
    const bases = new Set();
    const connected = new Set();
    diagonalGroups.forEach((group) => {
      bases.add(group.base);
      group.connected.forEach((point) => connected.add(point));
    });
    return { bases, connected };
  }, [diagonalGroups]);
  const activeGroup = diagonalGroups.find((group) => group.id === activeGroupId) ?? null;

  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { diagonalModeRef.current = diagonalMode; }, [diagonalMode]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);
  useEffect(() => { navigationModeRef.current = navigationMode; }, [navigationMode]);
  useEffect(() => { onPointsChangeRef.current = onPointsChange; }, [onPointsChange]);
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => {
    onNavigationPointChangeRef.current = onNavigationPointChange;
  }, [onNavigationPointChange]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    loadGoogleMaps()
      .then((loadedMaps) => {
        if (!active) return;
        setMaps(loadedMaps);
        setStatus("ready");
      })
      .catch((caught) => {
        if (!active) return;
        setStatus("error");
        setError(caught.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!maps || !mapNodeRef.current || mapRef.current) return undefined;
    const map = new maps.Map(mapNodeRef.current, {
      center: DEFAULT_CENTER,
      zoom: 20,
      // A cloud map ID disables runtime JSON styles, which this screen uses
      // for the user-controlled roads, addresses and labels visibility toggle.
      mapTypeId: "hybrid",
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      gestureHandling: "greedy",
      clickableIcons: false,
    });
    mapRef.current = map;
    const clickListener = map.addListener("click", (event) => {
      if (!event.latLng) return;
      const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      if (navigationModeRef.current) {
        onNavigationPointChangeRef.current(point);
        setNavigationMode(false);
        return;
      }
      if (lockedRef.current || diagonalModeRef.current) return;
      onPointsChangeRef.current((current) => [...current, point]);
    });
    if (navigator.geolocation && !hasInitialPointsRef.current) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => map.setCenter({ lat: coords.latitude, lng: coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 6_000 },
      );
    }
    return () => {
      clickListener.remove();
      maps.event.clearInstanceListeners(map);
      magnifierPolygonRef.current?.setMap(null);
      magnifierPolygonRef.current = null;
      if (magnifierMapRef.current) maps.event.clearInstanceListeners(magnifierMapRef.current);
      magnifierMapRef.current = null;
      magnifierHostRef.current = null;
      mapRef.current = null;
    };
  }, [maps]);

  const measurement = useMemo(() => {
    if (!maps || points.length < 3) return null;
    const path = points.map((point) => new maps.LatLng(point.lat, point.lng));
    const areaSqm = maps.geometry.spherical.computeArea(path);
    const sideLengthsMeters = points.map((point, index) =>
      maps.geometry.spherical.computeDistanceBetween(
        new maps.LatLng(point.lat, point.lng),
        new maps.LatLng(points[(index + 1) % points.length].lat, points[(index + 1) % points.length].lng),
      ));
    const validDiagonalPairs = diagonalPairs.filter(([from, to]) =>
      points[from] && points[to] && from !== to);
    return {
      mode: "map",
      method: "google_spherical_geometry",
      exactness: "coordinate_measured",
      warning: "Satellite imagery, point placement and provider data determine practical accuracy.",
      areaSqm,
      perimeterM: sideLengthsMeters.reduce((sum, side) => sum + side, 0),
      sideLengthsMeters,
      diagonalsMeters: validDiagonalPairs.map(([from, to]) =>
        maps.geometry.spherical.computeDistanceBetween(
          new maps.LatLng(points[from].lat, points[from].lng),
          new maps.LatLng(points[to].lat, points[to].lng),
        )),
      diagonalPairs: validDiagonalPairs,
      diagonalGroups,
      averageElevationM,
      triangles: [],
      vertices: localVertices(points),
      sideLabels: sideLengthsMeters.map((side) =>
        `${format(side / Number(lengthUnit.factorToBase))} ${lengthUnit.symbol}`),
    };
  }, [averageElevationM, diagonalGroups, diagonalPairs, lengthUnit, maps, points]);

  useEffect(() => {
    if (!maps || points.length < 3) {
      setAverageElevationM(null);
      return undefined;
    }
    let active = true;
    const locations = points.map((point) => new maps.LatLng(point.lat, point.lng));
    new maps.ElevationService().getElevationForLocations(
      { locations },
      (results, elevationStatus) => {
        if (!active) return;
        if (elevationStatus !== "OK" || !results?.length) {
          setAverageElevationM(null);
          return;
        }
        const elevations = results
          .map((result) => result.elevation)
          .filter(Number.isFinite);
        setAverageElevationM(
          elevations.length
            ? elevations.reduce((sum, elevation) => sum + elevation, 0) / elevations.length
            : null,
        );
      },
    );
    return () => {
      active = false;
    };
  }, [maps, points]);

  useEffect(() => {
    onResultChange(measurement);
  }, [measurement, onResultChange]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = points.map((point, index) => {
      const isBase = pointStatus.bases.has(index);
      const isConnected = pointStatus.connected.has(index);
      const marker = new maps.Marker({
        map: mapRef.current,
        position: point,
        draggable: !locked && !diagonalMode,
        zIndex: 20,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: markerScale,
          fillColor: isBase ? "#2563eb" : isConnected ? "#7c3aed" : "#22c55e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        },
        title: `Corner ${index + 1}`,
      });
      marker.addListener("drag", (event) => {
        if (event.latLng && magnifierMapRef.current) magnifierMapRef.current.setCenter(event.latLng);
      });
      marker.addListener("dragend", (event) => {
        if (!event.latLng) return;
        const nextPoint = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        onPointsChangeRef.current((current) =>
          current.map((item, itemIndex) => itemIndex === index ? nextPoint : item));
      });
      marker.addListener("click", () => {
        if (!diagonalModeRef.current) return;
        const currentGroupId = activeGroupIdRef.current;
        if (currentGroupId === null) {
          const id = crypto.randomUUID();
          onDiagonalGroupsChange((groups) => [...groups, {
            id,
            base: index,
            connected: [],
          }]);
          setActiveGroupId(id);
          return;
        }
        onDiagonalGroupsChange((groups) => groups.map((group) => {
          if (group.id !== currentGroupId || group.base === index) return group;
          return {
            ...group,
            connected: group.connected.includes(index)
              ? group.connected.filter((connected) => connected !== index)
              : [...group.connected, index],
          };
        }));
      });
      return marker;
    });
  }, [
    diagonalMode,
    locked,
    maps,
    markerScale,
    onDiagonalGroupsChange,
    pointStatus,
    points,
  ]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    if (!polygonRef.current) {
      polygonRef.current = new maps.Polygon({
        map: mapRef.current,
        strokeColor: "#2563eb",
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: "#22c55e",
        fillOpacity: 0.2,
        geodesic: true,
      });
    }
    polygonRef.current.setPath(points);
    if (points.length >= 3 && !mapRef.current.getBounds()?.contains(points[0])) {
      const bounds = new maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 40);
    }
  }, [maps, points]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    labelsRef.current.forEach((marker) => marker.setMap(null));
    labelsRef.current = [];
    if (!showLabels || points.length < 2) return;
    points.forEach((point, index) => {
      if (points.length < 3 && index === points.length - 1) return;
      const next = points[(index + 1) % points.length];
      const distance = maps.geometry.spherical.computeDistanceBetween(
        new maps.LatLng(point.lat, point.lng),
        new maps.LatLng(next.lat, next.lng),
      );
      labelsRef.current.push(new maps.Marker({
        map: mapRef.current,
        position: midpoint(maps, point, next),
        clickable: false,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 0 },
        label: {
          text: `${format(distance / Number(lengthUnit.factorToBase))} ${lengthUnit.symbol}`,
          className: "plotscale-map-label",
        },
      }));
    });
    if (measurement) {
      labelsRef.current.push(new maps.Marker({
        map: mapRef.current,
        position: centroid(points),
        clickable: false,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 0 },
        label: {
          text: `${format(measurement.areaSqm / Number(areaUnit.factorToBase))} ${areaUnit.symbol}`,
          className: "plotscale-map-area-label",
        },
      }));
    }
  }, [areaUnit, lengthUnit, maps, measurement, points, showLabels]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    diagonalLinesRef.current.forEach((line) => line.setMap(null));
    diagonalLinesRef.current = diagonalPairs
      .filter(([from, to]) => points[from] && points[to])
      .map(([from, to]) => new maps.Polyline({
      map: mapRef.current,
      path: [points[from], points[to]],
      strokeColor: "#7c3aed",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      geodesic: true,
      icons: [{
        icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
        offset: "0",
        repeat: "10px",
      }],
      }));
  }, [diagonalPairs, maps, points]);

  useEffect(() => {
    if (!maps || !mapRef.current) return;
    if (navigationMarkerRef.current) navigationMarkerRef.current.setMap(null);
    navigationMarkerRef.current = navigationPoint
      ? new maps.Marker({
        map: mapRef.current,
        position: navigationPoint,
        title: "Navigation / entrance point",
        icon: {
          path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      })
      : null;
  }, [maps, navigationPoint]);

  useEffect(() => {
    if (!maps || !mapRef.current || !searchRef.current) return undefined;
    const autocomplete = new maps.places.Autocomplete(searchRef.current, {
      fields: ["geometry", "name", "formatted_address"],
    });
    autocomplete.bindTo("bounds", mapRef.current);
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      mapRef.current.setCenter(place.geometry.location);
      mapRef.current.setZoom(20);
    });
    const searchInput = searchRef.current;
    const geocodeOnEnter = (event) => {
      if (event.key !== "Enter" || !searchInput.value.trim()) return;
      event.preventDefault();
      new maps.Geocoder().geocode({ address: searchInput.value.trim() }, (results, geocodeStatus) => {
        if (geocodeStatus === "OK" && results?.[0]) {
          mapRef.current.setCenter(results[0].geometry.location);
          mapRef.current.setZoom(20);
        } else {
          setNotice("Location was not found.");
        }
      });
    };
    // Capture Enter before the Places widget can consume the keyboard event.
    searchInput.addEventListener("keydown", geocodeOnEnter, true);
    return () => {
      listener.remove();
      searchInput.removeEventListener("keydown", geocodeOnEnter, true);
    };
  }, [diagonalMode, maps]);

  useEffect(() => {
    if (!maps || !showMagnifier || !magnifierNodeRef.current || !mapRef.current) return undefined;

    const host = magnifierNodeRef.current;
    if (!magnifierMapRef.current || magnifierHostRef.current !== host) {
      magnifierPolygonRef.current?.setMap(null);
      magnifierPolygonRef.current = null;
      if (magnifierMapRef.current) maps.event.clearInstanceListeners(magnifierMapRef.current);
      magnifierMapRef.current = new maps.Map(host, {
        center: points.at(-1) ?? mapRef.current.getCenter(),
        zoom: maximumImageryZoom ?? 21,
        mapTypeId: mapType,
        mapTypeControl: false,
        zoomControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "none",
        clickableIcons: false,
        disableDefaultUI: true,
        styles: showFeatures ? [] : noFeatureStyles,
      });
      magnifierHostRef.current = host;
    }

    let active = true;
    const target = points.at(-1) ?? mapRef.current.getCenter();
    if (!target) return undefined;
    magnifierMapRef.current.setCenter(target);
    const maxZoomService = new maps.MaxZoomService();
    maxZoomService.getMaxZoomAtLatLng(target).then((result) => {
      if (!active || magnifierHostRef.current !== host || !result?.zoom) return;
      setMaximumImageryZoom(result.zoom);
      magnifierMapRef.current?.setZoom(result.zoom);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [mapType, maps, maximumImageryZoom, points, showFeatures, showMagnifier]);

  useEffect(() => {
    if (showMagnifier) return;
    magnifierPolygonRef.current?.setMap(null);
    magnifierPolygonRef.current = null;
    if (magnifierMapRef.current && maps) {
      maps.event.clearInstanceListeners(magnifierMapRef.current);
    }
    magnifierMapRef.current = null;
    magnifierHostRef.current = null;
  }, [maps, showMagnifier]);

  useEffect(() => {
    if (!maps || !showMagnifier || !magnifierMapRef.current) return;
    if (magnifierPolygonRef.current) magnifierPolygonRef.current.setMap(null);
    magnifierPolygonRef.current = new maps.Polygon({
      map: magnifierMapRef.current,
      paths: points,
      strokeColor: "#2563eb",
      strokeWeight: 3,
      fillColor: "#22c55e",
      fillOpacity: 0.18,
      geodesic: true,
    });
  }, [maps, points, showMagnifier]);

  useEffect(() => {
    if (!maps || !showMagnifier || !mapRef.current) return undefined;
    const listener = mapRef.current.addListener("idle", () => {
      const target = mapRef.current?.getCenter();
      if (!target || !magnifierMapRef.current) return;
      magnifierMapRef.current.setCenter(target);
      new maps.MaxZoomService().getMaxZoomAtLatLng(target).then((result) => {
        if (!result?.zoom || !magnifierMapRef.current) return;
        setMaximumImageryZoom(result.zoom);
        magnifierMapRef.current.setZoom(result.zoom);
      }).catch(() => {});
    });
    return () => listener.remove();
  }, [maps, showMagnifier]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType);
    magnifierMapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    if (!maps || !mapRef.current) return undefined;
    const resizeTimer = window.setTimeout(() => {
      maps.event.trigger(mapRef.current, "resize");
      if (pointsRef.current.length >= 3) {
        const bounds = new maps.LatLngBounds();
        pointsRef.current.forEach((point) => bounds.extend(point));
        mapRef.current.fitBounds(bounds, 40);
      }
    }, 220);
    return () => window.clearTimeout(resizeTimer);
  }, [fullscreen, maps]);

  useEffect(() => {
    mapRef.current?.setOptions({ styles: showFeatures ? [] : noFeatureStyles });
    magnifierMapRef.current?.setOptions({ styles: showFeatures ? [] : noFeatureStyles });
  }, [showFeatures]);

  const useMyLocation = () => {
    if (!navigator.geolocation || !mapRef.current) {
      setNotice("Location is unavailable on this device.");
      return;
    }
    setLocating(true);
    setNotice("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current.setCenter({ lat: coords.latitude, lng: coords.longitude });
        mapRef.current.setZoom(21);
        setLocating(false);
        setNotice("");
      },
      () => {
        setLocating(false);
        setNotice("Location permission was denied or unavailable.");
      },
      { enableHighAccuracy: true, timeout: 8_000 },
    );
  };

  const undo = () => {
    onPointsChange((current) => {
      return current.slice(0, -1);
    });
    onDiagonalGroupsChange([]);
    setActiveGroupId(null);
  };

  const reset = () => {
    onPointsChange([]);
    onDiagonalGroupsChange([]);
    onNavigationPointChange(null);
    setActiveGroupId(null);
    setDiagonalMode(false);
    setLocked(false);
  };

  const importFile = async (event) => {
    try {
      const importedPoints = await readGeoFile(event.target.files?.[0]);
      onPointsChange(importedPoints);
      onDiagonalGroupsChange([]);
      setActiveGroupId(null);
      const bounds = new maps.LatLngBounds();
      importedPoints.forEach((point) => bounds.extend(point));
      mapRef.current?.fitBounds(bounds, 40);
      setNotice(`${importedPoints.length} corners imported.`);
    } catch (caught) {
      setNotice(caught.message);
    } finally {
      event.target.value = "";
    }
  };

  const exportGeoJson = async () => {
    const outcome = await shareOrDownloadTextFile(
      buildGeoJson(points, { areaSqm: measurement?.areaSqm ?? null }),
      "PlotScale-plot.geojson",
      "application/geo+json",
      "PlotScale GeoJSON plot",
    );
    if (outcome === "downloaded") setNotice("GeoJSON downloaded.");
  };

  const exportKml = async () => {
    const outcome = await shareOrDownloadTextFile(
      buildKml(points, "PlotScale plot"),
      "PlotScale-plot.kml",
      "application/vnd.google-earth.kml+xml",
      "PlotScale KML plot",
    );
    if (outcome === "downloaded") setNotice("KML downloaded.");
  };

  const finishDiagonalSetup = () => {
    setActiveGroupId(null);
    setDiagonalMode(false);
  };

  const clearDiagonalGroups = () => {
    onDiagonalGroupsChange([]);
    setActiveGroupId(null);
  };

  const removeDiagonalGroup = (groupId) => {
    onDiagonalGroupsChange((groups) => groups.filter((group) => group.id !== groupId));
    if (activeGroupId === groupId) setActiveGroupId(null);
  };

  const toggleMapControls = () => {
    setShowMapControls((current) => {
      const next = !current;
      if (!next) {
        setShowMagnifier(false);
        setShowMapTypeMenu(false);
      }
      return next;
    });
  };

  const cycleMarkerScale = () => {
    setMarkerScale((current) => {
      const sizes = [4, 7, 10, 13];
      return sizes[(sizes.indexOf(current) + 1) % sizes.length];
    });
  };

  const MapTypeIcon = mapTypeIcons[mapType];

  if (status === "error") {
    return (
      <section className="map-error-card">
        <MapIcon size={30} />
        <h2>Google Map needs configuration</h2>
        <p>{error}</p>
        <code>VITE_GOOGLE_MAPS_API_KEY</code>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
          <Redo2 size={17} /> Retry
        </button>
      </section>
    );
  }

  return (
    <section className={`map-measurement ${fullscreen ? "map-measurement--fullscreen" : ""}`}>
      <div className="map-measurement__canvas">
        <div className="map-measurement__map" ref={mapNodeRef} />
        {status === "loading" && <div className="map-loading">Loading Google Map…</div>}
        {maps && (
          <>
            {!diagonalMode && (
              <label className={`map-search ${searchFocused ? "is-focused" : ""}`}>
                <Search size={16} />
                <input
                  ref={searchRef}
                  placeholder="Search location or address"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </label>
            )}
            <div className="map-top-tools">
              {!diagonalMode && !searchFocused && (
                <>
                  <button
                    type="button"
                    className={showMapControls ? "is-active" : ""}
                    onClick={toggleMapControls}
                    title="Show or hide map tools"
                    aria-label="Show or hide map tools"
                  >
                    <SlidersHorizontal size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={cycleMarkerScale}
                    title={`Point size ${markerScale}`}
                    aria-label={`Change point size, currently ${markerScale}`}
                  >
                    <span className="map-point-size">
                      {markerScale <= 4 ? "S" : markerScale <= 7 ? "M" : markerScale <= 10 ? "L" : "XL"}
                    </span>
                  </button>
                </>
              )}
              <button type="button" onClick={() => setFullscreen((value) => !value)} title="Fullscreen map">
                {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
              {showMapControls && !diagonalMode && !searchFocused && (
                <>
                  <div className="map-type-control">
                    <button
                      type="button"
                      className={showMapTypeMenu ? "is-active" : ""}
                      onClick={() => setShowMapTypeMenu((value) => !value)}
                      title={`Map type: ${mapType}`}
                      aria-label={`Choose map type, currently ${mapType}`}
                    >
                      <MapTypeIcon size={17} />
                    </button>
                    {showMapTypeMenu && (
                      <div className="map-type-menu" role="menu" aria-label="Map types">
                        {Object.entries(mapTypeIcons).map(([type, Icon]) => (
                          <button
                            type="button"
                            role="menuitem"
                            className={mapType === type ? "is-active" : ""}
                            onClick={() => {
                              setMapType(type);
                              setShowMapTypeMenu(false);
                            }}
                            key={type}
                          >
                            <Icon size={15} />
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={showFeatures ? "is-active" : ""}
                    onClick={() => setShowFeatures((value) => !value)}
                    title="Toggle roads, addresses and map labels"
                    aria-label="Toggle roads, addresses and map labels"
                  >
                    <Tag size={17} />
                  </button>
                  <button
                    type="button"
                    className={showMagnifier ? "is-active" : ""}
                    onClick={() => setShowMagnifier((value) => !value)}
                    title="Precision magnifier"
                    aria-label="Toggle precision magnifier"
                  >
                    <ZoomIn size={17} />
                  </button>
                  <button type="button" onClick={useMyLocation} title="My location" aria-label="My location">
                    {locating ? <span className="map-tool-spinner" /> : <LocateFixed size={17} />}
                  </button>
                </>
              )}
            </div>
            {showMagnifier && (
              <aside className="map-magnifier" aria-label="Maximum satellite zoom magnifier">
                <div className="map-magnifier__viewport">
                  <div
                    className="map-magnifier__scale"
                    style={{ transform: `scale(${digitalZoom})` }}
                  >
                    <div ref={magnifierNodeRef} />
                  </div>
                  <Focus size={22} />
                </div>
                <footer>
                  <span>Max imagery {maximumImageryZoom ? `Z${maximumImageryZoom}` : ""}</span>
                  {[1, 2, 3, 4].map((zoom) => (
                    <button
                      type="button"
                      className={digitalZoom === zoom ? "is-active" : ""}
                      onClick={() => setDigitalZoom(zoom)}
                      key={zoom}
                    >
                      {zoom}×
                    </button>
                  ))}
                </footer>
              </aside>
            )}
            {diagonalMode && (
              <div className="map-diagonal-help">
                <Crosshair size={15} />
                <span>
                  {activeGroup
                    ? `Base P${activeGroup.base + 1}: tap connected corners`
                    : "Tap a base corner"}
                </span>
                {activeGroup && (
                  <button type="button" onClick={() => setActiveGroupId(null)}>New group</button>
                )}
                {diagonalGroups.length > 0 && (
                  <strong>{diagonalGroups.length} group{diagonalGroups.length === 1 ? "" : "s"}</strong>
                )}
                {diagonalGroups.length > 0 && (
                  <button type="button" className="is-danger" onClick={clearDiagonalGroups}>
                    <Eraser size={13} /> Clear
                  </button>
                )}
                <button type="button" className="is-success" onClick={finishDiagonalSetup}>
                  <Check size={13} /> Finish
                </button>
              </div>
            )}
            {diagonalMode && diagonalGroups.length > 0 && (
              <div className="map-diagonal-groups" aria-label="Diagonal groups">
                {diagonalGroups.map((group) => (
                  <div key={group.id}>
                    <strong>P{group.base + 1}</strong>
                    <span>→ {group.connected.map((point) => `P${point + 1}`).join(", ") || "None"}</span>
                    <button
                      type="button"
                      onClick={() => removeDiagonalGroup(group.id)}
                      aria-label={`Remove diagonal group from P${group.base + 1}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {navigationMode && (
              <div className="map-navigation-help">
                <Navigation size={15} /> Tap the vehicle entrance/navigation point
              </div>
            )}
            <div className="map-status">
              {points.length < 3
                ? `${points.length} corner${points.length === 1 ? "" : "s"} — tap map to add ${3 - points.length} more`
                : `${points.length} corners · ${format(measurement.areaSqm / Number(areaUnit.factorToBase))} ${areaUnit.symbol}${averageElevationM === null ? "" : ` · Elev. ${format(averageElevationM, 1)} m`}`}
            </div>
          </>
        )}
      </div>

      {maps && (
        <>
          <div className="map-edit-toolbar" aria-label="Map editing controls">
            <button type="button" className={showLabels ? "is-active" : ""} onClick={() => setShowLabels((value) => !value)}>
              {showLabels ? <Eye size={16} /> : <EyeOff size={16} />} Labels
            </button>
            <button type="button" onClick={undo} disabled={!points.length}>
              <RotateCcw size={16} /> Undo
            </button>
            <button type="button" className={locked ? "is-warning" : ""} onClick={() => setLocked((value) => !value)}>
              {locked ? <Lock size={16} /> : <Unlock size={16} />} {locked ? "Locked" : "Drawing"}
            </button>
            <button type="button" className={diagonalMode ? "is-active" : ""} disabled={points.length < 3} onClick={() => {
              setDiagonalMode((value) => !value);
              setLocked(true);
              setNavigationMode(false);
              setActiveGroupId(null);
            }}>
              <Crosshair size={16} /> Diagonals
            </button>
            <button type="button" className={navigationMode ? "is-active" : ""} disabled={points.length < 3} onClick={() => {
              setNavigationMode((value) => !value);
              setDiagonalMode(false);
            }}>
              <Navigation size={16} /> Entrance
            </button>
            <button type="button" onClick={cycleMarkerScale}>
              <Focus size={16} /> Point {markerScale}
            </button>
            <button type="button" className="is-danger" onClick={reset} disabled={!points.length}>
              <Trash2 size={16} /> Clear
            </button>
          </div>

          <div className="map-file-actions">
            <button type="button" onClick={onSave} disabled={points.length < 3}>
              <Save size={16} /> Save
            </button>
            <button type="button" onClick={exportGeoJson} disabled={points.length < 3}>
              <Share2 size={16} /> GeoJSON
            </button>
            <button type="button" onClick={exportKml} disabled={points.length < 3}>
              <Share2 size={16} /> KML
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              <FileUp size={16} /> Import
            </button>
            <button type="button" onClick={onExportPdf} disabled={points.length < 3}>
              <Download size={16} /> PDF
            </button>
            <input
              ref={importRef}
              type="file"
              hidden
              accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
              onChange={importFile}
            />
          </div>
          {measurement && (
            <section className="map-conversions">
              <button
                type="button"
                onClick={() => setShowConversions((value) => !value)}
                aria-expanded={showConversions}
              >
                <span><Layers size={16} /> All area conversions</span>
                {showConversions ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              </button>
              {showConversions && (
                <div className="map-conversions__grid">
                  {areaUnits
                    .filter((unit) => Number(unit.factorToBase) > 0)
                    .map((unit) => (
                      <div key={unit.id}>
                        <span>{unit.name}</span>
                        <strong>
                          {format(measurement.areaSqm / Number(unit.factorToBase), 6)} {unit.symbol}
                        </strong>
                      </div>
                    ))}
                  {averageElevationM !== null && (
                    <div>
                      <span>Average corner elevation</span>
                      <strong>{format(averageElevationM, 2)} m</strong>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {notice && <p className="map-notice">{notice}</p>}
    </section>
  );
}
