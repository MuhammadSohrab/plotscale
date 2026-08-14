import { CrosshairPointMarker } from "../common/PointMarker";

function fitVertices(vertices, width, height, padding = 42) {
  const xs = vertices.map((point) => point.x);
  const ys = vertices.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (width - (2 * padding)) / Math.max(maxX - minX, 1e-9),
    (height - (2 * padding)) / Math.max(maxY - minY, 1e-9),
  );
  return vertices.map((point) => ({
    x: padding + ((point.x - minX) * scale),
    y: padding + ((point.y - minY) * scale),
  }));
}

export function PlotDiagram({
  vertices = [],
  sideLabels = [],
  diagonalPairs = [],
  schematic = false,
}) {
  if (vertices.length < 3) return null;
  const width = 640;
  const height = 360;
  const points = fitVertices(vertices, width, height);
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <figure className="plot-diagram">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plot measurement diagram">
        <polygon className="plot-diagram__shape" points={polygon} />
        {diagonalPairs.map(([from, to]) => points[from] && points[to] && (
          <line
            className="plot-diagram__diagonal"
            key={`${from}-${to}`}
            x1={points[from].x}
            y1={points[from].y}
            x2={points[to].x}
            y2={points[to].y}
          />
        ))}
        {points.map((point, index) => {
          const next = points[(index + 1) % points.length];
          return (
            <g key={`point-${index}`}>
              <CrosshairPointMarker cx={point.x} cy={point.y} scale={1} color="#22c55e" />
              <text className="plot-diagram__point-label" x={point.x + 10} y={point.y - 10}>
                P{index + 1}
              </text>
              {sideLabels[index] && (
                <text
                  className="plot-diagram__side-label"
                  x={(point.x + next.x) / 2}
                  y={((point.y + next.y) / 2) - 8}
                  textAnchor="middle"
                >
                  {sideLabels[index]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {schematic && <figcaption>Schematic preview — the displayed area uses the stated approximation.</figcaption>}
    </figure>
  );
}

