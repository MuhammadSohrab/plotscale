import React, { type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

/**
 * Returns a standalone SVG Data URI for Google Maps or image markers.
 * Exact Spec: 16x16px, 13px diameter ring, 1.3px stroke, 4 red tick marks (1.1px stroke, #ef4444), 1x1 white center dot.
 */
export function getCrosshairSvgUrl(strokeColor: string = '#22c55e'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <circle cx="8" cy="8" r="6.5" fill="none" stroke="${strokeColor}" stroke-width="1.3"/>
  <line x1="8" y1="0"  x2="8" y2="4"  stroke="#ef4444" stroke-width="1.1"/>
  <line x1="8" y1="12" x2="8" y2="16" stroke="#ef4444" stroke-width="1.1"/>
  <line x1="0" y1="8"  x2="4" y2="8"  stroke="#ef4444" stroke-width="1.1"/>
  <line x1="12" y1="8" x2="16" y2="8" stroke="#ef4444" stroke-width="1.1"/>
  <rect x="7.5" y="7.5" width="1" height="1" fill="#ffffff"/>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export interface CrosshairPointMarkerProps {
  key?: React.Key;
  cx?: number;
  cy?: number;
  scale?: number;
  color?: string;
  selected?: boolean;
  isArmed?: boolean;
  label?: string;
  labelPosition?: 'auto' | 'top' | 'bottom';
  onClick?: (event: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (event: PointerEvent<SVGGElement>) => void;
  onContextMenu?: (event: MouseEvent<SVGGElement>) => void;
  className?: string;
  style?: CSSProperties;
  touchRadius?: number;
}

/**
 * Reusable SVG Crosshair Point Marker.
 * 
 * Renders the exact crosshair specification inside an SVG context:
 * - 16x16px visual at 1x scale (adjusts stroke/radius by scale so on-screen size remains crisp and constant if desired).
 * - 44x44px invisible touch target for accessible and reliable mobile tapping.
 * - Optional label tag (e.g. "C1", "P1", "V1").
 */
export const CrosshairPointMarker: React.FC<CrosshairPointMarkerProps> = ({
  cx = 0,
  cy = 0,
  scale = 1,
  color = '#22c55e',
  selected = false,
  isArmed = false,
  label = '',
  labelPosition = 'auto',
  onClick,
  onPointerDown,
  onContextMenu,
  className = '',
  style = {},
  touchRadius = 22,
}) => {
  const s = Math.max(scale, 0.001);
  const strokeW = 1.3 / s;
  const tickStrokeW = 1.1 / s;
  const ringR = 6.5 / s;
  const tickInner = 4 / s;
  const tickOuter = 8 / s;
  const dotSize = 1 / s;
  const hitR = touchRadius / s;

  const showLabel = Boolean(label);
  const isLabelBelow = labelPosition === 'bottom' || (labelPosition === 'auto' && cy <= 160);
  const labelY = isLabelBelow ? cy + 18 / s : cy - 12 / s;

  return (
    <g
      className={`crosshair-point-marker ${selected ? 'is-selected' : ''} ${isArmed ? 'is-armed' : ''} ${className}`}
      style={{ cursor: 'pointer', ...style }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      {/* 44x44px (~22px radius) invisible touch / click hitbox */}
      <circle
        cx={cx}
        cy={cy}
        r={hitR}
        fill="transparent"
        stroke="transparent"
        style={{ pointerEvents: 'all' }}
      />

      {/* Selected Halo / Glow */}
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={10 / s}
          fill="none"
          stroke={color}
          strokeWidth={2 / s}
          strokeDasharray={`${3 / s} ${3 / s}`}
          opacity={0.8}
        />
      )}

      {/* Thin circular ring: ~13px diameter (6.5px radius), stroke 1.3px, transparent fill */}
      <circle
        cx={cx}
        cy={cy}
        r={ringR}
        fill="none"
        stroke={selected ? '#3b82f6' : color}
        strokeWidth={strokeW}
        style={{ pointerEvents: 'none' }}
      />

      {/* Four short red tick lines pointing toward center */}
      {/* Top */}
      <line
        x1={cx}
        y1={cy - tickOuter}
        x2={cx}
        y2={cy - tickInner}
        stroke="#ef4444"
        strokeWidth={tickStrokeW}
        strokeLinecap="square"
        style={{ pointerEvents: 'none' }}
      />
      {/* Bottom */}
      <line
        x1={cx}
        y1={cy + tickInner}
        x2={cx}
        y2={cy + tickOuter}
        stroke="#ef4444"
        strokeWidth={tickStrokeW}
        strokeLinecap="square"
        style={{ pointerEvents: 'none' }}
      />
      {/* Left */}
      <line
        x1={cx - tickOuter}
        y1={cy}
        x2={cx - tickInner}
        y2={cy}
        stroke="#ef4444"
        strokeWidth={tickStrokeW}
        strokeLinecap="square"
        style={{ pointerEvents: 'none' }}
      />
      {/* Right */}
      <line
        x1={cx + tickInner}
        y1={cy}
        x2={cx + tickOuter}
        y2={cy}
        stroke="#ef4444"
        strokeWidth={tickStrokeW}
        strokeLinecap="square"
        style={{ pointerEvents: 'none' }}
      />

      {/* 1x1px solid white dot at exact center */}
      <rect
        x={cx - dotSize / 2}
        y={cy - dotSize / 2}
        width={dotSize}
        height={dotSize}
        fill="#ffffff"
        style={{ pointerEvents: 'none' }}
      />

      {/* Optional Label */}
      {showLabel && (
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          fill="#0f172a"
          fontSize={11 / s}
          fontWeight="bold"
          style={{ pointerEvents: 'none', userSelect: 'none', filter: 'drop-shadow(0 1px 2px rgba(255,255,255,0.9))' }}
        >
          {label}
        </text>
      )}
    </g>
  );
};

export default CrosshairPointMarker;
