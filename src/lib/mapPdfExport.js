/**
 * Map Mode PDF Export — Exact match of PlotScale Sample PDF
 * Page 1: Header + Full-width Plot Diagram + Info Table (left) + Satellite Map (right) + Footer
 * Page 2: Header + Area Conversions (2 side-by-side tables) + Dimensions/Boundary Table + Footer
 * Page 3+: Header + Diagonal Measurements (per base point, 6-col grid) + Footer
 */
import { fitVerticesToCanvas } from './geometry';
import { formatValue } from './unitConversion';

// ─── A4 dimensions (mm) — strict print layout ───
const W = 210, H = 297;
const MT = 5;            // 0.5cm top margin before header
const HEADER_H = 10;     // 1.0cm header height (fixed)
const FOOTER_H = 25;     // 2.5cm footer height (fixed)
const ML = 15, MR = 10;  // 1.5cm unified left margin, 1cm right
const CONTENT_BOTTOM = H - FOOTER_H;  // 272mm — content area ends

// ─── Fixed component dimensions (from reference spec) ───
const MAP_W = 185;       // 185mm — Main Plot Map width (fills content area)
const MAP_H = 165;       // 165mm — Main Plot Map height (strict)
const DETAILS_W = 105.4; // 10.54cm — Details section width
const GMAP_W = 78.7;     // 7.87cm — Secondary Google Map width
const GMAP_H = 81.5;     // 8.15cm — Secondary Google Map height
const MAP_ML = ML;       // left-aligned to 1.5cm margin
const BOT_ML = ML;       // left-aligned to 1.5cm margin

// ─── Plot diagram visual constants ───
const BOUNDARY_W = 0.6;         // boundary line stroke width (mm)
const MARKER_R = BOUNDARY_W / 2; // marker radius — total diameter matches boundary stroke

// ─── Colors ───
const BLACK  = [0, 0, 0];
const DARK   = [31, 41, 55];
const GREY   = [107, 114, 128];
const LGREY  = [180, 180, 180];
const LIGHT  = [243, 244, 246];
const GREEN  = [34, 197, 94];
const BLUE   = [30, 58, 138];
const WHITE  = [255, 255, 255];
const STRIPE = [248, 249, 250];

// ─── Haversine distance (meters) ───
function haversineMeters(p1, p2) {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computePerimeter(points) {
  let t = 0;
  for (let i = 0; i < points.length; i++) t += haversineMeters(points[i], points[(i+1)%points.length]);
  return t;
}

function computeCentroid(points) {
  return {
    lat: points.reduce((s,p) => s+p.lat, 0) / points.length,
    lng: points.reduce((s,p) => s+p.lng, 0) / points.length,
  };
}

function pointsToMeters(points) {
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs);
  const cosLat = Math.cos(((minLat+maxLat)/2) * Math.PI / 180);
  return points.map(p => ({ x: (p.lng-minLng)*111320*cosLat, y: (maxLat-p.lat)*111320 }));
}

function computeMapZoom(points, sizePx) {
  const lats = points.map(p=>p.lat), lngs = points.map(p=>p.lng);
  const centerLat = (Math.min(...lats)+Math.max(...lats))/2;
  const cosLat = Math.cos(centerLat*Math.PI/180);
  const dLat = (Math.max(...lats)-Math.min(...lats))*111320;
  const dLng = (Math.max(...lngs)-Math.min(...lngs))*111320*cosLat;
  const diag = Math.sqrt(dLat*dLat+dLng*dLng) || 50;
  const mpp = diag / (sizePx * 0.3);
  return Math.max(13, Math.min(20, Math.round(Math.log2(156543.03392*cosLat/mpp))));
}

function buildStaticMapUrl(points, apiKey, sizePx, zoom) {
  const lats = points.map(p=>p.lat), lngs = points.map(p=>p.lng);
  const cLat = ((Math.min(...lats)+Math.max(...lats))/2).toFixed(6);
  const cLng = ((Math.min(...lngs)+Math.max(...lngs))/2).toFixed(6);
  const path = points.map(p=>`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
  const closed = `${path}|${points[0].lat.toFixed(6)},${points[0].lng.toFixed(6)}`;
  const z = zoom || computeMapZoom(points, sizePx);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${cLat},${cLng}&zoom=${z}&size=${sizePx}x${sizePx}&scale=2&maptype=hybrid&path=color:0x22c55eFF|weight:2|fillcolor:0x22c55e30|${closed}&key=${apiKey}`;
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.92));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function loadQRCode(url) {
  return loadImage(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&format=png&margin=2`);
}

function loadLogoDataUrl() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 300;
        c.height = img.naturalHeight || 300;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = '/assets/plotscale_logo_primary.svg';
  });
}

function drawLogo(pdf, x, y, iconSize, logoDataUrl) {
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', x, y, iconSize * 0.9, iconSize * 0.9);
  } else {
    pdf.setFillColor(...GREEN);
    pdf.circle(x + iconSize/2, y + iconSize/2, iconSize/2, 'F');
    pdf.setFillColor(...WHITE);
    pdf.circle(x + iconSize/2, y + iconSize*0.42, iconSize*0.18, 'F');
  }
  const tx = x + iconSize + 2;
  const ty = y + iconSize/2;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(iconSize * 1.6);
  pdf.setTextColor(...BLUE);
  pdf.text('Plot', tx, ty, { baseline: 'middle' });
  const pw = pdf.getTextWidth('Plot');
  pdf.setTextColor(...GREEN);
  pdf.text('Scale', tx + pw, ty, { baseline: 'middle' });
}

function drawHeader(pdf, logoDataUrl) {
  const hY = MT;
  drawLogo(pdf, ML, hY + 1, 7, logoDataUrl);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...DARK);
  pdf.text('LAND MEASUREMENT REPORT', W - MR, hY + HEADER_H / 2, { align: 'right', baseline: 'middle' });
  const lineY = hY + HEADER_H;
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.5);
  pdf.line(ML, lineY, W - MR, lineY);
  return lineY;
}

async function drawFooter(pdf, pageNum, totalPages, qrDataUrl, logoDataUrl) {
  const fY = H - FOOTER_H;
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.5);
  pdf.line(ML, fY, W - MR, fY);

  drawLogo(pdf, ML, fY + 2.5, 6, logoDataUrl);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5);
  pdf.setTextColor(...GREY);
  pdf.text('Smart Land Measurement & Mapping', ML, fY + 11.5, { baseline: 'middle' });

  const midX = 65;
  pdf.setDrawColor(...GREY);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(midX, fY + 2.5, 5.5, 11, 0.8, 0.8, 'S');
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.5);
  pdf.line(midX + 2.75, fY + 9, midX + 2.75, fY + 11.5);
  pdf.line(midX + 1.5, fY + 10.5, midX + 2.75, fY + 11.5);
  pdf.line(midX + 4, fY + 10.5, midX + 2.75, fY + 11.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...DARK);
  pdf.text('Scan to Download ', midX + 7, fY + 5, { baseline: 'middle' });
  pdf.setTextColor(...BLUE);
  const sdw = pdf.getTextWidth('Scan to Download ');
  pdf.text('PlotScale', midX + 7 + sdw, fY + 5, { baseline: 'middle' });
  const psw = pdf.getTextWidth('PlotScale');
  pdf.setTextColor(...GREEN);
  pdf.text(' App', midX + 7 + sdw + psw, fY + 5, { baseline: 'middle' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.setTextColor(...GREY);
  pdf.text('Measure. Map. Convert. Anytime. Anywhere.', midX + 7, fY + 9, { baseline: 'middle' });

  pdf.setFontSize(5);
  pdf.setTextColor(...GREEN);
  pdf.text('🌐 www.plotscale.app', midX + 7, fY + 13, { baseline: 'middle' });
  pdf.setTextColor(...GREY);
  pdf.text(' | ', midX + 7 + pdf.getTextWidth('🌐 www.plotscale.app'), fY + 13, { baseline: 'middle' });
  pdf.setTextColor(...GREY);
  pdf.text('✉ support@plotscale.app', midX + 7 + pdf.getTextWidth('🌐 www.plotscale.app | '), fY + 13, { baseline: 'middle' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...GREY);
  pdf.text(`Page ${pageNum} of ${totalPages}`, W/2, fY + 18, { align: 'center', baseline: 'middle' });

  const stX = 138;
  pdf.setFillColor(0, 0, 0);
  pdf.roundedRect(stX, fY + 2.5, 21, 8, 1, 1, 'F');
  pdf.setFillColor(...GREEN);
  pdf.triangle(stX+1.5, fY+4, stX+1.5, fY+8, stX+4, fY+6, 'F');
  pdf.setTextColor(...WHITE);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(3.5);
  pdf.text('GET IT ON', stX + 5.5, fY + 4.5, { baseline: 'middle' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5);
  pdf.text('Google Play', stX + 5.5, fY + 7.5, { baseline: 'middle' });

  pdf.setFillColor(0, 0, 0);
  pdf.roundedRect(stX + 23, fY + 2.5, 21, 8, 1, 1, 'F');
  pdf.setFillColor(...WHITE);
  pdf.circle(stX + 26, fY + 6, 2, 'F');
  pdf.setTextColor(...WHITE);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(3.5);
  pdf.text('Download on the', stX + 29, fY + 4.5, { baseline: 'middle' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5);
  pdf.text('App Store', stX + 29, fY + 7.5, { baseline: 'middle' });

  const qrX = W - MR - 14, qrY = fY + 1.5;
  if (qrDataUrl) {
    pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, 13, 13);
  } else {
    pdf.setFillColor(...LIGHT);
    pdf.rect(qrX, qrY, 13, 13, 'F');
  }
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.3);
  pdf.rect(qrX - 0.5, qrY - 0.5, 14, 14, 'S');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(4.5);
  pdf.setTextColor(...DARK);
  pdf.text('Scan QR to', qrX + 6.5, qrY + 14, { align: 'center', baseline: 'top' });
  pdf.setTextColor(...GREEN);
  pdf.text('Download App', qrX + 6.5, qrY + 16.5, { align: 'center', baseline: 'top' });
}

function drawCompass(pdf, cx, cy) {
  const r = 4.5;
  pdf.setFillColor(...WHITE);
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.3);
  pdf.circle(cx, cy, r, 'FD');
  pdf.setFillColor(...DARK);
  pdf.triangle(cx, cy - r + 0.5, cx - 1.3, cy, cx + 1.3, cy, 'F');
  pdf.setFillColor(...LGREY);
  pdf.triangle(cx, cy + r - 0.5, cx - 1.3, cy, cx + 1.3, cy, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5);
  pdf.setTextColor(...DARK);
  pdf.text('N', cx, cy - r - 1, { align: 'center', baseline: 'bottom' });
}

function drawPlotDiagram(pdf, bx, by, bw, bh, points, sideLabels, diagGroups, lengthFactor, showDiagonalsInDrawing, visibleDiagonals) {
  if (!points || points.length < 2) return;

  const meters = pointsToMeters(points);
  const vs = fitVerticesToCanvas(meters, bw, bh, 12);
  const n = vs.length;
  const vsPdf = vs.map(v => ({ x: bx + v.x, y: by + v.y }));
  const cx = vsPdf.reduce((s, v) => s + v.x, 0) / n;
  const cy = vsPdf.reduce((s, v) => s + v.y, 0) / n;

  const pathLines = [];
  for (let i = 1; i < n; i++) pathLines.push([vsPdf[i].x - vsPdf[i - 1].x, vsPdf[i].y - vsPdf[i - 1].y]);

  const allDiags = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      allDiags.push({ from: i, to: j });
    }
  }
  let diagsToDraw = [];
  if (showDiagonalsInDrawing !== false) {
    if (visibleDiagonals && visibleDiagonals.length > 0) {
      diagsToDraw = visibleDiagonals.map(idx => allDiags[idx]).filter(Boolean);
    } else if (diagGroups && diagGroups.length > 0) {
      const diagSet = new Set();
      diagGroups.forEach(g => {
        g.connected.forEach(c => {
          allDiags.forEach((d, idx) => {
            if ((d.from === g.base && d.to === c) || (d.from === c && d.to === g.base)) diagSet.add(idx);
          });
        });
      });
      diagsToDraw = allDiags.filter((_, idx) => diagSet.has(idx));
    } else {
      diagsToDraw = allDiags;
    }
  }

  // 1. Draw precision corner markers in BACKGROUND
  vsPdf.forEach((node) => {
    // Soft light green corner target circle
    pdf.setFillColor(187, 247, 208);
    pdf.circle(node.x, node.y, 2.4, 'F');
    pdf.setDrawColor(34, 197, 94);
    pdf.setLineWidth(0.2);
    pdf.circle(node.x, node.y, 2.4, 'D');

    // Red precision crosshair (+)
    pdf.setDrawColor(239, 68, 68);
    pdf.setLineWidth(0.35);
    pdf.line(node.x - 3.2, node.y, node.x + 3.2, node.y);
    pdf.line(node.x, node.y - 3.2, node.x, node.y + 3.2);

    // Red center point dot
    pdf.setFillColor(220, 38, 38);
    pdf.circle(node.x, node.y, 0.45, 'F');
  });

  // 2. Draw dotted diagonals
  if (diagsToDraw.length > 0) {
    pdf.setLineDashPattern([1.8, 1.2], 0);
    pdf.setDrawColor(75, 85, 99);
    pdf.setLineWidth(0.65);
    diagsToDraw.forEach(d => {
      pdf.line(vsPdf[d.from].x, vsPdf[d.from].y, vsPdf[d.to].x, vsPdf[d.to].y);
    });
    pdf.setLineDashPattern([], 0);

    // 2b. Diagonal length labels with white knockout mask
    diagsToDraw.forEach(d => {
      const p1 = vsPdf[d.from], p2 = vsPdf[d.to];
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const distM = haversineMeters(points[d.from], points[d.to]);
      const lbl = `${formatValue(distM / (lengthFactor || 0.3048), 2)} ${lengthUnitSymbol || 'ft'}`;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.2);
      const textWidth = pdf.getTextWidth(lbl) + 2;

      pdf.setFillColor(255, 255, 255);
      pdf.rect(mx - (textWidth / 2) - 0.8, my - 2.2, textWidth + 1.6, 4.4, 'F');

      pdf.setTextColor(30, 58, 138);
      pdf.text(lbl, mx, my + 1.0, { align: 'center' });
    });
  }

  // 3. Draw Solid Black Outer Boundaries ON TOP (NO fill color)
  pdf.setDrawColor(...BLACK);
  pdf.setLineWidth(0.9);
  pdf.lines(pathLines, vsPdf[0].x, vsPdf[0].y, [1, 1], 'S', true);

  // 4. Side Lengths with clean white knockout mask
  vsPdf.forEach((node, i) => {
    const next = vsPdf[(i + 1) % n];
    const mx = (node.x + next.x) / 2, my = (node.y + next.y) / 2;
    const lbl = sideLabels?.[i] || '';
    if (!lbl) return;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    const sideTextWidth = pdf.getTextWidth(lbl) + 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(mx - (sideTextWidth / 2) - 0.8, my - 2.4, sideTextWidth + 1.6, 4.8, 'F');

    pdf.setTextColor(0, 0, 0);
    pdf.text(lbl, mx, my + 1.0, { align: 'center' });
  });

  // 5. Corner Labels P1, P2... (offset outward so precision crosshair is 100% visible)
  vsPdf.forEach((node, i) => {
    const ndx = node.x - cx, ndy = node.y - cy;
    const ndlen = Math.hypot(ndx, ndy) || 1;
    const offsetX = (ndx / ndlen) * 6.0;
    const offsetY = (ndy / ndlen) * 6.0;

    const cornerLabel = `P${i + 1}`;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text(cornerLabel, node.x + offsetX, node.y + offsetY + 1.5, { align: 'center' });
  });

  drawCompass(pdf, bx + bw - 9, by + bh - 9);
}

function drawInfoTable(pdf, x, y, w, h, plotInfo, areaSqm, perimM) {
  const labelW = w * 0.30;
  const areaSqft = areaSqm * 10.7639;
  const perimFt = perimM * 3.28084;
  const centroid = plotInfo.centroid;

  const rows = [
    { label: 'Plot Title',    value: plotInfo.plotName || '—', bold: true },
    { label: 'Address',       value: plotInfo.address || '—' },
    { label: 'Owner',        value: plotInfo.owner || '—' },
    { label: 'Plot Area',     value: `${formatValue(areaSqm, 2)}m² [${formatValue(areaSqft, 2)}ft²]`, bold: true },
    { label: 'Perimeter',     value: `${formatValue(perimM, 2)}m [${formatValue(perimFt, 2)}ft]`, bold: true },
    { label: 'Geo-Location',  value: centroid ? `${centroid.lat.toFixed(5)},${centroid.lng.toFixed(5)}` : '—', italic: true },
    { label: 'Elevation',     value: plotInfo.elevation ? `${Number(plotInfo.elevation).toFixed(2)} m [${(plotInfo.elevation * 3.28084).toFixed(2)} ft] average` : '—', italic: true },
    { label: 'Create Date',   value: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g, '/') },
  ];

  const rowH = 7;
  const rowsTotal = rows.length * rowH;
  const remarkBottom = y + h;

  let cy = y;

  rows.forEach((row, idx) => {
    if (idx % 2 === 1) {
      pdf.setFillColor(...STRIPE);
      pdf.rect(x, cy, w, rowH, 'F');
    }

    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.15);
    pdf.line(x + labelW, cy, x + labelW, cy + rowH);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);
    pdf.text(row.label, x + 2, cy + rowH / 2, { baseline: 'middle' });

    if (row.italic) pdf.setFont('helvetica', 'italic');
    else pdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
    pdf.setTextColor(...DARK);

    const maxValW = w - labelW - 3;
    let valStr = row.value;
    let fs = 8.5;
    while (fs >= 5) {
      pdf.setFontSize(fs);
      if (pdf.getTextWidth(valStr) <= maxValW) break;
      fs -= 0.5;
    }
    if (pdf.getTextWidth(valStr) > maxValW) {
      while (valStr.length > 1 && pdf.getTextWidth(valStr + '…') > maxValW) {
        valStr = valStr.slice(0, -1);
      }
      valStr = valStr + '…';
    }
    pdf.text(valStr, x + labelW + 2, cy + rowH / 2, { baseline: 'middle' });

    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.1);
    pdf.line(x, cy + rowH, x + w, cy + rowH);

    cy += rowH;
  });

  const remarkTop = cy;
  const contentTop = remarkTop + 3;

  if (plotInfo.notes) {
    const maxW = w - 4;
    const maxH = remarkBottom - contentTop - 2;
    let fs = 7.5;
    let lines = [];
    while (fs >= 4) {
      pdf.setFontSize(fs);
      lines = pdf.splitTextToSize(plotInfo.notes, maxW);
      if (lines.length * (fs * 0.38) <= maxH) break;
      fs -= 0.5;
    }
    const label = 'Remark: ';
    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(fs);
    pdf.setTextColor(...DARK);
    const labelW_px = pdf.getTextWidth(label);
    const valW = maxW - labelW_px;

    const noteLines = pdf.splitTextToSize(plotInfo.notes, valW);
    pdf.text(label, x + 2, contentTop + fs * 0.3);
    pdf.setFont('helvetica', 'italic');
    pdf.text(noteLines[0] || '', x + 2 + labelW_px, contentTop + fs * 0.3);
    for (let li = 1; li < noteLines.length; li++) {
      pdf.text(noteLines[li], x + 2, contentTop + fs * 0.3 + li * (fs * 0.38));
    }
  } else {
    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text('Remark: ', x + 2, contentTop + 3);
  }

  pdf.setDrawColor(...LGREY);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y, w, h, 'S');
  pdf.setLineWidth(0.15);
  pdf.line(x, remarkTop, x + w, remarkTop);
}

function drawAreaConversions(pdf, x, y, w, areaSqm, regionalConversions) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  pdf.text('AREA CONVERSIONS', x, y + 4, { baseline: 'middle' });
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.4);
  pdf.line(x, y + 5.5, x + 55, y + 5.5);
  y += 9;

  const gap = 5;
  const colW = (w - gap) / 2;
  const rowH = 5;
  const hdrH = 6;

  const stdUnits = [
    { label: 'Hectare',      symbol: 'ha',  val: areaSqm / 10000 },
    { label: 'Acre',         symbol: 'ac',  val: areaSqm / 4046.856 },
    { label: 'Are',          symbol: 'a',   val: areaSqm / 100 },
    { label: 'Square Meter', symbol: 'm²',  val: areaSqm },
    { label: 'Square Yard',  symbol: 'yd²', val: areaSqm / 0.836127 },
    { label: 'Square Foot',  symbol: 'ft²', val: areaSqm * 10.7639 },
    { label: 'Hectare',      symbol: 'ha',  val: areaSqm / 10000 },
  ];

  const localUnits = (regionalConversions || []).map(r => ({ label: r.unit_name, symbol: r.unit_symbol || '', val: r.value }));

  function drawTable(cx, tableY, title, units) {
    pdf.setFillColor(225, 225, 225);
    pdf.rect(cx, tableY, colW, hdrH, 'F');
    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.2);
    pdf.rect(cx, tableY, colW, hdrH, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);
    pdf.text(title, cx + 2, tableY + hdrH/2, { baseline: 'middle' });
    tableY += hdrH;

    const subH = 5;
    pdf.setFillColor(200, 220, 200);
    pdf.rect(cx, tableY, colW, subH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text('Unit', cx + 2, tableY + subH/2, { baseline: 'middle' });
    pdf.text('Value', cx + colW - 2, tableY + subH/2, { align: 'right', baseline: 'middle' });
    pdf.setDrawColor(...LGREY);
    pdf.rect(cx, tableY, colW, subH, 'S');
    tableY += subH;

    units.forEach((u, i) => {
      if (i % 2 === 1) {
        pdf.setFillColor(...STRIPE);
        pdf.rect(cx, tableY, colW, rowH, 'F');
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...DARK);
      pdf.text(u.label, cx + 2, tableY + rowH/2, { baseline: 'middle' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      const valStr = `${formatValue(u.val, 6)} ${u.symbol}`;
      pdf.text(valStr, cx + colW - 2, tableY + rowH/2, { align: 'right', baseline: 'middle' });
      pdf.setDrawColor(...LGREY);
      pdf.setLineWidth(0.1);
      pdf.line(cx, tableY + rowH, cx + colW, tableY + rowH);
      tableY += rowH;
    });

    const totalH = hdrH + subH + units.length * rowH;
    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.25);
    pdf.rect(cx, tableY - units.length*rowH - subH - hdrH, colW, totalH, 'S');

    return tableY;
  }

  const leftEnd = drawTable(x, y, "Standard units' conversion", stdUnits);
  const rightEnd = drawTable(x + colW + gap, y, "Local units' conversion", localUnits.length ? localUnits : []);

  return Math.max(leftEnd, rightEnd) + 5;
}

function drawDimensionsTable(pdf, x, startY, w, points, sideLabels, boundaryNames, lengthUnitSymbol, lengthFactor, showCoords) {
  const rowH = 5.5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  pdf.text('Plot Dimensions/Boundary', x, startY + 4, { baseline: 'middle' });
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.4);
  pdf.line(x, startY + 5.5, x + 72, startY + 5.5);
  let y = startY + 9;

  const fromW = 16, lenW = showCoords ? 22 : 28;
  const coordW = showCoords ? 50 : 0;
  const boundW = w - fromW - lenW - coordW;

  function drawHdr(yy) {
    pdf.setFillColor(200, 220, 200);
    pdf.rect(x, yy, w, rowH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...DARK);
    pdf.text('From–To', x + 2, yy + rowH/2, { baseline: 'middle' });
    pdf.text(`Length (${lengthUnitSymbol||'ft'})`, x + fromW + 2, yy + rowH/2, { baseline: 'middle' });
    if (showCoords) pdf.text('Coordinates (Lat, Lng)', x + fromW + lenW + 2, yy + rowH/2, { baseline: 'middle' });
    pdf.text('Boundary', x + fromW + lenW + coordW + 2, yy + rowH/2, { baseline: 'middle' });
    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.2);
    pdf.rect(x, yy, w, rowH, 'S');
    return yy + rowH;
  }

  y = drawHdr(y);

  for (let i = 0; i < points.length; i++) {
    if (y + rowH > CONTENT_BOTTOM) {
      pdf.addPage();
      y = drawHeader(pdf);
      y += 2;
      y = drawHdr(y);
    }

    if (i % 2 === 1) {
      pdf.setFillColor(...STRIPE);
      pdf.rect(x, y, w, rowH, 'F');
    }

    const p = points[i];
    const distM = haversineMeters(p, points[(i+1) % points.length]);
    const distDisp = formatValue(distM / lengthFactor, 2);
    const lbl = sideLabels?.[i] || `${distDisp} ${lengthUnitSymbol}`;
    const boundary = boundaryNames?.[i] || '';

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);
    pdf.text(`P${i+1}-P${(i+1)%points.length+1}`, x + 2, y + rowH/2, { baseline: 'middle' });

    pdf.setFont('courier', 'bold');
    pdf.setFontSize(8);
    const lenStr = lbl.includes(' ') ? lbl : `${lbl} ${lengthUnitSymbol}`;
    pdf.text(lenStr, x + fromW + lenW - 1, y + rowH/2, { align: 'right', baseline: 'middle' });

    if (showCoords) {
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7);
      pdf.text(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`, x + fromW + lenW + 2, y + rowH/2, { baseline: 'middle' });
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);
    pdf.text(boundary, x + fromW + lenW + coordW + 2, y + rowH/2, { baseline: 'middle' });

    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.1);
    pdf.line(x, y + rowH, x + w, y + rowH);

    y += rowH;
  }

  pdf.setDrawColor(...LGREY);
  pdf.setLineWidth(0.25);
  pdf.rect(x, startY + 9, w, y - (startY + 9), 'S');

  return y;
}

function drawDiagonalPages(pdf, points, lengthUnitSymbol, lengthFactor, startY) {
  const n = points.length;
  if (n < 4) return startY;

  const colCount = 6;
  const cW = (W - ML - MR) / colCount;
  const hdrH = 5.5;
  const cellH = 5;
  const groupGap = 3;

  let y = startY + 4;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...DARK);
  pdf.text('Plot Diagonal Measurements', ML, y + 4, { baseline: 'middle' });
  pdf.setDrawColor(...DARK);
  pdf.setLineWidth(0.4);
  pdf.line(ML, y + 5.5, ML + 78, y + 5.5);
  y += 10;

  for (let base = 0; base < n - 2; base++) {
    const diags = [];
    for (let j = 0; j < n; j++) {
      if (j === base) continue;
      if (j === (base - 1 + n) % n) continue;
      if (j === (base + 1) % n) continue;
      const distM = haversineMeters(points[base], points[j]);
      diags.push({ to: j, val: distM / lengthFactor });
    }
    diags.sort((a, b) => a.to - b.to);
    if (diags.length === 0) continue;

    if (y + hdrH + cellH + groupGap > CONTENT_BOTTOM) {
      pdf.addPage();
      y = drawHeader(pdf);
      y += 2;
    }

    pdf.setFillColor(225, 225, 225);
    pdf.rect(ML, y, W - ML - MR, hdrH, 'F');
    pdf.setDrawColor(...LGREY);
    pdf.setLineWidth(0.2);
    pdf.rect(ML, y, W - ML - MR, hdrH, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);
    pdf.text(`P${base+1} -> Base Point`, ML + 2, y + hdrH/2, { baseline: 'middle' });
    y += hdrH;

    let col = 0;
    for (let di = 0; di < diags.length; di++) {
      const d = diags[di];
      const cx = ML + col * cW;

      const rowIdx = Math.floor(di / colCount);
      if (rowIdx % 2 === 1) {
        pdf.setFillColor(...STRIPE);
        pdf.rect(cx, y, cW, cellH, 'F');
      }

      const cellText = `(P${base+1}-P${d.to+1}) ${formatValue(d.val, 2)} ${lengthUnitSymbol}`;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...DARK);
      let diagFs = 5.5;
      while (diagFs >= 4) {
        pdf.setFontSize(diagFs);
        if (pdf.getTextWidth(cellText) <= cW - 2) break;
        diagFs -= 0.5;
      }
      pdf.text(cellText, cx + 1, y + cellH/2, { baseline: 'middle' });

      pdf.setDrawColor(...LGREY);
      pdf.setLineWidth(0.1);
      pdf.rect(cx, y, cW, cellH, 'S');

      col++;
      if (col >= colCount) {
        col = 0;
        y += cellH;
        if (y + cellH > CONTENT_BOTTOM) {
          pdf.addPage();
          y = drawHeader(pdf);
          y += 2;
        }
      }
    }
    if (col > 0) y += cellH;
    y += groupGap;
  }

  return y;
}

export async function exportMapModePDF({
  points, areaSqm, sideLabels, lengthUnitSymbol, lengthFactor = 0.3048,
  plotName, mapApiKey, regionalConversions = [],
  areaOutputUnit, config = {},
}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const cfg = {
    plotName:       config.plotName || plotName || '',
    address:        config.address || '',
    owner:          config.owner || '',
    notes:          config.notes || '',
    elevation:      config.elevation || null,
    boundaryNames:  config.boundaryNames || [],
    showCoordinates:    config.showCoordinates !== false,
    showDiagonalsTable: config.showDiagonalsTable !== false,
    showAreaConversions: config.showAreaConversions !== false,
    diagGroups:          config.diagGroups || [],
    showDiagonalsInDrawing: config.showDiagonalsInDrawing !== false,
    visibleDiagonals:     config.visibleDiagonals || [],
  };

  const centroid = computeCentroid(points);
  const perimM = computePerimeter(points);

  const geoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${centroid.lat.toFixed(6)},${centroid.lng.toFixed(6)}`)}&format=png&margin=2`;
  const [qrDataUrl, satelliteMapUrl, geoQrDataUrl, logoDataUrl] = await Promise.all([
    loadQRCode('https://plotscale.app/download'),
    mapApiKey
      ? loadImage(buildStaticMapUrl(points, mapApiKey, 640, computeMapZoom(points, 640)))
      : Promise.resolve(null),
    loadImage(geoQrUrl),
    loadLogoDataUrl(),
  ]);

  let y = drawHeader(pdf, logoDataUrl);
  y += 1;

  drawPlotDiagram(pdf, MAP_ML, y, MAP_W, MAP_H, points, sideLabels, cfg.diagGroups, lengthFactor, cfg.showDiagonalsInDrawing, cfg.visibleDiagonals);
  y += MAP_H + 3;

  const bottomY = y;
  const detailsX = BOT_ML;
  const gmapX = BOT_ML + DETAILS_W + 1;
  const gmapH = GMAP_H;

  drawInfoTable(pdf, detailsX, bottomY, DETAILS_W, gmapH, {
    plotName: cfg.plotName,
    address:  cfg.address,
    owner:    cfg.owner,
    notes:    cfg.notes,
    elevation: cfg.elevation,
    centroid,
  }, areaSqm, perimM);

  pdf.setDrawColor(...LGREY);
  pdf.setLineWidth(0.25);
  pdf.rect(gmapX, bottomY, GMAP_W, gmapH, 'S');
  if (satelliteMapUrl) {
    pdf.addImage(satelliteMapUrl, 'JPEG', gmapX + 0.5, bottomY + 0.5, GMAP_W - 1, gmapH - 1);
  } else {
    pdf.setFillColor(...LIGHT);
    pdf.rect(gmapX + 0.5, bottomY + 0.5, GMAP_W - 1, gmapH - 1, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(...GREY);
    pdf.text('Map unavailable', gmapX + GMAP_W / 2, bottomY + gmapH / 2, { align: 'center', baseline: 'middle' });
  }

  if (geoQrDataUrl) {
    const qrSize = 14;
    const qrX = gmapX + GMAP_W - qrSize - 2;
    const qrY = bottomY + gmapH - qrSize - 2;
    pdf.setFillColor(...WHITE);
    pdf.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'F');
    pdf.addImage(geoQrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    pdf.setDrawColor(...GREEN);
    pdf.setLineWidth(0.2);
    pdf.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(3);
    pdf.setTextColor(...DARK);
    pdf.text('Scan to Navigate', qrX + qrSize / 2, qrY - 1.5, { align: 'center', baseline: 'bottom' });
  }

  pdf.addPage();
  y = drawHeader(pdf, logoDataUrl);
  y += 2;

  if (cfg.showAreaConversions) {
    y = drawAreaConversions(pdf, ML, y, W - ML - MR, areaSqm, regionalConversions);
  }

  if (cfg.showDiagonalsTable) {
    if (y + 25 > CONTENT_BOTTOM) {
      pdf.addPage();
      y = drawHeader(pdf, logoDataUrl);
      y += 2;
    }
    y = drawDimensionsTable(
      pdf, ML, y, W - ML - MR,
      points, sideLabels, cfg.boundaryNames,
      lengthUnitSymbol, lengthFactor, cfg.showCoordinates
    );
  }

  if (points.length >= 4) {
    drawDiagonalPages(pdf, points, lengthUnitSymbol, lengthFactor, y);
  }

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    await drawFooter(pdf, p, totalPages, qrDataUrl, logoDataUrl);
  }

  const safeName = (cfg.plotName || 'MapPlot').replace(/[^a-zA-Z0-9_\- ]/g,'').trim() || 'MapPlot';
  pdf.save(`PlotScale-${safeName}.pdf`);
}
