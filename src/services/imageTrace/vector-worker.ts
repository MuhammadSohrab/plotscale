/// <reference lib="webworker" />

import {
  prepareVectorRaster,
  vectorizePreparedRaster,
  vectorizePreparedLineSeed,
  vectorizePreparedSeed,
  type PixelBuffer,
  type PreparedVectorRaster,
  type VectorBox,
  type VectorPoint,
} from "./vector-engine";
import { BoundedCache } from "./worker-cache";

type SetRasterMessage = {
  type: "set-raster";
  revision: number;
  width: number;
  height: number;
  data: ArrayBuffer;
};

type ClearRasterMessage = {
  type: "clear-raster";
  revision: number;
};

type VectorizeAllMessage = {
  type: "vectorize-all";
  requestId: number;
  revision: number;
  maxShapes: number;
};

type VectorizeRoiMessage = {
  type: "vectorize-roi";
  requestId: number;
  revision: number;
  roi: VectorBox;
  maxShapes: number;
};

type VectorizeSeedMessage = {
  type: "vectorize-seed";
  requestId: number;
  revision: number;
  point: VectorPoint;
  roi?: VectorBox;
  searchRadius: number;
};

type VectorizeLineSeedMessage = {
  type: "vectorize-line-seed";
  requestId: number;
  revision: number;
  point: VectorPoint;
  roi?: VectorBox;
  searchRadius: number;
};

type WorkerMessage =
  | SetRasterMessage
  | ClearRasterMessage
  | VectorizeAllMessage
  | VectorizeRoiMessage
  | VectorizeSeedMessage
  | VectorizeLineSeedMessage;

let activeRevision = -1;
let raster: PixelBuffer | null = null;
const preparedCache = new BoundedCache<PreparedVectorRaster>(3);

function cacheKey(roi?: VectorBox) {
  if (!roi) return "full";
  return `${Math.floor(roi.x)}:${Math.floor(roi.y)}:${Math.ceil(roi.width)}:${Math.ceil(roi.height)}`;
}

function preparedFor(roi?: VectorBox) {
  if (!raster) return null;
  const key = cacheKey(roi);
  const cached = preparedCache.get(key);
  if (cached) return cached;
  const prepared = prepareVectorRaster(raster, { roi });
  preparedCache.set(key, prepared);
  return prepared;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === "set-raster") {
    activeRevision = message.revision;
    raster = {
      data: new Uint8ClampedArray(message.data),
      width: message.width,
      height: message.height,
    };
    preparedCache.clear();
    self.postMessage({ type: "raster-ready", revision: activeRevision });
    return;
  }

  if (message.type === "clear-raster") {
    activeRevision = message.revision;
    raster = null;
    preparedCache.clear();
    self.postMessage({ type: "raster-cleared", revision: activeRevision });
    return;
  }

  if (!raster || message.revision !== activeRevision) {
    self.postMessage({
      type: "result",
      requestId: message.requestId,
      revision: message.revision,
      result: { ok: false, reason: "cancelled" },
    });
    return;
  }

  try {
    const prepared = preparedFor("roi" in message ? message.roi : undefined);
    if (!prepared) throw new Error("No active raster");
    let result;
    if (message.type === "vectorize-seed") {
      result = vectorizePreparedSeed(prepared, message.point, message.searchRadius);
    } else if (message.type === "vectorize-line-seed") {
      result = vectorizePreparedLineSeed(prepared, message.point, message.searchRadius);
    } else if (message.type === "vectorize-all" || message.type === "vectorize-roi") {
      result = vectorizePreparedRaster(prepared, { maxShapes: message.maxShapes });
    } else {
      result = { ok: false, reason: "cancelled" } as const;
    }
    self.postMessage({
      type: "result",
      requestId: message.requestId,
      revision: message.revision,
      result,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: message.requestId,
      revision: message.revision,
      message: error instanceof Error ? error.message : "Vector worker failed",
    });
  }
};

export {};
