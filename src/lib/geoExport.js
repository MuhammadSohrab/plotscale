/**
 * GeoJSON & KML export/import utilities for Map Mode.
 */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Blob generators (for share + download) ───
export function getGeoJSONBlob(points, areaSqft) {
  if (!points || points.length < 3) return null;
  const ring = [...points.map(p => [p.lng, p.lat]), [points[0].lng, points[0].lat]];
  const geojson = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {
        name: "PlotScale Plot",
        area_sqft: +areaSqft.toFixed(2),
        area_sqm: +(areaSqft * 0.092903).toFixed(2),
        points_count: points.length,
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    }],
  };
  return { blob: new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" }), filename: 'plotscale-plot.geojson' };
}

export function getKMLBlob(points, areaSqft) {
  if (!points || points.length < 3) return null;
  const coords = points.map(p => `${p.lng},${p.lat},0`).join(' ');
  const closedCoords = `${coords} ${points[0].lng},${points[0].lat},0`;
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>PlotScale Plot</name>
    <Placemark>
      <name>Plot (${(areaSqft * 0.092903).toFixed(2)} m²)</name>
      <Style><PolyStyle><color>8010b981</color><fill>1</fill></PolyStyle></Style>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>${closedCoords}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
  return { blob: new Blob([kml], { type: "application/vnd.google-earth.kml+xml" }), filename: 'plotscale-plot.kml' };
}

export function exportToGeoJSON(points, areaSqft) {
  const result = getGeoJSONBlob(points, areaSqft);
  if (result) downloadBlob(result.blob, result.filename);
}

export function exportToKML(points, areaSqft) {
  const result = getKMLBlob(points, areaSqft);
  if (result) downloadBlob(result.blob, result.filename);
}

/**
 * Share a file via Web Share API (Level 2 — file sharing).
 * Falls back to download if sharing not supported.
 * Returns 'shared' | 'downloaded' | 'unsupported'.
 */
export async function shareFile(blob, filename, title, text) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function parseGeoJSON(text) {
  const data = JSON.parse(text);
  const feature = data.features?.[0] || data;
  const geom = feature.geometry || feature;
  const extractRing = (ring) => {
    const isClosed = ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1];
    return (isClosed ? ring.slice(0, -1) : ring).map(c => ({ lat: c[1], lng: c[0] }));
  };
  if (geom.type === 'Polygon') return extractRing(geom.coordinates[0]);
  if (geom.type === 'MultiPolygon') return extractRing(geom.coordinates[0][0]);
  if (geom.type === 'LineString') return geom.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
  return [];
}

export function parseKML(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Invalid KML XML');
  const coordsElements = doc.querySelectorAll('coordinates');
  if (coordsElements.length === 0) return [];
  const coordsText = coordsElements[0].textContent.trim();
  const coords = coordsText.split(/\s+/);
  const points = coords.map(c => {
    const parts = c.split(',');
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
  // Remove closing duplicate
  if (points.length > 3 &&
      points[0].lat === points[points.length - 1].lat &&
      points[0].lng === points[points.length - 1].lng) {
    return points.slice(0, -1);
  }
  return points;
}
