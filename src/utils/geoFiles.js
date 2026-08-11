const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const validPoint = (point) =>
  Number.isFinite(point?.lat)
  && Number.isFinite(point?.lng)
  && point.lat >= -90
  && point.lat <= 90
  && point.lng >= -180
  && point.lng <= 180;

const pointsEqual = (first, second) =>
  first.lat === second.lat && first.lng === second.lng;

const crossProduct = (a, b, c) =>
  ((b.lng - a.lng) * (c.lat - a.lat)) - ((b.lat - a.lat) * (c.lng - a.lng));

const orientation = (a, b, c) => Math.sign(crossProduct(a, b, c));

const pointOnSegment = (point, start, end) =>
  Math.abs(crossProduct(start, end, point)) < 1e-12
  && point.lng >= Math.min(start.lng, end.lng)
  && point.lng <= Math.max(start.lng, end.lng)
  && point.lat >= Math.min(start.lat, end.lat)
  && point.lat <= Math.max(start.lat, end.lat);

const segmentsIntersect = (a, b, c, d) => {
  const firstOrientation = orientation(a, b, c);
  const secondOrientation = orientation(a, b, d);
  const thirdOrientation = orientation(c, d, a);
  const fourthOrientation = orientation(c, d, b);
  if (
    firstOrientation !== secondOrientation
    && thirdOrientation !== fourthOrientation
  ) return true;
  return (firstOrientation === 0 && pointOnSegment(c, a, b))
    || (secondOrientation === 0 && pointOnSegment(d, a, b))
    || (thirdOrientation === 0 && pointOnSegment(a, c, d))
    || (fourthOrientation === 0 && pointOnSegment(b, c, d));
};

export function validateGeoPoints(points) {
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error("A polygon must contain at least three points.");
  }
  if (points.length > 250) throw new Error("A polygon may contain at most 250 points.");
  if (!points.every(validPoint)) throw new Error("The file contains invalid latitude/longitude values.");
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first];
    const b = points[(first + 1) % points.length];
    if (pointsEqual(a, b)) throw new Error("A polygon cannot contain a zero-length side.");
    for (let second = first + 1; second < points.length; second += 1) {
      if (
        second === first
        || second === (first + 1) % points.length
        || first === (second + 1) % points.length
      ) continue;
      const c = points[second];
      const d = points[(second + 1) % points.length];
      if (segmentsIntersect(a, b, c, d)) {
        throw new Error("The imported polygon crosses itself.");
      }
    }
  }
  return points;
}

export function parseGeoJson(text) {
  const data = JSON.parse(text);
  const geometry = data.type === "Feature" ? data.geometry : data;
  if (geometry?.type !== "Polygon") throw new Error("Only GeoJSON Polygon files are supported.");
  const ring = geometry.coordinates?.[0];
  if (!Array.isArray(ring)) throw new Error("GeoJSON polygon coordinates are missing.");
  const points = ring.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
  if (
    points.length > 1
    && points[0].lat === points.at(-1).lat
    && points[0].lng === points.at(-1).lng
  ) points.pop();
  return validateGeoPoints(points);
}

export function parseKml(text) {
  const documentNode = new DOMParser().parseFromString(text, "application/xml");
  if (documentNode.querySelector("parsererror")) throw new Error("The KML document is malformed.");
  const coordinateText = documentNode.querySelector("Polygon coordinates")?.textContent;
  if (!coordinateText) throw new Error("KML Polygon coordinates are missing.");
  const points = coordinateText.trim().split(/\s+/).map((coordinate) => {
    const [lng, lat] = coordinate.split(",").map(Number);
    return { lat, lng };
  });
  if (
    points.length > 1
    && points[0].lat === points.at(-1).lat
    && points[0].lng === points.at(-1).lng
  ) points.pop();
  return validateGeoPoints(points);
}

export async function readGeoFile(file) {
  if (!file) throw new Error("Choose a GeoJSON or KML file.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("The import file must be 2 MB or smaller.");
  const text = await file.text();
  return file.name.toLowerCase().endsWith(".kml") ? parseKml(text) : parseGeoJson(text);
}

export function buildGeoJson(points, properties = {}) {
  validateGeoPoints(points);
  const ring = points.map(({ lat, lng }) => [lng, lat]);
  ring.push([...ring[0]]);
  return JSON.stringify({
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [ring] },
  }, null, 2);
}

export function buildKml(points, name = "PlotScale plot") {
  validateGeoPoints(points);
  const coordinates = [...points, points[0]]
    .map(({ lat, lng }) => `${lng},${lat},0`)
    .join(" ");
  const safeName = name.replace(/[<>&"']/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${safeName}</name>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
</kml>`;
}

export function downloadTextFile(contents, fileName, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function shareOrDownloadTextFile(contents, fileName, type, title) {
  if (typeof File !== "undefined" && navigator.share) {
    const file = new File([contents], fileName, { type });
    const sharePayload = { title, files: [file] };
    if (!navigator.canShare || navigator.canShare(sharePayload)) {
      try {
        await navigator.share(sharePayload);
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") return "cancelled";
      }
    }
  }
  downloadTextFile(contents, fileName, type);
  return "downloaded";
}
