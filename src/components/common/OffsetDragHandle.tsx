import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface OffsetPoint {
  x: number;
  y: number;
}

export interface OffsetVector {
  dx: number;
  dy: number;
}

export interface ContainerRectLike {
  width: number;
  height: number;
}

/**
 * Computes Angle Bisector (Interior 1/2 degree) handle offset relative to connected neighbor vertices.
 * If prevPoint and nextPoint are provided:
 *   Calculates the normalized angle bisector vector between (prevPoint - point) and (nextPoint - point).
 *   Places handle MAG (65px) along this bisector inside the corner angle.
 * Fallback:
 *   If only 1 neighbor is present (open polyline end), uses perpendicular normal vector.
 *   If no neighbors are provided, falls back to top/edge-aware offset.
 */
export function computeHandleOffset(
  point: OffsetPoint,
  containerRect?: ContainerRectLike | null,
  prevPoint?: OffsetPoint | null,
  nextPoint?: OffsetPoint | null,
  distance: number = 65
): OffsetVector {
  const MAG = distance;

  // 1. If both neighbors are present, compute the angle bisector (half-angle)
  if (prevPoint && nextPoint) {
    const v1x = prevPoint.x - point.x;
    const v1y = prevPoint.y - point.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = nextPoint.x - point.x;
    const v2y = nextPoint.y - point.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 > 0.001 && len2 > 0.001) {
      const u1x = v1x / len1;
      const u1y = v1y / len1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;

      const bx = u1x + u2x;
      const by = u1y + u2y;
      const blen = Math.hypot(bx, by);

      if (blen > 0.001) {
        // Bisector vector pointing between both lines (1/2 angle interior direction)
        const nx = bx / blen;
        const ny = by / blen;
        return { dx: Math.round(nx * MAG), dy: Math.round(ny * MAG) };
      } else {
        // Collinear / 180° straight line: use perpendicular normal
        return { dx: Math.round(-u1y * MAG), dy: Math.round(u1x * MAG) };
      }
    }
  }

  // 2. If only one neighbor is present (e.g. open line endpoint)
  const singleNeighbor = prevPoint || nextPoint;
  if (singleNeighbor) {
    const vx = singleNeighbor.x - point.x;
    const vy = singleNeighbor.y - point.y;
    const len = Math.hypot(vx, vy);
    if (len > 0.001) {
      const ux = vx / len;
      const uy = vy / len;
      // Perpendicular normal
      return { dx: Math.round(-uy * MAG), dy: Math.round(ux * MAG) };
    }
  }

  // 3. Fallback to default / edge-aware
  if (containerRect && containerRect.width && containerRect.height) {
    const distTop = point.y;
    const distBottom = containerRect.height - point.y;
    const distLeft = point.x;
    const distRight = containerRect.width - point.x;
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    if (minDist === distTop) return { dx: 0, dy: MAG };
    if (minDist === distBottom) return { dx: 0, dy: -MAG };
    if (minDist === distLeft) return { dx: MAG, dy: 0 };
    return { dx: -MAG, dy: 0 };
  }

  return { dx: 0, dy: -MAG };
}

export interface OffsetDragHandleOverlayProps {
  point: OffsetPoint | null;
  prevPoint?: OffsetPoint | null;
  nextPoint?: OffsetPoint | null;
  containerRect?: ContainerRectLike | null;
  distance?: number;
  onDragStart?: () => void;
  onDrag?: (delta: { dx: number; dy: number; clientX: number; clientY: number }) => void;
  onDragEnd?: () => void;
  onDeselect?: () => void;
  handleColor?: string;
  connectorColor?: string;
  zIndex?: number;
}

/**
 * Reusable HTML/SVG Offset Drag Handle Overlay.
 */
export const OffsetDragHandleOverlay: React.FC<OffsetDragHandleOverlayProps> = ({
  point,
  prevPoint,
  nextPoint,
  containerRect,
  distance = 65,
  onDragStart,
  onDrag,
  onDragEnd,
  onDeselect,
  handleColor = '#2563eb',
  connectorColor = '#3b82f6',
  zIndex = 40,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ clientX: 0, clientY: 0, pointX: 0, pointY: 0 });
  const isDraggingRef = useRef(false);
  const callbacksRef = useRef({ onDragStart, onDrag, onDragEnd, onDeselect });
  const [offsetVec, setOffsetVec] = useState<OffsetVector>({ dx: 0, dy: -65 });

  useEffect(() => {
    callbacksRef.current = { onDragStart, onDrag, onDragEnd, onDeselect };
  });

  // Recompute offset when point, neighbors, or container changes while not dragging
  useEffect(() => {
    if (!isDraggingRef.current && point) {
      setOffsetVec(computeHandleOffset(point, containerRect, prevPoint, nextPoint, distance));
    }
  }, [
    point?.x,
    point?.y,
    prevPoint?.x,
    prevPoint?.y,
    nextPoint?.x,
    nextPoint?.y,
    containerRect?.width,
    containerRect?.height,
    distance,
  ]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    isDraggingRef.current = true;
    setIsDragging(true);

    const clientX = e.clientX;
    const clientY = e.clientY;

    dragStartRef.current = {
      clientX,
      clientY,
      pointX: point?.x || 0,
      pointY: point?.y || 0,
    };

    callbacksRef.current.onDragStart?.();
  }, [point]);

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (!isDraggingRef.current) return;
      const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0]?.clientX) ?? 0;
      const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0]?.clientY) ?? 0;
      const dx = clientX - dragStartRef.current.clientX;
      const dy = clientY - dragStartRef.current.clientY;

      callbacksRef.current.onDrag?.({ dx, dy, clientX, clientY });
    };

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      callbacksRef.current.onDragEnd?.();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp, { passive: true });
    window.addEventListener('mouseup', handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, []);

  if (!point) return null;

  const handleX = point.x + offsetVec.dx;
  const handleY = point.y + offsetVec.dy;

  return (
    <div
      className="offset-drag-handle-overlay pointer-events-none absolute inset-0 select-none"
      style={{ zIndex, overflow: 'visible' }}
    >
      {/* SVG for Dotted Connector Line */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ overflow: 'visible' }}
      >
        <line
          x1={point.x}
          y1={point.y}
          x2={handleX}
          y2={handleY}
          stroke={connectorColor}
          strokeWidth="1.8"
          strokeDasharray="4 3"
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* Small anchor dot at handle connection */}
        <circle cx={handleX} cy={handleY} r="2.5" fill={connectorColor} />
      </svg>

      {/* Draggable Handle Button */}
      <div
        className={`pointer-events-auto absolute flex items-center justify-center rounded-full shadow-lg transition-transform ${
          isDragging ? 'scale-110 ring-4 ring-blue-400/40 cursor-grabbing' : 'hover:scale-105 cursor-grab active:scale-95'
        }`}
        style={{
          left: `${handleX}px`,
          top: `${handleY}px`,
          width: '36px',
          height: '36px',
          transform: 'translate(-50%, -50%)',
          backgroundColor: handleColor,
          border: '2.5px solid #ffffff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.28)',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        title="Drag point handle"
        role="button"
        aria-label="Drag point handle"
      >
        {/* 4-Way Move Arrows Glyph */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="5 9 2 12 5 15" />
          <polyline points="9 5 12 2 15 5" />
          <polyline points="15 19 12 22 9 19" />
          <polyline points="19 9 22 12 19 15" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="12" y1="2" x2="12" y2="22" />
        </svg>
      </div>
    </div>
  );
};

export default OffsetDragHandleOverlay;
