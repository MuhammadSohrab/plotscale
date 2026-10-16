export const PLOT_MODES = Object.freeze(["manual", "map", "image"]);

export function createSavedPlot(input = {}) {
  const now = new Date().toISOString();
  const mode = input.mode ?? "manual";
  if (!PLOT_MODES.includes(mode)) throw new Error(`Unsupported plot mode: ${mode}`);
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name?.trim() || "Untitled plot",
    mode,
    ownerUserId: input.ownerUserId ?? null,
    createdAt: input.createdAt ?? now,
    modifiedAt: now,
    calculationMode: input.calculationMode ?? (mode === "map" ? "map" : "irregular"),
    inputUnitId: input.inputUnitId ?? "METER",
    outputUnitId: input.outputUnitId ?? "SQM",
    inputSnapshot: input.inputSnapshot ?? null,
    resultSnapshot: input.resultSnapshot ?? null,
    mapState: input.mapState ?? null,
    metadata: input.metadata ?? {},
    schemaVersion: input.schemaVersion ?? 1,
  };
}

export function createMeasurement(plotId, input = {}) {
  if (!plotId) throw new Error("plotId is required.");
  return {
    id: input.id ?? crypto.randomUUID(),
    plotId,
    sideLengthsMeters: input.sideLengthsMeters ?? [],
    diagonalsMeters: input.diagonalsMeters ?? [],
    anglesDegrees: input.anglesDegrees ?? [],
    calculatedAreaSqm: input.calculatedAreaSqm ?? null,
    method: input.method ?? null,
    exactness: input.exactness ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function createBoundary(plotId, input = {}) {
  if (!plotId) throw new Error("plotId is required.");
  return {
    plotId,
    north: input.north ?? "",
    south: input.south ?? "",
    east: input.east ?? "",
    west: input.west ?? "",
    sides: input.sides ?? [],
    updatedAt: new Date().toISOString(),
  };
}

export function createMediaReference(plotId, input = {}) {
  if (!plotId) throw new Error("plotId is required.");
  return {
    id: input.id ?? crypto.randomUUID(),
    plotId,
    kind: input.kind ?? "snapshot",
    mimeType: input.mimeType ?? "application/octet-stream",
    fileName: input.fileName ?? "",
    blob: input.blob ?? null,
    localReference: input.localReference ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createSurveyPhoto(input = {}) {
  if (!(input.blob instanceof Blob)) throw new Error("A photo blob is required.");
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    ownerKey: input.ownerKey ?? "guest",
    fileName: input.fileName ?? `plotscale-survey-${capturedAt.replace(/[:.]/g, "-")}.jpg`,
    mimeType: input.mimeType ?? input.blob.type ?? "image/jpeg",
    blob: input.blob,
    capturedAt,
    facingMode: input.facingMode === "user" ? "user" : "environment",
    latitude: Number.isFinite(input.latitude) ? input.latitude : null,
    longitude: Number.isFinite(input.longitude) ? input.longitude : null,
    accuracyM: Number.isFinite(input.accuracyM) ? input.accuracyM : null,
    altitudeM: Number.isFinite(input.altitudeM) ? input.altitudeM : null,
    address: input.address?.trim() || "",
    locality: input.locality?.trim() || "",
    note: input.note?.trim() || "",
    schemaVersion: 1,
  };
}
