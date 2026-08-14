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
 * Computes edge-aware handle offset relative to containerRect.
 * Nearest edge = top    -> dy = +70 (below)
 * Nearest edge = bottom -> dy = -70 (above)
 * Nearest edge = left   -> dx = +70 (to right)
 * Nearest edge = right  -> dx = -70 (to left)
 */
export function computeHandleOffset(point: OffsetPoint, containerRect?: ContainerRectLike | null): OffsetVector {
  if (!containerRect || !containerRect.width || !containerRect.height) {
    return { dx: 0, dy: -70 }; // default above
  }
  const distTop = point.y;
  const distBottom = containerRect.height - point.y;
  const distLeft = point.x;
  const distRight = containerRect.width - point.x;
  const minDist = Math.min(distTop, distBottom, distLeft, distRight);
  const MAG = 70;

  if (minDist === distTop) return { dx: 0, dy: MAG };
  if (minDist === distBottom) return { dx: 0, dy: -MAG };
  if (minDist === distLeft) return { dx: MAG, dy: 0 };
  return { dx: -MAG, dy: 0 };
}

export interface OffsetDragHandleOverlayProps {
  point: OffsetPoint | null;
  containerRect?: ContainerRectLike | null;
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
  containerRect,
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
  const [offsetVec, setOffsetVec] = useState<OffsetVector>({ dx: 0, dy: -70 });

  useEffect(() => {
    callbacksRef.current = { onDragStart, onDrag, onDragEnd, onDeselect };
  });

  // Recompute offset when point or container changes while not dragging
  useEffect(() => {
    if (!isDraggingRef.current && point && containerRect) {
      setOffsetVec(computeHandleOffset(point, containerRect));
    }
  }, [point?.x, point?.y, containerRect?.width, containerRect?.height]);

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
