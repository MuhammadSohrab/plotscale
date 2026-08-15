import { getGoogleMapsConfiguration } from "./GoogleMapsLoader";

const COLORS = {
  navy: [30, 58, 138],
  blue: [37, 99, 235],
  green: [34, 197, 94],
  ink: [23, 33, 58],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  pale: [241, 245, 249],
  warning: [180, 83, 9],
};

const format = (value, digits = 3) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);

const safeFileName = (value) =>
  (value || "Plot").replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Plot";

function dataUrlFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadOriginalLogo() {
  try {
    const response = await fetch("/assets/plotscale_logo_primary.svg");
    if (!response.ok) return null;
    const svgBlob = await response.blob();
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, 256, 256);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    return null;
  }
}

function drawHeader(pdf, logo) {
  if (logo) pdf.addImage(logo, "PNG", 14, 8, 12, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...COLORS.navy);
  pdf.text("Plot", 29, 16);
  const plotWidth = pdf.getTextWidth("Plot");
  pdf.setTextColor(...COLORS.green);
  pdf.text("Scale", 29 + plotWidth, 16);
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("LAND MEASUREMENT REPORT", 29, 20);
  pdf.setDrawColor(...COLORS.line);
  pdf.line(14, 24, 196, 24);
}

function drawFooter(pdf, page, pages) {
  pdf.setDrawColor(...COLORS.line);
  pdf.line(14, 284, 196, 284);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Generated locally by PlotScale", 14, 289);
  pdf.text(`Page ${page} of ${pages}`, 196, 289, { align: "right" });
}

function fitPoints(points, x, y, width, height, padding = 12) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (width - (2 * padding)) / Math.max(maxX - minX, 1e-9),
    (height - (2 * padding)) / Math.max(maxY - minY, 1e-9),
  );
  return points.map((point) => ({
    x: x + padding + ((point.x - minX) * scale),
    y: y + padding + ((point.y - minY) * scale),
  }));
}

function mapPointsToLocal(points) {
  if (!points?.length) return [];
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const cosLat = Math.cos(meanLat * Math.PI / 180);
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  return points.map((point) => ({
    x: (point.lng - minLng) * 111_320 * cosLat,
    y: (maxLat - point.lat) * 111_320,
  }));
}

function drawPlotDiagram(pdf, snapshot, x, y, width, height) {
  const rawPoints = snapshot.sourceType === "map"
    ? mapPointsToLocal(snapshot.map?.points)
    : snapshot.result.vertices;
  if (!rawPoints?.length) return;
  const points = fitPoints(rawPoints, x, y, width, height);
  pdf.setFillColor(239, 246, 255);
  pdf.setDrawColor(...COLORS.blue);
  pdf.setLineWidth(0.7);
  const lines = points.slice(1).map((point, index) => [
    point.x - points[index].x,
    point.y - points[index].y,
  ]);
  pdf.lines(lines, points[0].x, points[0].y, [1, 1], "FD", true);

  const pairs = snapshot.result.diagonalPairs ?? [];
  pdf.setDrawColor(...COLORS.muted);
  pdf.setLineDashPattern([1.5, 1], 0);
  pairs.forEach(([from, to]) => {
    if (points[from] && points[to]) {
      pdf.line(points[from].x, points[from].y, points[to].x, points[to].y);
    }
  });
  pdf.setLineDashPattern([], 0);

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    pdf.setFillColor(...COLORS.green);
    pdf.circle(point.x, point.y, 1.3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.navy);
    pdf.text(`P${index + 1}`, point.x + 2, point.y - 2);
    const label = snapshot.result.sideLabels?.[index];
    if (label) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...COLORS.ink);
      pdf.text(label, (point.x + next.x) / 2, ((point.y + next.y) / 2) - 1.5, {
        align: "center",
      });
    }
  });
}

function computeStaticMapZoom(points, sizePixels = 640) {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const centreLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const cosineLatitude = Math.cos(centreLatitude * Math.PI / 180);
  const latitudeSpanMeters = (Math.max(...latitudes) - Math.min(...latitudes)) * 111_320;
  const longitudeSpanMeters = (
    (Math.max(...longitudes) - Math.min(...longitudes)) * 111_320 * cosineLatitude
  );
  const diagonalMeters = Math.hypot(latitudeSpanMeters, longitudeSpanMeters) || 25;
  const metresPerPixel = diagonalMeters / (sizePixels * 0.45);
  return Math.max(
    13,
    Math.min(20, Math.round(Math.log2((156_543.03392 * cosineLatitude) / metresPerPixel))),
  );
}

function buildStaticMapUrl(points) {
  const { apiKey } = getGoogleMapsConfiguration();
  if (!apiKey || !points?.length) return null;
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  const path = [...points, points[0]]
    .map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`)
    .join("|");
  const parameters = new URLSearchParams({
    center: `${lat},${lng}`,
    size: "640x420",
    scale: "2",
    zoom: String(computeStaticMapZoom(points)),
    maptype: "hybrid",
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${parameters}&path=color:0x2563ebff|weight:3|fillcolor:0x2563eb33|${path}`;
}

async function loadStaticMap(points) {
  const url = buildStaticMapUrl(points);
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return dataUrlFromBlob(await response.blob());
  } catch {
    return null;
  }
}

function drawMetadata(pdf, metadata, x, y, width) {
  const rows = [
    ["Plot name", metadata.plotName || "Untitled plot"],
    ["Owner", metadata.owner || "—"],
    ["Address", metadata.address || "—"],
    ["Created", new Date().toLocaleString()],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + (index * 9);
    if (index % 2) {
      pdf.setFillColor(...COLORS.pale);
      pdf.rect(x, rowY, width, 9, "F");
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(label, x + 2, rowY + 5.8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.ink);
    const safeValue = String(value);
    pdf.text(safeValue.length > 52 ? `${safeValue.slice(0, 49)}…` : safeValue, x + 27, rowY + 5.8);
  });
  pdf.setDrawColor(...COLORS.line);
  pdf.rect(x, y, width, rows.length * 9);
}

function drawSummary(pdf, snapshot, x, y, width) {
  const result = snapshot.result;
  const rows = [
    ["Area", `${format(result.areaSqm)} m²  |  ${format(result.areaSqm * 10.7639104167)} ft²`],
    ["Perimeter", `${format(result.perimeterM)} m`],
    ["Method", result.method.replaceAll("_", " ")],
    ["Status", result.exactness === "confirmed" ? "Confirmed from supplied geometry" : "Approximate"],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + (index * 9);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(label, x + 2, rowY + 5.8);
    pdf.setFont("helvetica", index === 0 ? "bold" : "normal");
    pdf.setTextColor(...COLORS.ink);
    pdf.text(String(value), x + 27, rowY + 5.8);
  });
  pdf.setDrawColor(...COLORS.line);
  pdf.rect(x, y, width, rows.length * 9);
}

function addMeasurementPage(pdf, snapshot) {
  pdf.addPage();
  drawHeader(pdf, snapshot.logo);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...COLORS.navy);
  pdf.text("Measurements and boundary details", 14, 34);
  let y = 41;
  pdf.setFillColor(...COLORS.pale);
  pdf.rect(14, y, 182, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("SIDE", 17, y + 5.2);
  pdf.text("LENGTH", 48, y + 5.2);
  pdf.text("BOUNDARY DETAIL", 82, y + 5.2);
  if (snapshot.sourceType === "map") pdf.text("COORDINATES", 130, y + 5.2);
  y += 8;
  const sides = snapshot.result.sideLengthsMeters ?? [];
  sides.forEach((side, index) => {
    if (y > 270) {
      pdf.addPage();
      drawHeader(pdf, snapshot.logo);
      y = 34;
    }
    if (index % 2) {
      pdf.setFillColor(...COLORS.pale);
      pdf.rect(14, y, 182, 8, "F");
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(`Side ${index + 1}`, 17, y + 5.2);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${format(side)} m`, 48, y + 5.2);
    pdf.text(snapshot.boundaries?.[index] || "—", 82, y + 5.2);
    if (snapshot.sourceType === "map" && snapshot.map?.points?.[index]) {
      const point = snapshot.map.points[index];
      pdf.text(`${point.lat.toFixed(7)}, ${point.lng.toFixed(7)}`, 130, y + 5.2);
    }
    y += 8;
  });

  if (snapshot.result.averageElevationM !== null && snapshot.result.averageElevationM !== undefined) {
    y += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.navy);
    pdf.text("Average corner elevation", 14, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.ink);
    pdf.text(`${format(snapshot.result.averageElevationM, 2)} m`, 54, y);
  }

  const hasDiagonals = (snapshot.result.diagonalPairs?.length > 0) || (snapshot.sourceType === "map" && snapshot.map?.diagonalGroups?.length);
  if (hasDiagonals) {
    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLORS.navy);
    pdf.text("Diagonal measurements", 14, y);
    y += 5;

    const lengthFactor = Number(snapshot.inputUnit?.factorToBase) || 0.3048;
    const lengthSymbol = snapshot.inputUnit?.symbol || "ft";

    if (snapshot.result.diagonalPairs?.length) {
      snapshot.result.diagonalPairs.forEach(([from, to], pIdx) => {
        if (y > 270) {
          pdf.addPage();
          drawHeader(pdf, snapshot.logo);
          y = 34;
        }
        const distanceMeters = snapshot.result.diagonalsMeters?.[pIdx];
        const distInUnit = distanceMeters ? (distanceMeters / lengthFactor).toFixed(2) : null;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLORS.ink);
        pdf.text(
          `Diagonal P${from + 1} ⟷ P${to + 1}`,
          17,
          y + 5,
        );
        pdf.text(
          distanceMeters === null || distanceMeters === undefined
            ? "—"
            : `${distInUnit} ${lengthSymbol}  (${format(distanceMeters)} m)`,
          55,
          y + 5,
        );
        y += 8;
      });
    } else if (snapshot.map?.diagonalGroups?.length) {
      snapshot.map.diagonalGroups.forEach((group) => {
        group.connected.forEach((connected) => {
          if (y > 270) {
            pdf.addPage();
            drawHeader(pdf, snapshot.logo);
            y = 34;
          }
          const pairIndex = snapshot.result.diagonalPairs?.findIndex(([from, to]) =>
            (from === group.base && to === connected)
            || (from === connected && to === group.base));
          const distance = pairIndex >= 0 ? snapshot.result.diagonalsMeters?.[pairIndex] : null;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(...COLORS.ink);
          pdf.text(
            `Diagonal P${group.base + 1} ⟷ P${connected + 1}`,
            17,
            y + 5,
          );
          pdf.text(distance === null ? "—" : `${format(distance)} m`, 55, y + 5);
          y += 8;
        });
      });
    }
  }

  if (snapshot.metadata.notes) {
    y += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Notes", 14, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(pdf.splitTextToSize(snapshot.metadata.notes, 180), 14, y + 5);
  }
}

function drawTriangleBreakdownTable(pdf, snapshot, startX, startY, tableWidth) {
  let y = startY;
  const inputUnit = snapshot.inputUnit || { symbol: "ft", factorToBase: "0.3048" };
  const outputUnit = snapshot.outputUnit || { symbol: "ft²", factorToBase: "0.09290304" };
  const lengthSymbol = inputUnit.symbol || "ft";
  const areaSymbol = outputUnit.symbol || "ft²";
  const lengthFactor = Number(inputUnit.factorToBase) || 0.3048;
  const areaFactor = Number(outputUnit.factorToBase) || 0.09290304;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.navy);
  pdf.text("Survey Triangles Breakdown Table", startX, y);
  y += 5;

  const renderTableHeader = (headerY) => {
    pdf.setFillColor(...COLORS.navy);
    pdf.rect(startX, headerY, tableWidth, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(255, 255, 255);

    pdf.text("#", startX + 3, headerY + 5.2);
    pdf.text("TRIANGLE NAME", startX + 10, headerY + 5.2);
    pdf.text(`SIDE 1 (${lengthSymbol})`, startX + 62, headerY + 5.2, { align: "right" });
    pdf.text(`SIDE 2 (${lengthSymbol})`, startX + 85, headerY + 5.2, { align: "right" });
    pdf.text(`SIDE 3 (${lengthSymbol})`, startX + 108, headerY + 5.2, { align: "right" });
    pdf.text(`AREA (${areaSymbol})`, startX + 142, headerY + 5.2, { align: "right" });
    pdf.text("AREA (m²)", startX + 165, headerY + 5.2, { align: "right" });
    pdf.text("% SHARE", startX + 180, headerY + 5.2, { align: "right" });
  };

  renderTableHeader(y);
  y += 8;

  const triangles = snapshot.result?.triangles || [];
  const totalSqm = snapshot.result?.areaSqm || 1;

  triangles.forEach((tri, index) => {
    if (y > 265) {
      pdf.addPage();
      drawHeader(pdf, snapshot.logo);
      y = 34;
      renderTableHeader(y);
      y += 8;
    }

    if (index % 2) {
      pdf.setFillColor(...COLORS.pale);
      pdf.rect(startX, y, tableWidth, 8, "F");
    }

    const rawValues = snapshot.triangles?.[index]?.values || [];
    const side1 = rawValues[0] ? rawValues[0] : format(tri.sidesMeters[0] / lengthFactor, 2);
    const side2 = rawValues[1] ? rawValues[1] : format(tri.sidesMeters[1] / lengthFactor, 2);
    const side3 = rawValues[2] ? rawValues[2] : format(tri.sidesMeters[2] / lengthFactor, 2);

    const areaInUnit = tri.areaSqm / areaFactor;
    const percentShare = totalSqm > 0 ? (tri.areaSqm / totalSqm) * 100 : 0;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.ink);

    pdf.text(String(index + 1), startX + 3, y + 5.2);
    pdf.setFont("helvetica", "normal");

    const triName = tri.name || `Triangle ${index + 1}`;
    const safeName = triName.length > 22 ? `${triName.slice(0, 20)}…` : triName;
    pdf.text(safeName, startX + 10, y + 5.2);

    pdf.text(String(side1), startX + 62, y + 5.2, { align: "right" });
    pdf.text(String(side2), startX + 85, y + 5.2, { align: "right" });
    pdf.text(String(side3), startX + 108, y + 5.2, { align: "right" });

    pdf.setFont("helvetica", "bold");
    pdf.text(format(areaInUnit, 2), startX + 142, y + 5.2, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.text(format(tri.areaSqm, 2), startX + 165, y + 5.2, { align: "right" });
    pdf.text(`${format(percentShare, 1)}%`, startX + 180, y + 5.2, { align: "right" });

    y += 8;
  });

  pdf.setDrawColor(...COLORS.line);
  pdf.rect(startX, startY + 5, tableWidth, y - (startY + 5));

  return y;
}

export async function exportPlotPdf(input) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);
  const snapshot = structuredClone(input);
  snapshot.logo = await loadOriginalLogo();

  const isTrianglesMode = snapshot.calculationMode === "triangles" || snapshot.mode === "triangles";

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(pdf, snapshot.logo);
  drawMetadata(pdf, snapshot.metadata, 14, 30, 182);
  drawSummary(pdf, snapshot, 14, 70, 182);

  const hasTrianglesData = snapshot.result?.triangles?.length > 0;

  if (isTrianglesMode) {
    drawTriangleBreakdownTable(pdf, snapshot, 14, 114, 182);
  } else {
    let nextY = 116;
    if (snapshot.mode === "irregular" && hasTrianglesData) {
      nextY = drawTriangleBreakdownTable(pdf, snapshot, 14, 114, 182) + 8;
    }

    if (nextY > 170) {
      pdf.addPage();
      drawHeader(pdf, snapshot.logo);
      nextY = 34;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...COLORS.navy);
    pdf.text("Plot diagram", 14, nextY);
    drawPlotDiagram(pdf, snapshot, 14, nextY + 4, snapshot.sourceType === "map" ? 112 : 182, 102);

    if (snapshot.result.warning) {
      pdf.setFillColor(255, 247, 237);
      pdf.roundedRect(14, nextY + 110, 182, 18, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.warning);
      pdf.text(pdf.splitTextToSize(snapshot.result.warning, 174), 18, nextY + 116);
    }
    addMeasurementPage(pdf, snapshot);
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    drawFooter(pdf, page, pages);
  }
  pdf.save(`PlotScale-${safeFileName(snapshot.metadata.plotName)}.pdf`);
  return { pages };
}
