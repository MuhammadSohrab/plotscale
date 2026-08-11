const EPSILON = 1e-9;

export class GeometryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GeometryError";
    this.code = code;
    this.details = details;
  }
}

const finitePositive = (value) => Number.isFinite(value) && value > 0;

export function triangleAreaBySides(a, b, c) {
  if (![a, b, c].every(finitePositive)) {
    throw new GeometryError("INVALID_LENGTH", "All triangle sides must be greater than zero.");
  }
  if (a + b <= c || b + c <= a || c + a <= b) {
    throw new GeometryError(
      "INVALID_TRIANGLE",
      "These sides cannot form a triangle. The two shorter sides must exceed the longest side.",
    );
  }
  const semiperimeter = (a + b + c) / 2;
  return Math.sqrt(
    Math.max(
      0,
      semiperimeter
        * (semiperimeter - a)
        * (semiperimeter - b)
        * (semiperimeter - c),
    ),
  );
}

export function validatePolygonSides(sides, minimum = 3) {
  if (!Array.isArray(sides) || sides.length < minimum) {
    throw new GeometryError(
      "INSUFFICIENT_SIDES",
      `Enter at least ${minimum} sides.`,
    );
  }
  if (!sides.every(finitePositive)) {
    throw new GeometryError("INVALID_LENGTH", "Every side must be greater than zero.");
  }
  const perimeter = sides.reduce((total, side) => total + side, 0);
  const longest = Math.max(...sides);
  if (longest >= perimeter - longest) {
    throw new GeometryError(
      "INVALID_POLYGON",
      "The longest side is too long to form a closed plot.",
    );
  }
  return perimeter;
}

function angleFromSides(leftRadius, edge, rightRadius) {
  const denominator = 2 * leftRadius * rightRadius;
  const cosine = (
    leftRadius ** 2
    + rightRadius ** 2
    - edge ** 2
  ) / denominator;
  if (cosine < -1 - EPSILON || cosine > 1 + EPSILON) {
    throw new GeometryError(
      "INVALID_TRIANGULATION",
      "A diagonal is not compatible with the adjoining sides.",
    );
  }
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

export function buildFanVertices(sides, diagonals) {
  validatePolygonSides(sides);
  const expected = sides.length - 3;
  if (diagonals.length !== expected || !diagonals.every(finitePositive)) {
    throw new GeometryError(
      "DIAGONALS_REQUIRED",
      `Exactly ${expected} fan diagonal${expected === 1 ? "" : "s"} required.`,
    );
  }

  const radii = [
    sides[0],
    ...diagonals,
    sides.at(-1),
  ];
  const vertices = [{ x: 0, y: 0 }];
  let angle = 0;
  vertices.push({ x: radii[0], y: 0 });

  for (let index = 0; index < radii.length - 1; index += 1) {
    const edgeIndex = index + 1;
    angle += angleFromSides(radii[index], sides[edgeIndex], radii[index + 1]);
    if (angle >= (2 * Math.PI) - EPSILON) {
      throw new GeometryError(
        "SELF_INTERSECTING_FAN",
        "The supplied fan diagonals fold or overlap the polygon.",
      );
    }
    vertices.push({
      x: radii[index + 1] * Math.cos(angle),
      y: radii[index + 1] * Math.sin(angle),
    });
  }
  return vertices;
}

export function polygonArea(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0;
  return Math.abs(vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + (point.x * next.y) - (next.x * point.y);
  }, 0)) / 2;
}

export function calculateFanTriangulation(sides, diagonals) {
  const vertices = buildFanVertices(sides, diagonals);
  const radii = [sides[0], ...diagonals, sides.at(-1)];
  const triangles = [];
  for (let index = 0; index < sides.length - 2; index += 1) {
    const triangleSides = [
      radii[index],
      sides[index + 1],
      radii[index + 1],
    ];
    triangles.push({
      id: `T${index + 1}`,
      sidesMeters: triangleSides,
      areaSqm: triangleAreaBySides(...triangleSides),
    });
  }
  const areaSqm = triangles.reduce((total, triangle) => total + triangle.areaSqm, 0);
  return { vertices, triangles, areaSqm };
}

function maximizeQuadrilateralArea(sides) {
  const [a, b, c, d] = sides;
  let low = Math.max(Math.abs(a - b), Math.abs(c - d)) + EPSILON;
  let high = Math.min(a + b, c + d) - EPSILON;
  if (low >= high) {
    throw new GeometryError("INVALID_POLYGON", "These sides cannot form a quadrilateral.");
  }
  const areaAt = (diagonal) => {
    try {
      return triangleAreaBySides(a, b, diagonal)
        + triangleAreaBySides(c, d, diagonal);
    } catch {
      return 0;
    }
  };
  for (let iteration = 0; iteration < 90; iteration += 1) {
    const left = low + ((high - low) / 3);
    const right = high - ((high - low) / 3);
    if (areaAt(left) < areaAt(right)) low = left;
    else high = right;
  }
  const diagonal = (low + high) / 2;
  return {
    diagonal,
    areaSqm: areaAt(diagonal),
    vertices: buildFanVertices(sides, [diagonal]),
  };
}

function cyclicPolygonFromSides(sides) {
  validatePolygonSides(sides, 5);
  const longest = Math.max(...sides);
  let low = (longest / 2) + EPSILON;
  let high = Math.max(longest, sides.reduce((total, side) => total + side, 0));
  const angleSum = (radius) => sides.reduce(
    (total, side) => total + (2 * Math.asin(Math.min(1, side / (2 * radius)))),
    0,
  );
  while (angleSum(high) > 2 * Math.PI) high *= 2;
  if (angleSum(low) < 2 * Math.PI) {
    throw new GeometryError(
      "CYCLIC_ESTIMATE_UNAVAILABLE",
      "A stable cyclic estimate could not be produced for these sides.",
    );
  }
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (low + high) / 2;
    if (angleSum(middle) > 2 * Math.PI) low = middle;
    else high = middle;
  }
  const radius = (low + high) / 2;
  let angle = 0;
  const vertices = sides.map((side) => {
    const point = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
    angle += 2 * Math.asin(Math.min(1, side / (2 * radius)));
    return point;
  });
  return { vertices, areaSqm: polygonArea(vertices) };
}

export function calculateIrregularPlot(sides, diagonal = null, diagonalType = "C1_C3") {
  const perimeterM = validatePolygonSides(sides, 4);
  if (sides.length !== 4) {
    throw new GeometryError("FOUR_SIDES_REQUIRED", "Irregular Plot requires exactly four sides.");
  }
  if (finitePositive(diagonal)) {
    let exact;
    if (diagonalType === "C2_C4") {
      const rotatedSides = [sides[1], sides[2], sides[3], sides[0]];
      const res = calculateFanTriangulation(rotatedSides, [diagonal]);
      const rawVerts = res.vertices;
      const vertices = [rawVerts[3], rawVerts[0], rawVerts[1], rawVerts[2]];
      exact = {
        vertices,
        triangles: res.triangles,
        areaSqm: res.areaSqm,
      };
    } else {
      exact = calculateFanTriangulation(sides, [diagonal]);
    }
    return {
      mode: "irregular",
      method: diagonalType === "C2_C4" ? "fan_triangulation_corner_2" : "fan_triangulation_corner_1",
      exactness: "confirmed",
      warning: null,
      perimeterM,
      sideLengthsMeters: sides,
      diagonalsMeters: [diagonal],
      diagonalType,
      ...exact,
    };
  }
  const estimate = maximizeQuadrilateralArea(sides);
  return {
    mode: "irregular",
    method: "maximum_area_cyclic_assumption",
    exactness: "approximate",
    warning: "Four sides alone do not determine a unique plot. Select a diagonal on the sketch pad to get an exact survey area.",
    perimeterM,
    sideLengthsMeters: sides,
    diagonalsMeters: [],
    triangles: [],
    ...estimate,
  };
}

export function calculateCustomShape(sides, diagonals = []) {
  const perimeterM = validatePolygonSides(sides, 5);
  if (sides.length > 10) {
    throw new GeometryError("TOO_MANY_SIDES", "Custom Shape currently supports up to 10 sides.");
  }
  const expected = sides.length - 3;
  const hasAnyDiagonal = diagonals.some(finitePositive);
  const hasAllDiagonals = diagonals.length === expected && diagonals.every(finitePositive);
  if (hasAnyDiagonal && !hasAllDiagonals) {
    throw new GeometryError(
      "INCOMPLETE_DIAGONALS",
      `Enter all ${expected} fan diagonals or leave every diagonal blank for an approximate result.`,
    );
  }
  if (hasAllDiagonals) {
    const exact = calculateFanTriangulation(sides, diagonals);
    return {
      mode: "custom",
      method: "fan_triangulation_corner_1",
      exactness: "confirmed",
      warning: null,
      perimeterM,
      sideLengthsMeters: sides,
      diagonalsMeters: diagonals,
      ...exact,
    };
  }
  const estimate = cyclicPolygonFromSides(sides);
  return {
    mode: "custom",
    method: "maximum_area_cyclic_assumption",
    exactness: "approximate",
    warning: `${sides.length} sides alone do not determine a unique plot. This is a maximum-area cyclic estimate.`,
    perimeterM,
    sideLengthsMeters: sides,
    diagonalsMeters: [],
    triangles: [],
    ...estimate,
  };
}

export function calculateRegularShape(shape, inputs) {
  let areaSqm;
  let sideLengthsMeters;
  let vertices;
  if (shape === "square") {
    const [side] = inputs;
    if (!finitePositive(side)) throw new GeometryError("INVALID_LENGTH", "Enter a positive side.");
    areaSqm = side ** 2;
    sideLengthsMeters = Array(4).fill(side);
    vertices = [
      { x: 0, y: 0 },
      { x: side, y: 0 },
      { x: side, y: side },
      { x: 0, y: side },
    ];
  } else if (shape === "rectangle") {
    const [length, width] = inputs;
    if (![length, width].every(finitePositive)) {
      throw new GeometryError("INVALID_LENGTH", "Enter a positive length and width.");
    }
    areaSqm = length * width;
    sideLengthsMeters = [length, width, length, width];
    vertices = [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width },
    ];
  } else {
    const sideCount = shape === "pentagon" ? 5 : shape === "hexagon" ? 6 : null;
    const [side] = inputs;
    if (!sideCount || !finitePositive(side)) {
      throw new GeometryError("INVALID_REGULAR_SHAPE", "Choose a supported shape and positive side.");
    }
    areaSqm = (sideCount * side ** 2) / (4 * Math.tan(Math.PI / sideCount));
    sideLengthsMeters = Array(sideCount).fill(side);
    const radius = side / (2 * Math.sin(Math.PI / sideCount));
    vertices = Array.from({ length: sideCount }, (_, index) => {
      const angle = (-Math.PI / 2) + ((2 * Math.PI * index) / sideCount);
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
  }
  return {
    mode: "regular",
    shape,
    method: "regular_shape_formula",
    exactness: "confirmed",
    warning: null,
    areaSqm,
    perimeterM: sideLengthsMeters.reduce((total, side) => total + side, 0),
    sideLengthsMeters,
    diagonalsMeters: [],
    triangles: [],
    vertices,
  };
}

export function calculateTriangleRows(rows) {
  const triangles = rows.map((row, index) => {
    const sides = row.sidesMeters;
    return {
      id: row.id ?? `triangle-${index + 1}`,
      name: row.name?.trim() || `Triangle ${index + 1}`,
      sidesMeters: sides,
      areaSqm: triangleAreaBySides(...sides),
    };
  });
  return {
    mode: "triangles",
    method: "heron_sum",
    exactness: "confirmed",
    warning: null,
    areaSqm: triangles.reduce((total, triangle) => total + triangle.areaSqm, 0),
    perimeterM: triangles.reduce(
      (total, triangle) => total + triangle.sidesMeters.reduce((sum, side) => sum + side, 0),
      0,
    ),
    sideLengthsMeters: triangles.flatMap((triangle) => triangle.sidesMeters),
    diagonalsMeters: [],
    triangles,
    vertices: triangles.length === 1
      ? buildFanVertices(triangles[0].sidesMeters, [])
      : [],
  };
}

