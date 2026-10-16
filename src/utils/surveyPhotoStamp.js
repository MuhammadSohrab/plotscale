const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function formatCoordinate(value, positive, negative) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.abs(value).toFixed(6)}° ${value >= 0 ? positive : negative}`;
}

export function formatCaptureTime(date, locale) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value);
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function fitLines(context, text, maxWidth, maximumLines = 2) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  if (lines.length > maximumLines) {
    const visible = lines.slice(0, maximumLines);
    let last = visible[maximumLines - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    visible[maximumLines - 1] = `${last}…`;
    return visible;
  }
  return lines;
}

function drawPositionTile(context, x, y, size, latitude, longitude) {
  context.save();
  roundedRect(context, x, y, size, size, size * 0.08);
  context.clip();
  const gradient = context.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, "#173f35");
  gradient.addColorStop(1, "#315647");
  context.fillStyle = gradient;
  context.fillRect(x, y, size, size);

  const seed = Math.abs(Math.round((latitude ?? 26) * 997 + (longitude ?? 83) * 991));
  context.strokeStyle = "rgba(255,255,255,.22)";
  context.lineWidth = Math.max(1, size * 0.012);
  for (let index = -1; index < 5; index += 1) {
    const shift = (seed % 17) * 0.004 * size;
    context.beginPath();
    context.moveTo(x - size * 0.2, y + index * size * 0.27 + shift);
    context.lineTo(x + size * 1.2, y + (index + 1) * size * 0.22 + shift);
    context.stroke();
  }
  context.strokeStyle = "rgba(242,196,92,.62)";
  context.lineWidth = Math.max(2, size * 0.025);
  context.beginPath();
  context.moveTo(x + size * 0.06, y + size * 0.72);
  context.bezierCurveTo(
    x + size * 0.34,
    y + size * 0.56,
    x + size * 0.64,
    y + size * 0.75,
    x + size * 0.96,
    y + size * 0.38,
  );
  context.stroke();

  const pinX = x + size / 2;
  const pinY = y + size / 2;
  context.fillStyle = "#ef4444";
  context.beginPath();
  context.arc(pinX, pinY - size * 0.06, size * 0.07, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(pinX - size * 0.045, pinY - size * 0.01);
  context.lineTo(pinX, pinY + size * 0.11);
  context.lineTo(pinX + size * 0.045, pinY - size * 0.01);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(pinX, pinY - size * 0.06, size * 0.022, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.strokeStyle = "#facc15";
  context.lineWidth = Math.max(3, size * 0.025);
  roundedRect(context, x, y, size, size, size * 0.08);
  context.stroke();
}

export function drawSurveyStamp(context, width, height, metadata = {}) {
  const scale = clamp(Math.min(width, height) / 760, 0.72, 2.2);
  const margin = 20 * scale;
  const tileSize = clamp(width * 0.19, 116 * scale, 230 * scale);
  const cardHeight = clamp(168 * scale, height * 0.18, 260 * scale);
  const cardX = margin;
  const cardY = height - cardHeight - margin;
  const cardWidth = width - margin * 2;
  const tileX = cardX + cardWidth - tileSize - 12 * scale;
  const tileY = cardY + (cardHeight - tileSize) / 2;

  context.save();
  context.fillStyle = "rgba(8, 15, 26, .78)";
  roundedRect(context, cardX, cardY, cardWidth, cardHeight, 18 * scale);
  context.fill();

  const textX = cardX + 18 * scale;
  const textWidth = Math.max(120, tileX - textX - 16 * scale);
  context.textBaseline = "top";
  context.fillStyle = "#ffffff";
  context.font = `700 ${22 * scale}px Inter, Arial, sans-serif`;
  context.fillText("PlotScale Survey Camera", textX, cardY + 15 * scale);

  context.font = `700 ${28 * scale}px Inter, Arial, sans-serif`;
  const locality = metadata.locality || "GPS-tagged site photo";
  context.fillText(fitLines(context, locality, textWidth, 1)[0] || locality, textX, cardY + 45 * scale);

  context.font = `500 ${16 * scale}px Inter, Arial, sans-serif`;
  const addressLines = fitLines(context, metadata.address || "Location address unavailable", textWidth, 2);
  addressLines.forEach((line, index) => {
    context.fillText(line, textX, cardY + (81 + index * 21) * scale);
  });

  const latitude = Number.isFinite(metadata.latitude)
    ? formatCoordinate(metadata.latitude, "N", "S")
    : "GPS unavailable";
  const longitude = Number.isFinite(metadata.longitude)
    ? formatCoordinate(metadata.longitude, "E", "W")
    : "";
  context.font = `500 ${15 * scale}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  context.fillText(`${latitude}${longitude ? `   ${longitude}` : ""}`, textX, cardY + 128 * scale);

  context.fillStyle = "rgba(255,255,255,.82)";
  context.font = `500 ${14 * scale}px Inter, Arial, sans-serif`;
  const accuracy = Number.isFinite(metadata.accuracyM) ? ` · ±${Math.round(metadata.accuracyM)} m` : "";
  context.fillText(`${formatCaptureTime(metadata.capturedAt ?? new Date())}${accuracy}`, textX, cardY + 151 * scale);

  drawPositionTile(context, tileX, tileY, tileSize, metadata.latitude, metadata.longitude);
  context.restore();
}

export function canvasToJpeg(canvas, quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Photo encoding failed.")),
      "image/jpeg",
      quality,
    );
  });
}
