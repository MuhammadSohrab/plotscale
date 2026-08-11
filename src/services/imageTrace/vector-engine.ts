export type VectorPoint = { x: number; y: number };
export type VectorBox = { x: number; y: number; width: number; height: number };

export type DetectedPath = {
  points: VectorPoint[];
  closed: boolean;
  pixelArea: number;
  confidence: number;
  centerlineAdjusted?: boolean;
  centerlineFitBefore?: number;
  centerlineFitAfter?: number;
};

export type VectorizationOptions = {
  roi?: VectorBox;
  maxShapes?: number;
  minimumAreaRatio?: number;
};

export type PixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type VectorizationDiagnostics = {
  detectedCount: number;
  rejectedCount: number;
  candidateCount: number;
  capHit: boolean;
  estimatedStrokeWidth: number;
};

export type VectorizationResult = {
  paths: DetectedPath[];
  diagnostics: VectorizationDiagnostics;
};

export type SeedFailure =
  | "outside"
  | "ink_no_interior"
  | "open_boundary"
  | "too_small"
  | "cancelled";

export type SeedVectorizationResult =
  | { ok: true; path: DetectedPath; seed: VectorPoint }
  | { ok: false; reason: SeedFailure };

export type LineSeedFailure = "no_ink" | "too_short" | "ambiguous_junction" | "cancelled";
export type LineSeedVectorizationResult =
  | { ok: true; path: DetectedPath; seed: VectorPoint }
  | { ok: false; reason: LineSeedFailure };

export type PreparedVectorRaster = {
  buffer: PixelBuffer;
  roi: Required<VectorBox>;
  width: number;
  height: number;
  padding: number;
  original: Uint8Array;
  wall: Uint8Array;
  lineInk: Uint8Array;
  surveyFill: Uint8Array;
  strongColour: Uint8Array;
  minimumArea: number;
  estimatedStrokeWidth: number;
};

type Region = {
  pixels: number[];
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Marker = VectorPoint & { area: number };

const NEIGHBORS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const NEIGHBORS_8 = [
  ...NEIGHBORS_4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function maskWithPadding(mask: Uint8Array, width: number, height: number, padding: number) {
  const paddedWidth = width + padding * 2;
  const paddedHeight = height + padding * 2;
  const padded = new Uint8Array(paddedWidth * paddedHeight);
  for (let y = 0; y < height; y += 1) {
    padded.set(mask.subarray(y * width, (y + 1) * width), (y + padding) * paddedWidth + padding);
  }
  return { mask: padded, width: paddedWidth, height: paddedHeight };
}

function closeMask(mask: Uint8Array, width: number, height: number, radius: number) {
  const dilated = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const nextX = x + ox;
          const nextY = y + oy;
          if (
            ox * ox + oy * oy <= radius * radius &&
            nextX >= 0 && nextY >= 0 && nextX < width && nextY < height
          ) dilated[nextY * width + nextX] = 1;
        }
      }
    }
  }
  const closed = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let retained = true;
      for (let oy = -radius; oy <= radius && retained; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (ox * ox + oy * oy > radius * radius) continue;
          const nextX = x + ox;
          const nextY = y + oy;
          if (
            nextX < 0 || nextY < 0 || nextX >= width || nextY >= height ||
            !dilated[nextY * width + nextX]
          ) {
            retained = false;
            break;
          }
        }
      }
      if (retained) closed[y * width + x] = 1;
    }
  }
  return closed;
}

function pointSegmentDistance(point: VectorPoint, a: VectorPoint, b: VectorPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  if (!denominator) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator, 0, 1);
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function polygonArea(points: VectorPoint[]) {
  if (points.length < 3) return 0;
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function polygonPerimeter(points: VectorPoint[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
}

function polygonBounds(points: VectorPoint[]) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function orientation(a: VectorPoint, b: VectorPoint, c: VectorPoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a: VectorPoint, b: VectorPoint, c: VectorPoint, d: VectorPoint) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first * second < -0.0001 && third * fourth < -0.0001;
}

function hasSelfIntersection(points: VectorPoint[]) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (first === 0 && secondNext === 0) continue;
      if (segmentsCross(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

function sanitizeClosedPath(
  points: VectorPoint[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  minimumArea: number,
) {
  const finite = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: clamp(point.x, bounds.minX, bounds.maxX),
      y: clamp(point.y, bounds.minY, bounds.maxY),
    }));
  const unique = finite.filter((point, index) => {
    const previous = finite[(index - 1 + finite.length) % finite.length];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.75;
  });
  if (unique.length < 3) return null;
  const cleaned = removeNearCollinear(collapseShortEdges(unique, 1.5), 1.25);
  if (cleaned.length < 3 || hasSelfIntersection(cleaned)) return null;
  const area = Math.abs(polygonArea(cleaned));
  const perimeter = polygonPerimeter(cleaned);
  const box = polygonBounds(cleaned);
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const minorDimension = Math.min(boxWidth, boxHeight);
  const compactness = area / Math.max(1, perimeter * perimeter);
  const lineLike = minorDimension < 3 && compactness < 0.001;
  if (area < minimumArea || perimeter < 6 || lineLike) return null;
  return cleaned;
}

function rdp(points: VectorPoint[], epsilon: number): VectorPoint[] {
  if (points.length <= 2) return points;
  let greatestDistance = 0;
  let greatestIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = pointSegmentDistance(points[index], points[0], points.at(-1)!);
    if (currentDistance > greatestDistance) {
      greatestDistance = currentDistance;
      greatestIndex = index;
    }
  }
  if (greatestDistance <= epsilon) return [points[0], points.at(-1)!];
  return [
    ...rdp(points.slice(0, greatestIndex + 1), epsilon).slice(0, -1),
    ...rdp(points.slice(greatestIndex), epsilon),
  ];
}

function simplifyClosedLoop(loop: VectorPoint[], epsilon: number) {
  if (loop.length < 8) return loop;
  let leftIndex = 0;
  let rightIndex = 0;
  for (let index = 1; index < loop.length; index += 1) {
    if (loop[index].x < loop[leftIndex].x) leftIndex = index;
    if (loop[index].x > loop[rightIndex].x) rightIndex = index;
  }
  if (leftIndex > rightIndex) [leftIndex, rightIndex] = [rightIndex, leftIndex];
  const firstArc = loop.slice(leftIndex, rightIndex + 1);
  const secondArc = [...loop.slice(rightIndex), ...loop.slice(0, leftIndex + 1)];
  let simplified = [...rdp(firstArc, epsilon).slice(0, -1), ...rdp(secondArc, epsilon).slice(0, -1)];

  let changed = true;
  while (changed && simplified.length > 3) {
    changed = false;
    const next = simplified.filter((point, index) => {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const following = simplified[(index + 1) % simplified.length];
      const remove = pointSegmentDistance(point, previous, following) <= epsilon * 0.45;
      if (remove) changed = true;
      return !remove;
    });
    if (next.length >= 3) simplified = next;
  }
  return simplified;
}

function collapseShortEdges(points: VectorPoint[], minimumDistance: number) {
  let result = points.map((point) => ({ ...point }));
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    for (let index = 0; index < result.length; index += 1) {
      const nextIndex = (index + 1) % result.length;
      if (Math.hypot(result[index].x - result[nextIndex].x, result[index].y - result[nextIndex].y) >= minimumDistance) continue;
      const merged = {
        x: (result[index].x + result[nextIndex].x) / 2,
        y: (result[index].y + result[nextIndex].y) / 2,
      };
      if (nextIndex === 0) result = [merged, ...result.slice(1, -1)];
      else result = [...result.slice(0, index), merged, ...result.slice(nextIndex + 1)];
      changed = true;
      break;
    }
  }
  return result;
}

function removeNearCollinear(points: VectorPoint[], tolerance: number) {
  let result = points;
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    const next = result.filter((point, index) => {
      const previous = result[(index - 1 + result.length) % result.length];
      const following = result[(index + 1) % result.length];
      const ax = previous.x - point.x;
      const ay = previous.y - point.y;
      const bx = following.x - point.x;
      const by = following.y - point.y;
      const denominator = Math.max(0.0001, Math.hypot(ax, ay) * Math.hypot(bx, by));
      const normalizedCross = Math.abs(ax * by - ay * bx) / denominator;
      const pointsOppose = ax * bx + ay * by < 0;
      const remove = pointsOppose && (
        normalizedCross < 0.1 ||
        (normalizedCross < 0.16 && pointSegmentDistance(point, previous, following) <= tolerance)
      );
      if (remove) changed = true;
      return !remove;
    });
    if (next.length >= 3) result = next;
  }
  return result;
}

function snapContourToMarkers(points: VectorPoint[], markers: Marker[], radius: number) {
  if (!markers.length) return points;
  const snapped = points.map((point) => {
    let nearest: Marker | undefined;
    let nearestDistance = radius;
    for (const marker of markers) {
      const currentDistance = Math.hypot(marker.x - point.x, marker.y - point.y);
      if (currentDistance < nearestDistance) {
        nearest = marker;
        nearestDistance = currentDistance;
      }
    }
    return nearest ? { x: nearest.x, y: nearest.y } : point;
  });
  return snapped.filter((point, index) => {
    const previous = snapped[(index - 1 + snapped.length) % snapped.length];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5;
  });
}

function drawMaskLine(mask: Uint8Array, width: number, height: number, a: VectorPoint, b: VectorPoint) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(a.x + (b.x - a.x) * step / steps);
    const y = Math.round(a.y + (b.y - a.y) * step / steps);
    if (x >= 0 && y >= 0 && x < width && y < height) mask[y * width + x] = 1;
  }
}

function bridgeDirectionalGaps(mask: Uint8Array, width: number, height: number, maximumGap = 5) {
  const bridged = mask.slice();
  const endpoints: VectorPoint[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (!mask[y * width + x]) continue;
      let neighbours = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if ((ox || oy) && mask[(y + oy) * width + x + ox]) neighbours += 1;
        }
      }
      if (neighbours <= 2) endpoints.push({ x, y });
    }
  }
  for (const endpoint of endpoints) {
    let support: VectorPoint | null = null;
    let supportDistance = 0;
    for (let oy = -4; oy <= 4; oy += 1) {
      for (let ox = -4; ox <= 4; ox += 1) {
        const x = endpoint.x + ox;
        const y = endpoint.y + oy;
        const currentDistance = Math.hypot(ox, oy);
        if (
          currentDistance > supportDistance &&
          currentDistance <= 4 &&
          x >= 0 && y >= 0 && x < width && y < height &&
          mask[y * width + x]
        ) {
          support = { x, y };
          supportDistance = currentDistance;
        }
      }
    }
    if (!support || supportDistance < 1) continue;
    const tangent = {
      x: (endpoint.x - support.x) / supportDistance,
      y: (endpoint.y - support.y) / supportDistance,
    };
    let target: VectorPoint | null = null;
    let targetDistance = Infinity;
    for (let oy = -maximumGap; oy <= maximumGap; oy += 1) {
      for (let ox = -maximumGap; ox <= maximumGap; ox += 1) {
        const currentDistance = Math.hypot(ox, oy);
        if (currentDistance < 2 || currentDistance > maximumGap) continue;
        const x = endpoint.x + ox;
        const y = endpoint.y + oy;
        if (x < 0 || y < 0 || x >= width || y >= height || !mask[y * width + x]) continue;
        const alignment = (ox * tangent.x + oy * tangent.y) / currentDistance;
        if (alignment < Math.cos(20 * Math.PI / 180)) continue;
        let gapIsClear = false;
        for (let step = 1; step < Math.floor(currentDistance); step += 1) {
          const sampleX = Math.round(endpoint.x + ox * step / currentDistance);
          const sampleY = Math.round(endpoint.y + oy * step / currentDistance);
          if (!mask[sampleY * width + sampleX]) gapIsClear = true;
        }
        if (gapIsClear && currentDistance < targetDistance) {
          target = { x, y };
          targetDistance = currentDistance;
        }
      }
    }
    if (target) drawMaskLine(bridged, width, height, endpoint, target);
  }
  return bridged;
}

function bridgeDashedLineRuns(mask: Uint8Array, width: number, height: number, maximumGap = 12) {
  const bridged = mask.slice();
  const directions = Array.from({ length: 16 }, (_, index) => {
    const angle = Math.PI * index / 16;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  const active = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && Boolean(mask[y * width + x]);
  const activeNear = (x: number, y: number, direction: VectorPoint) => {
    const normal = { x: -direction.y, y: direction.x };
    for (let offset = -1; offset <= 1; offset += 1) {
      const sample = {
        x: Math.round(x + normal.x * offset),
        y: Math.round(y + normal.y * offset),
      };
      if (active(sample.x, sample.y)) return sample;
    }
    return null;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (const direction of directions) {
        let supportedBehind = false;
        for (let step = 1; step <= 5; step += 1) {
          if (activeNear(x - direction.x * step, y - direction.y * step, direction)) {
            supportedBehind = true;
            break;
          }
        }
        if (!supportedBehind) continue;
        let target: VectorPoint | null = null;
        let sawGap = false;
        for (let step = 2; step <= maximumGap; step += 1) {
          const nextX = Math.round(x + direction.x * step);
          const nextY = Math.round(y + direction.y * step);
          const nextActive = activeNear(nextX, nextY, direction);
          if (!nextActive) {
            sawGap = true;
            continue;
          }
          if (!sawGap) continue;
          let supportedAhead = false;
          for (let support = 1; support <= 5; support += 1) {
            if (activeNear(
              nextActive.x + direction.x * support,
              nextActive.y + direction.y * support,
              direction,
            )) {
              supportedAhead = true;
              break;
            }
          }
          if (supportedAhead) target = nextActive;
          break;
        }
        if (target) drawMaskLine(bridged, width, height, { x, y }, target);
      }
    }
  }
  return bridged;
}

function dilateOnePixel(mask: Uint8Array, width: number, height: number) {
  const dilated = mask.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nextX = x + ox;
          const nextY = y + oy;
          if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height) {
            dilated[nextY * width + nextX] = 1;
          }
        }
      }
    }
  }
  return dilated;
}

function estimateStrokeWidth(mask: Uint8Array, width: number, height: number) {
  const runs: number[] = [];
  const collect = (get: (outer: number, inner: number) => number, outerLimit: number, innerLimit: number) => {
    for (let outer = 0; outer < outerLimit; outer += 3) {
      let run = 0;
      for (let inner = 0; inner <= innerLimit; inner += 1) {
        const active = inner < innerLimit && get(outer, inner);
        if (active) run += 1;
        else if (run) {
          if (run <= 16) runs.push(run);
          run = 0;
        }
      }
    }
  };
  collect((y, x) => mask[y * width + x], height, width);
  collect((x, y) => mask[y * width + x], width, height);
  if (!runs.length) return 1;
  runs.sort((a, b) => a - b);
  return clamp(runs[Math.floor(runs.length * 0.3)], 1, 12);
}

function buildInkMask(buffer: PixelBuffer, roi: Required<VectorBox>) {
  const { data, width: imageWidth } = buffer;
  const width = roi.width;
  const height = roi.height;
  const luminance = new Float32Array(width * height);
  const strongColour = new Uint8Array(width * height);
  const lineColour = new Uint8Array(width * height);
  const surveyFill = new Uint8Array(width * height);
  const integralWidth = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  const squared = new Float64Array((width + 1) * (height + 1));
  const sampledColours = new Map<number, number>();
  let sampledCount = 0;

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    let rowSquared = 0;
    for (let x = 0; x < width; x += 1) {
      const source = ((roi.y + y) * imageWidth + roi.x + x) * 4;
      const red = data[source];
      const green = data[source + 1];
      const blue = data[source + 2];
      const alpha = data[source + 3];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const chroma = maximum - minimum;
      const value = alpha > 20 ? red * 0.2126 + green * 0.7152 + blue * 0.0722 : 255;
      const index = y * width + x;
      luminance[index] = value;
      if (x % 4 === 0 && y % 4 === 0) {
        const key = (red << 16) | (green << 8) | blue;
        sampledColours.set(key, (sampledColours.get(key) ?? 0) + 1);
        sampledCount += 1;
      }
      rowSum += value;
      rowSquared += value * value;
      const integralIndex = (y + 1) * integralWidth + x + 1;
      integral[integralIndex] = integral[y * integralWidth + x + 1] + rowSum;
      squared[integralIndex] = squared[y * integralWidth + x + 1] + rowSquared;
      if (
        alpha > 135 &&
        chroma > 45 &&
        maximum > 105 &&
        value < 246 &&
        (minimum < 165 || value < 190)
      ) {
        strongColour[index] = 1;
        lineColour[index] = 1;
      }
      if (
        alpha > 150 &&
        value > 145 &&
        green - red > 10 &&
        green - blue > 3 &&
        chroma >= 16 &&
        chroma < 95
      ) surveyFill[index] = 1;
    }
  }

  const original = new Uint8Array(width * height);
  const radius = 15;
  const regionSum = (table: Float64Array, minX: number, minY: number, maxX: number, maxY: number) =>
    table[(maxY + 1) * integralWidth + maxX + 1] -
    table[minY * integralWidth + maxX + 1] -
    table[(maxY + 1) * integralWidth + minX] +
    table[minY * integralWidth + minX];
  for (let y = 0; y < height; y += 1) {
    const minY = Math.max(0, y - radius);
    const maxY = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const minX = Math.max(0, x - radius);
      const maxX = Math.min(width - 1, x + radius);
      const count = (maxX - minX + 1) * (maxY - minY + 1);
      const mean = regionSum(integral, minX, minY, maxX, maxY) / count;
      const variance = Math.max(0, regionSum(squared, minX, minY, maxX, maxY) / count - mean * mean);
      const threshold = mean * (1 + 0.2 * (Math.sqrt(variance) / 128 - 1));
      const index = y * width + x;
      if (luminance[index] < Math.min(220, threshold) || strongColour[index]) original[index] = 1;
    }
  }

  let cleanedOriginal = retainMaskComponents(original, width, height, 3);
  let estimatedStrokeWidth = estimateStrokeWidth(cleanedOriginal, width, height);
  const dominant = [...sampledColours.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant) {
    const backgroundRed = dominant[0] >> 16 & 255;
    const backgroundGreen = dominant[0] >> 8 & 255;
    const backgroundBlue = dominant[0] & 255;
    const backgroundLuminance = backgroundRed * 0.2126 + backgroundGreen * 0.7152 + backgroundBlue * 0.0722;
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const source = ((roi.y + py) * imageWidth + roi.x + px) * 4;
        if (data[source + 3] <= 135) continue;
        const red = data[source];
        const green = data[source + 1];
        const blue = data[source + 2];
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        const pixelLuminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const colourDistance = Math.hypot(red - backgroundRed, green - backgroundGreen, blue - backgroundBlue);
        if (
          colourDistance > 38 &&
          pixelLuminance < 250 &&
          (chroma > 18 || pixelLuminance < backgroundLuminance - 16)
        ) lineColour[py * width + px] = 1;
      }
    }
  }
  if (estimatedStrokeWidth <= 1 && dominant && dominant[1] / Math.max(1, sampledCount) >= 0.82) {
    const dominantRed = dominant[0] >> 16 & 255;
    const dominantGreen = dominant[0] >> 8 & 255;
    const dominantBlue = dominant[0] & 255;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const source = ((roi.y + y) * imageWidth + roi.x + x) * 4;
        const colourDistance = Math.abs(data[source] - dominantRed) +
          Math.abs(data[source + 1] - dominantGreen) +
          Math.abs(data[source + 2] - dominantBlue);
        if (colourDistance >= 5) original[y * width + x] = 1;
      }
    }
    cleanedOriginal = retainMaskComponents(original, width, height, 3);
    estimatedStrokeWidth = estimateStrokeWidth(cleanedOriginal, width, height);
  }
  const endpointBridged = bridgeDirectionalGaps(cleanedOriginal, width, height, estimatedStrokeWidth <= 1 ? 12 : 5);
  const bridgedWall = estimatedStrokeWidth <= 1
    ? bridgeDashedLineRuns(endpointBridged, width, height)
    : endpointBridged;
  const sealedWall = estimatedStrokeWidth <= 1
    ? closeMask(bridgedWall, width, height, 4)
    : bridgedWall;
  const onceDilated = dilateOnePixel(sealedWall, width, height);
  const wall = estimatedStrokeWidth <= 1
    ? dilateOnePixel(dilateOnePixel(dilateOnePixel(onceDilated, width, height), width, height), width, height)
    : onceDilated;
  const expandedSurveyFill = surveyFill.slice();
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      if (!surveyFill[y * width + x]) continue;
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          if (ox * ox + oy * oy <= 4) expandedSurveyFill[(y + oy) * width + x + ox] = 1;
        }
      }
    }
  }
  return {
    original: cleanedOriginal,
    wall,
    surveyFill: expandedSurveyFill,
    strongColour,
    lineColour: retainMaskComponents(lineColour, width, height, 3),
    estimatedStrokeWidth,
  };
}

function floodExterior(wall: Uint8Array, width: number, height: number) {
  const exterior = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    const index = y * width + x;
    if (!wall[index] && !exterior[index]) {
      exterior[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [offsetX, offsetY] of NEIGHBORS_4) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height) enqueue(nextX, nextY);
    }
  }
  return exterior;
}

function enclosedRegions(wall: Uint8Array, exterior: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(width * height);
  const regions: Region[] = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < wall.length; start += 1) {
    if (wall[start] || exterior[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    const pixels: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      pixels.push(index);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const [offsetX, offsetY] of NEIGHBORS_4) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (!wall[next] && !exterior[next] && !seen[next]) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    regions.push({ pixels, area: pixels.length, minX, minY, maxX, maxY });
  }
  return regions;
}

function foregroundRegions(mask: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(width * height);
  const regions: Region[] = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    const pixels: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      pixels.push(index);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const [offsetX, offsetY] of NEIGHBORS_8) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    regions.push({ pixels, area: pixels.length, minX, minY, maxX, maxY });
  }
  return regions;
}

function retainMaskComponents(mask: Uint8Array, width: number, height: number, minimumArea: number) {
  const retained = new Uint8Array(mask.length);
  for (const region of foregroundRegions(mask, width, height)) {
    if (region.area < minimumArea) continue;
    for (const pixel of region.pixels) retained[pixel] = 1;
  }
  return retained;
}

function regionLoops(region: Region, width: number, height: number) {
  const mask = new Uint8Array(width * height);
  region.pixels.forEach((index) => { mask[index] = 1; });
  const rowWidth = width + 1;
  const edges = new Map<number, number[]>();
  const addEdge = (startX: number, startY: number, endX: number, endY: number) => {
    const start = startY * rowWidth + startX;
    const end = endY * rowWidth + endX;
    const list = edges.get(start);
    if (list) list.push(end);
    else edges.set(start, [end]);
  };

  for (const index of region.pixels) {
    const x = index % width;
    const y = Math.floor(index / width);
    if (y === 0 || !mask[index - width]) addEdge(x, y, x + 1, y);
    if (x === width - 1 || !mask[index + 1]) addEdge(x + 1, y, x + 1, y + 1);
    if (y === height - 1 || !mask[index + width]) addEdge(x + 1, y + 1, x, y + 1);
    if (x === 0 || !mask[index - 1]) addEdge(x, y + 1, x, y);
  }

  const loops: VectorPoint[][] = [];
  let guard = 0;
  while (edges.size && guard < width * height * 2) {
    guard += 1;
    const firstEntry = edges.entries().next().value as [number, number[]] | undefined;
    if (!firstEntry) break;
    const start = firstEntry[0];
    let current = start;
    const loop: VectorPoint[] = [];
    let innerGuard = 0;
    do {
      loop.push({ x: current % rowWidth, y: Math.floor(current / rowWidth) });
      const candidates = edges.get(current);
      if (!candidates?.length) break;
      const next = candidates.pop()!;
      if (!candidates.length) edges.delete(current);
      current = next;
      innerGuard += 1;
    } while (current !== start && innerGuard < width * height * 2);
    if (current === start && loop.length >= 4) loops.push(loop);
  }
  return loops;
}

type StrokeProfile = {
  midpoint: number;
  width: number;
};

function strokeProfileAt(
  base: VectorPoint,
  normal: VectorPoint,
  ink: Uint8Array,
  width: number,
  height: number,
  radius: number,
): StrokeProfile | null {
  const samples: { offset: number; ink: boolean }[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const x = Math.round(base.x + normal.x * offset);
    const y = Math.round(base.y + normal.y * offset);
    samples.push({
      offset,
      ink: x >= 0 && y >= 0 && x < width && y < height && Boolean(ink[y * width + x]),
    });
  }
  const runs: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const nextIsInk = samples[index + 1]?.ink ?? false;
    if (current.ink && start === null) start = current.offset;
    if (start !== null && current.ink && !nextIsInk) {
      runs.push({ start, end: current.offset });
      start = null;
    }
  }
  if (!runs.length) return null;
  const selected = runs
    .map((run) => ({
      ...run,
      distance: run.start <= 0 && run.end >= 0
        ? 0
        : Math.min(Math.abs(run.start), Math.abs(run.end)),
    }))
    .sort((first, second) =>
      first.distance - second.distance ||
      (second.end - second.start) - (first.end - first.start),
    )[0];
  return {
    midpoint: (selected.start + selected.end) / 2,
    width: selected.end - selected.start + 1,
  };
}

function centerlineFitScore(
  points: VectorPoint[],
  ink: Uint8Array,
  width: number,
  height: number,
  estimatedStrokeWidth: number,
) {
  const radius = Math.ceil(Math.max(8, estimatedStrokeWidth * 3 + 4));
  const scores: number[] = [];
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const normal = { x: -dy / length, y: dx / length };
    for (const fraction of [0.2, 0.5, 0.8]) {
      const profile = strokeProfileAt({
        x: point.x + dx * fraction,
        y: point.y + dy * fraction,
      }, normal, ink, width, height, radius);
      scores.push(profile ? Math.abs(profile.midpoint) : radius);
    }
  });
  if (!scores.length) return radius;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function offsetToStrokeCenter(
  points: VectorPoint[],
  ink: Uint8Array,
  width: number,
  height: number,
  estimatedStrokeWidth: number,
) {
  const signedArea = polygonArea(points);
  const clockwise = signedArea > 0;
  const radius = Math.ceil(Math.max(8, estimatedStrokeWidth * 3 + 4));
  const maximumShift = Math.max(4, estimatedStrokeWidth * 1.75 + 2);
  const shiftedLines = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = clockwise ? { x: dy / length, y: -dx / length } : { x: -dy / length, y: dx / length };
    const samples = [0.2, 0.5, 0.8].flatMap((t) => {
      const base = { x: point.x + dx * t, y: point.y + dy * t };
      const profile = strokeProfileAt(base, normal, ink, width, height, radius);
      if (!profile || profile.width > Math.max(28, estimatedStrokeWidth * 5)) return [];
      return [profile.midpoint];
    });
    const sorted = samples.sort((a, b) => a - b);
    const measuredOffset = sorted.length >= 2 ? sorted[Math.floor(sorted.length / 2)] : 0;
    const offset = clamp(measuredOffset, -maximumShift, maximumShift);
    return {
      a: { x: point.x + normal.x * offset, y: point.y + normal.y * offset },
      b: { x: next.x + normal.x * offset, y: next.y + normal.y * offset },
      offset: Math.abs(offset),
    };
  });

  const centered = shiftedLines.map((line, index) => {
    const previous = shiftedLines[(index - 1 + shiftedLines.length) % shiftedLines.length];
    const x1 = previous.a.x;
    const y1 = previous.a.y;
    const x2 = previous.b.x;
    const y2 = previous.b.y;
    const x3 = line.a.x;
    const y3 = line.a.y;
    const x4 = line.b.x;
    const y4 = line.b.y;
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    const bevel = {
      x: (previous.b.x + line.a.x) / 2,
      y: (previous.b.y + line.a.y) / 2,
    };
    if (Math.abs(denominator) < 0.0001) return bevel;
    const determinant1 = x1 * y2 - y1 * x2;
    const determinant2 = x3 * y4 - y3 * x4;
    const intersection = {
      x: (determinant1 * (x3 - x4) - (x1 - x2) * determinant2) / denominator,
      y: (determinant1 * (y3 - y4) - (y1 - y2) * determinant2) / denominator,
    };
    const sourcePoint = points[index];
    const miterLength = Math.hypot(intersection.x - sourcePoint.x, intersection.y - sourcePoint.y);
    const miterLimit = Math.max(6, Math.max(previous.offset, line.offset) * 4);
    const safe = Number.isFinite(intersection.x) && Number.isFinite(intersection.y) &&
      miterLength <= miterLimit &&
      intersection.x >= 0 && intersection.y >= 0 &&
      intersection.x <= width - 1 && intersection.y <= height - 1;
    return safe ? intersection : bevel;
  });
  const beforeScore = centerlineFitScore(points, ink, width, height, estimatedStrokeWidth);
  const afterScore = centerlineFitScore(centered, ink, width, height, estimatedStrokeWidth);
  return {
    points: centered,
    beforeScore,
    afterScore,
    adjusted: afterScore + 0.1 < beforeScore,
  };
}

export function prepareVectorRaster(
  buffer: PixelBuffer,
  options: VectorizationOptions = {},
): PreparedVectorRaster {
  const requested = options.roi ?? { x: 0, y: 0, width: buffer.width, height: buffer.height };
  const x = clamp(Math.floor(requested.x), 0, buffer.width - 1);
  const y = clamp(Math.floor(requested.y), 0, buffer.height - 1);
  const roiWidth = clamp(Math.ceil(requested.width), 1, buffer.width - x);
  const roiHeight = clamp(Math.ceil(requested.height), 1, buffer.height - y);
  const roi = { x, y, width: roiWidth, height: roiHeight };
  const raw = buildInkMask(buffer, roi);
  const padding = 2;
  const paddedOriginal = maskWithPadding(raw.original, roiWidth, roiHeight, padding);
  const paddedWall = maskWithPadding(raw.wall, roiWidth, roiHeight, padding);
  const paddedFill = maskWithPadding(raw.surveyFill, roiWidth, roiHeight, padding);
  const paddedColour = maskWithPadding(raw.strongColour, roiWidth, roiHeight, padding);
  const paddedLineColour = maskWithPadding(raw.lineColour, roiWidth, roiHeight, padding);
  const width = paddedOriginal.width;
  const height = paddedOriginal.height;
  const original = paddedOriginal.mask;
  const wall = paddedWall.mask;
  const lineInk = wall.slice();
  for (let index = 0; index < lineInk.length; index += 1) {
    if (paddedLineColour.mask[index]) lineInk[index] = 1;
  }
  const surveyFill = closeMask(paddedFill.mask, width, height, 3);
  const strongColour = paddedColour.mask;
  const estimatedStrokeWidth = raw.estimatedStrokeWidth;
  const minimumArea = options.minimumAreaRatio !== undefined
    ? roiWidth * roiHeight * options.minimumAreaRatio
    : Math.max(100, 48 * estimatedStrokeWidth * estimatedStrokeWidth);
  return {
    buffer,
    roi,
    width,
    height,
    padding,
    original,
    wall,
    lineInk,
    surveyFill,
    strongColour,
    minimumArea,
    estimatedStrokeWidth,
  };
}

function markersForPrepared(prepared: PreparedVectorRaster) {
  const { strongColour, width, height } = prepared;
  return foregroundRegions(strongColour, width, height).flatMap((region) => {
    const markerWidth = region.maxX - region.minX + 1;
    const markerHeight = region.maxY - region.minY + 1;
    const aspect = markerWidth / markerHeight;
    const density = region.area / (markerWidth * markerHeight);
    if (
      region.area < 7 ||
      region.area > 650 ||
      markerWidth > 32 ||
      markerHeight > 32 ||
      aspect < 0.45 ||
      aspect > 2.2 ||
      density < 0.24
    ) return [];
    const sum = region.pixels.reduce((total, pixel) => ({
      x: total.x + pixel % width,
      y: total.y + Math.floor(pixel / width),
    }), { x: 0, y: 0 });
    return [{ x: sum.x / region.area, y: sum.y / region.area, area: region.area }];
  });
}

function pathFromRegion(
  prepared: PreparedVectorRaster,
  region: Region,
  markers: Marker[],
): DetectedPath | null {
  const {
    buffer,
    roi,
    width,
    height,
    padding,
    original,
    minimumArea,
  } = prepared;
  const loops = regionLoops(region, width, height);
  if (!loops.length) return null;
  const outer = loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  const epsilon = clamp(Math.sqrt(region.area) * 0.022, 1.25, 12);
  const simplified = simplifyClosedLoop(outer, epsilon);
  if (simplified.length < 3 || simplified.length > 120) return null;
  const localBounds = {
    minX: padding,
    minY: padding,
    maxX: padding + roi.width,
    maxY: padding + roi.height,
  };
  const refinement = offsetToStrokeCenter(simplified, original, width, height, prepared.estimatedStrokeWidth);
  const centeredCandidate = removeNearCollinear(
    snapContourToMarkers(
      collapseShortEdges(
        refinement.points,
        clamp(Math.sqrt(region.area) * 0.026, 2, 18),
      ),
      markers,
      18,
    ),
    1.25,
  );
  const minimumGeometryArea = Math.max(18, Math.min(minimumArea * 0.35, region.area * 0.02));
  const fallbackLocal = sanitizeClosedPath(simplified, localBounds, minimumGeometryArea);
  const refinedLocal = sanitizeClosedPath(centeredCandidate, localBounds, minimumGeometryArea);
  const areaDelta = fallbackLocal && refinedLocal
    ? Math.abs(Math.abs(polygonArea(refinedLocal)) - Math.abs(polygonArea(fallbackLocal))) /
      Math.max(1, Math.abs(polygonArea(fallbackLocal)))
    : Infinity;
  const perimeterDelta = fallbackLocal && refinedLocal
    ? Math.abs(polygonPerimeter(refinedLocal) - polygonPerimeter(fallbackLocal)) /
      Math.max(1, polygonPerimeter(fallbackLocal))
    : Infinity;
  const useRefined = Boolean(
    refinedLocal &&
    refinement.adjusted &&
    areaDelta <= 0.12 &&
    perimeterDelta <= 0.08,
  );
  const safeLocal = useRefined ? refinedLocal : fallbackLocal;
  if (!safeLocal) return null;
  const globalCandidate = safeLocal.map((point) => ({
    x: clamp(point.x - padding + roi.x, roi.x, roi.x + roi.width),
    y: clamp(point.y - padding + roi.y, roi.y, roi.y + roi.height),
  }));
  const centered = sanitizeClosedPath(globalCandidate, {
    minX: 0,
    minY: 0,
    maxX: buffer.width,
    maxY: buffer.height,
  }, minimumGeometryArea);
  if (!centered) return null;
  const bboxArea = Math.max(1, (region.maxX - region.minX + 1) * (region.maxY - region.minY + 1));
  const solidity = region.area / bboxArea;
  return {
    points: centered,
    closed: true,
    pixelArea: Math.abs(polygonArea(centered)),
    confidence: clamp(0.55 + solidity * 0.35 + Math.min(region.area / (prepared.roi.width * prepared.roi.height), 0.25), 0, 0.99),
    centerlineAdjusted: useRefined,
    centerlineFitBefore: refinement.beforeScore,
    centerlineFitAfter: useRefined ? refinement.afterScore : refinement.beforeScore,
  };
}

function approximateOverlap(first: DetectedPath, second: DetectedPath) {
  const a = polygonBounds(first.points);
  const b = polygonBounds(second.points);
  const intersection = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) *
    Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const union = Math.max(1,
    (a.maxX - a.minX) * (a.maxY - a.minY) +
    (b.maxX - b.minX) * (b.maxY - b.minY) -
    intersection,
  );
  return intersection / union;
}

export function vectorizePreparedRaster(
  prepared: PreparedVectorRaster,
  options: VectorizationOptions = {},
): VectorizationResult {
  const { wall, surveyFill, width, height, minimumArea } = prepared;
  const exterior = floodExterior(wall, width, height);
  const fillCandidates = foregroundRegions(surveyFill, width, height)
    .filter((region) => region.area >= minimumArea);
  const colourExterior = floodExterior(prepared.strongColour, width, height);
  const colourCandidates = enclosedRegions(prepared.strongColour, colourExterior, width, height)
    .filter((region) => region.area >= minimumArea);
  const colouredInterior = new Uint8Array(width * height);
  colourCandidates.forEach((region) => region.pixels.forEach((pixel) => { colouredInterior[pixel] = 1; }));
  const wallCandidates = enclosedRegions(wall, exterior, width, height)
    .filter((region) => region.area >= minimumArea);
  const filteredWallCandidates = wallCandidates.filter((region) => {
    const centerX = Math.round((region.minX + region.maxX) / 2);
    const centerY = Math.round((region.minY + region.maxY) / 2);
    return !colouredInterior[centerY * width + centerX];
  });
  const allCandidates = [...fillCandidates, ...colourCandidates, ...filteredWallCandidates]
    .sort((a, b) => b.area - a.area);
  const largestCandidate = allCandidates[0]?.area ?? 0;
  const candidates = allCandidates.length < 50
    ? allCandidates.filter((region) => region.area >= largestCandidate * 0.055)
    : allCandidates;
  const maxShapes = clamp(options.maxShapes ?? 500, 1, 500);
  const markers = markersForPrepared(prepared);
  const detected = candidates.slice(0, Math.min(candidates.length, maxShapes * 6)).flatMap((region) => {
    const path = pathFromRegion(prepared, region, markers);
    return path ? [path] : [];
  });
  const deduplicated = detected
    .sort((a, b) => b.pixelArea - a.pixelArea)
    .filter((candidate, index, all) => {
      return !all.slice(0, index).some((larger) => {
        const areaRatio = candidate.pixelArea / Math.max(1, larger.pixelArea);
        return areaRatio >= 0.82 && areaRatio <= 1.18 && approximateOverlap(candidate, larger) >= 0.72;
      });
    })
    .slice(0, maxShapes);
  const paths = deduplicated.map((path, index) => ({
    ...path,
    confidence: clamp(path.confidence - index * 0.015, 0, 0.99),
  }));
  return {
    paths,
    diagnostics: {
      detectedCount: paths.length,
      rejectedCount: Math.max(0, candidates.length - detected.length),
      candidateCount: candidates.length,
      capHit: candidates.length > maxShapes && paths.length >= maxShapes,
      estimatedStrokeWidth: prepared.estimatedStrokeWidth,
    },
  };
}

export function vectorizePixelBufferDetailed(
  buffer: PixelBuffer,
  options: VectorizationOptions = {},
): VectorizationResult {
  return vectorizePreparedRaster(prepareVectorRaster(buffer, options), options);
}

function floodSeedRegion(wall: Uint8Array, width: number, height: number, start: number) {
  if (wall[start]) return null;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const pixels: number[] = [];
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let touchesEdge = false;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    pixels.push(index);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
    for (const [offsetX, offsetY] of NEIGHBORS_4) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const next = nextY * width + nextX;
      if (!wall[next] && !seen[next]) {
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  return {
    region: { pixels, area: pixels.length, minX, minY, maxX, maxY },
    touchesEdge,
  };
}

export function vectorizePreparedSeed(
  prepared: PreparedVectorRaster,
  point: VectorPoint,
  searchRadius = 20,
): SeedVectorizationResult {
  const { roi, padding, width, height, wall, minimumArea } = prepared;
  if (
    point.x < roi.x || point.y < roi.y ||
    point.x > roi.x + roi.width || point.y > roi.y + roi.height
  ) return { ok: false, reason: "outside" };
  const local = {
    x: Math.round(point.x - roi.x + padding),
    y: Math.round(point.y - roi.y + padding),
  };
  const candidates: { index: number; distance: number }[] = [];
  const radius = Math.max(1, Math.ceil(searchRadius));
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const currentDistance = Math.hypot(ox, oy);
      if (currentDistance > radius) continue;
      const x = local.x + ox;
      const y = local.y + oy;
      if (x < padding || y < padding || x >= width - padding || y >= height - padding) continue;
      const index = y * width + x;
      if (!wall[index]) candidates.push({ index, distance: currentDistance });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return { ok: false, reason: "ink_no_interior" };
  const componentPixels = new Set<number>();
  const markers = markersForPrepared(prepared);
  let sawOpen = false;
  let sawSmall = false;
  let best: { path: DetectedPath; seed: VectorPoint; area: number } | null = null;
  for (const candidate of candidates) {
    if (componentPixels.has(candidate.index)) continue;
    const flooded = floodSeedRegion(wall, width, height, candidate.index);
    if (!flooded) continue;
    flooded.region.pixels.forEach((pixel) => componentPixels.add(pixel));
    if (flooded.touchesEdge) {
      sawOpen = true;
      continue;
    }
    if (flooded.region.area < minimumArea) {
      sawSmall = true;
      continue;
    }
    const path = pathFromRegion(prepared, flooded.region, markers);
    if (!path) {
      sawSmall = true;
      continue;
    }
    const seedX = candidate.index % width;
    const seedY = Math.floor(candidate.index / width);
    const result = {
      path,
      seed: { x: seedX - padding + roi.x, y: seedY - padding + roi.y },
      area: flooded.region.area,
    };
    if (!best || result.area < best.area) best = result;
  }
  if (best) return { ok: true, path: best.path, seed: best.seed };
  return { ok: false, reason: sawOpen ? "open_boundary" : sawSmall ? "too_small" : "ink_no_interior" };
}

export function vectorizeSeedPixelBuffer(
  buffer: PixelBuffer,
  point: VectorPoint,
  options: VectorizationOptions = {},
  searchRadius = 20,
): SeedVectorizationResult {
  return vectorizePreparedSeed(prepareVectorRaster(buffer, options), point, searchRadius);
}

function thinComponent(mask: Uint8Array, width: number, height: number) {
  const skeleton = mask.slice();
  const neighbors = (index: number) => {
    const x = index % width;
    const y = Math.floor(index / width);
    return [
      skeleton[(y - 1) * width + x],
      skeleton[(y - 1) * width + x + 1],
      skeleton[y * width + x + 1],
      skeleton[(y + 1) * width + x + 1],
      skeleton[(y + 1) * width + x],
      skeleton[(y + 1) * width + x - 1],
      skeleton[y * width + x - 1],
      skeleton[(y - 1) * width + x - 1],
    ];
  };
  for (let iteration = 0; iteration < 96; iteration += 1) {
    let removed = 0;
    for (const phase of [0, 1]) {
      const pending: number[] = [];
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (!skeleton[index]) continue;
          const ring = neighbors(index);
          const count = ring.reduce((sum, value) => sum + value, 0);
          if (count < 2 || count > 6) continue;
          let transitions = 0;
          for (let ringIndex = 0; ringIndex < ring.length; ringIndex += 1) {
            if (!ring[ringIndex] && ring[(ringIndex + 1) % ring.length]) transitions += 1;
          }
          if (transitions !== 1) continue;
          const [north,, east,, south,, west] = ring;
          const preserve = phase === 0
            ? north * east * south || east * south * west
            : north * east * west || north * south * west;
          if (!preserve) pending.push(index);
        }
      }
      pending.forEach((index) => { skeleton[index] = 0; });
      removed += pending.length;
    }
    if (!removed) break;
  }
  return skeleton;
}

function traceSkeletonComponent(prepared: PreparedVectorRaster, seed: VectorPoint) {
  const seedIndex = Math.round(seed.y) * prepared.width + Math.round(seed.x);
  const queue = new Int32Array(Math.min(prepared.lineInk.length, 300_000));
  const seen = new Uint8Array(prepared.lineInk.length);
  const component: number[] = [];
  let head = 0;
  let tail = 1;
  queue[0] = seedIndex;
  seen[seedIndex] = 1;
  let minX = Math.round(seed.x), maxX = minX, minY = Math.round(seed.y), maxY = minY;
  while (head < tail && tail < queue.length) {
    const index = queue[head++];
    component.push(index);
    const x = index % prepared.width;
    const y = Math.floor(index / prepared.width);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [ox, oy] of NEIGHBORS_8) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= prepared.width || ny >= prepared.height) continue;
      const next = ny * prepared.width + nx;
      if (prepared.lineInk[next] && !seen[next]) {
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  if (component.length < Math.max(18, prepared.estimatedStrokeWidth * 8) || tail >= queue.length) return null;
  const margin = 2;
  minX = Math.max(0, minX - margin); minY = Math.max(0, minY - margin);
  maxX = Math.min(prepared.width - 1, maxX + margin); maxY = Math.min(prepared.height - 1, maxY + margin);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const local = new Uint8Array(width * height);
  component.forEach((index) => {
    const x = index % prepared.width;
    const y = Math.floor(index / prepared.width);
    local[(y - minY) * width + x - minX] = 1;
  });
  const skeleton = thinComponent(local, width, height);
  const skeletonNeighbors = (index: number) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const result: number[] = [];
    for (const [ox, oy] of NEIGHBORS_8) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (skeleton[next]) result.push(next);
    }
    return result;
  };
  let start = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < skeleton.length; index += 1) {
    if (!skeleton[index]) continue;
    const x = index % width + minX;
    const y = Math.floor(index / width) + minY;
    const candidateDistance = Math.hypot(x - seed.x, y - seed.y);
    const degree = skeletonNeighbors(index).length;
    const penalty = degree === 2 ? 0 : 4;
    if (candidateDistance + penalty < bestDistance) {
      start = index;
      bestDistance = candidateDistance + penalty;
    }
  }
  if (start < 0) return null;
  const startNeighbors = skeletonNeighbors(start);
  if (!startNeighbors.length) return null;
  const branchCountAt = (origin: number, radius = 6) => {
    const originX = origin % width;
    const originY = Math.floor(origin / width);
    const angles: number[] = [];
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const radialDistance = Math.hypot(ox, oy);
        if (radialDistance < radius - 1 || radialDistance > radius + 0.75) continue;
        const x = originX + ox;
        const y = originY + oy;
        if (x < 0 || y < 0 || x >= width || y >= height || !skeleton[y * width + x]) continue;
        angles.push(Math.atan2(oy, ox));
      }
    }
    if (!angles.length) return 0;
    angles.sort((a, b) => a - b);
    const threshold = Math.PI / 5;
    let clusters = 1;
    for (let index = 1; index < angles.length; index += 1) {
      if (angles[index] - angles[index - 1] > threshold) clusters += 1;
    }
    const wrapGap = angles[0] + Math.PI * 2 - angles.at(-1)!;
    if (clusters > 1 && wrapGap <= threshold) clusters -= 1;
    return clusters;
  };
  if (branchCountAt(start) > 2) {
    return { points: [] as VectorPoint[], ambiguous: true };
  }
  const trace = (first: number) => {
    const points = [start, first];
    let previous = start;
    let current = first;
    const visited = new Set([start, first]);
    for (let step = 0; step < skeleton.length; step += 1) {
      const candidates = skeletonNeighbors(current).filter((index) => index !== previous && !visited.has(index));
      if (!candidates.length) break;
      if (points.length > 2 && branchCountAt(current) > 2) break;
      const previousX = previous % width;
      const previousY = Math.floor(previous / width);
      const currentX = current % width;
      const currentY = Math.floor(current / width);
      const headingLength = Math.max(1, Math.hypot(currentX - previousX, currentY - previousY));
      const heading = { x: (currentX - previousX) / headingLength, y: (currentY - previousY) / headingLength };
      candidates.sort((first, second) => {
        const firstX = first % width;
        const firstY = Math.floor(first / width);
        const secondX = second % width;
        const secondY = Math.floor(second / width);
        const firstLength = Math.max(1, Math.hypot(firstX - currentX, firstY - currentY));
        const secondLength = Math.max(1, Math.hypot(secondX - currentX, secondY - currentY));
        const firstScore = heading.x * (firstX - currentX) / firstLength + heading.y * (firstY - currentY) / firstLength;
        const secondScore = heading.x * (secondX - currentX) / secondLength + heading.y * (secondY - currentY) / secondLength;
        return secondScore - firstScore;
      });
      previous = current;
      current = candidates[0];
      visited.add(current);
      points.push(current);
    }
    return points;
  };
  const branches = startNeighbors.map(trace).sort((first, second) => second.length - first.length);
  const combined = branches.length > 1
    ? [...branches[1].slice(1).reverse(), start, ...branches[0].slice(1)]
    : branches[0];
  return {
    ambiguous: false,
    points: combined.map((index) => ({
      x: index % width + minX,
      y: Math.floor(index / width) + minY,
    })),
  };
}

export function vectorizePreparedLineSeed(
  prepared: PreparedVectorRaster,
  point: VectorPoint,
  searchRadius = 20,
): LineSeedVectorizationResult {
  const localPoint = {
    x: point.x - prepared.roi.x + prepared.padding,
    y: point.y - prepared.roi.y + prepared.padding,
  };
  let nearest: VectorPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const radius = Math.max(2, Math.ceil(searchRadius));
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      const candidateDistance = Math.hypot(ox, oy);
      if (candidateDistance > radius || candidateDistance >= nearestDistance) continue;
      const x = Math.round(localPoint.x + ox);
      const y = Math.round(localPoint.y + oy);
      if (x < 0 || y < 0 || x >= prepared.width || y >= prepared.height) continue;
      if (prepared.lineInk[y * prepared.width + x]) {
        nearest = { x, y };
        nearestDistance = candidateDistance;
      }
    }
  }
  if (!nearest) return { ok: false, reason: "no_ink" };
  const traced = traceSkeletonComponent(prepared, nearest);
  if (!traced) return { ok: false, reason: "too_short" };
  if (traced.ambiguous) return { ok: false, reason: "ambiguous_junction" };
  const simplified = rdp(traced.points, Math.max(0.65, prepared.estimatedStrokeWidth * 0.32));
  const length = simplified.slice(1).reduce((sum, candidate, index) => sum + Math.hypot(
    candidate.x - simplified[index].x,
    candidate.y - simplified[index].y,
  ), 0);
  if (length < Math.max(18, prepared.estimatedStrokeWidth * 8)) return { ok: false, reason: "too_short" };
  const toDocument = (candidate: VectorPoint) => ({
    x: clamp(candidate.x - prepared.padding + prepared.roi.x, prepared.roi.x, prepared.roi.x + prepared.roi.width),
    y: clamp(candidate.y - prepared.padding + prepared.roi.y, prepared.roi.y, prepared.roi.y + prepared.roi.height),
  });
  return {
    ok: true,
    seed: toDocument(nearest),
    path: {
      points: simplified.map(toDocument),
      closed: false,
      pixelArea: 0,
      confidence: 0.82,
      centerlineAdjusted: true,
    },
  };
}

export function vectorizePixelBuffer(buffer: PixelBuffer, options: VectorizationOptions = {}): DetectedPath[] {
  return vectorizePixelBufferDetailed(buffer, options).paths;
}

export function nearestInkCentroid(
  buffer: PixelBuffer,
  point: VectorPoint,
  radius = 20,
): VectorPoint {
  const minX = clamp(Math.floor(point.x - radius), 0, buffer.width - 1);
  const minY = clamp(Math.floor(point.y - radius), 0, buffer.height - 1);
  const maxX = clamp(Math.ceil(point.x + radius), 0, buffer.width - 1);
  const maxY = clamp(Math.ceil(point.y + radius), 0, buffer.height - 1);
  const candidates: { x: number; y: number; weight: number }[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const radialDistance = Math.hypot(x - point.x, y - point.y);
      if (radialDistance > radius) continue;
      const index = (y * buffer.width + x) * 4;
      const red = buffer.data[index];
      const green = buffer.data[index + 1];
      const blue = buffer.data[index + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const inkStrength = Math.max(0, 128 - luminance) + Math.max(0, maximum - minimum - 70) * 0.75;
      if (buffer.data[index + 3] > 150 && inkStrength > 5) {
        candidates.push({ x, y, weight: inkStrength / (1 + radialDistance * 0.08) });
      }
    }
  }
  if (!candidates.length) return point;
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  return candidates.reduce(
    (sum, candidate) => ({
      x: sum.x + candidate.x * candidate.weight / total,
      y: sum.y + candidate.y * candidate.weight / total,
    }),
    { x: 0, y: 0 },
  );
}
