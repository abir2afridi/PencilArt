import type { Point } from "./types";

/**
 * A faithful port of Excalidraw's laser-pointer package (the engine behind
 * the eraser's animated trail). A swept ribbon whose width varies per point,
 * drawn as a closed polygon outline with rounded caps and corner detection.
 */

const add = ([ax, ay, ar]: Point, [bx, by, br]: Point): Point => [
  ax + bx,
  ay + by,
  ar + br,
];

const sub = ([ax, ay, ar]: Point, [bx, by, br]: Point): Point => [
  ax - bx,
  ay - by,
  ar - br,
];

const smul = ([x, y, r]: Point, s: number): Point => [x * s, y * s, r * s];

const norm = ([x, y, r]: Point): Point => {
  const m = Math.sqrt(x ** 2 + y ** 2);
  return m === 0 ? [0, 0, r] : [x / m, y / m, r];
};

const rot = ([x, y, r]: Point, rad: number): Point => [
  Math.cos(rad) * x - Math.sin(rad) * y,
  Math.sin(rad) * x + Math.cos(rad) * y,
  r,
];

/** Point b pulled part of the way toward point a — Excalidraw's streamline. */
export const plerp = (a: Point, b: Point, t: number): Point =>
  add(a, smul(sub(b, a), t));

const angle = (p: Point, p1: Point, p2: Point) =>
  Math.atan2(p2[1] - p[1], p2[0] - p[0]) - Math.atan2(p1[1] - p[1], p1[0] - p[0]);

const normAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const mag = ([x, y]: Point) => Math.sqrt(x ** 2 + y ** 2);

const dist = ([ax, ay]: Point, [bx, by]: Point) =>
  Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);

/** Excalidraw's easeOut, used by the eraser trail's per-point decay. */
export const easeOut = (k: number) => 1 - Math.pow(1 - k, 4);

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function distancePointToSegment(p3: Point, p1: Point, p2: Point) {
  const sMag = dist(p1, p2);
  if (sMag === 0) return dist(p3, p1);
  const u = clamp(
    ((p3[0] - p1[0]) * (p2[0] - p1[0]) + (p3[1] - p1[1]) * (p2[1] - p1[1])) /
      sMag ** 2,
    0,
    1,
  );
  const pi: Point = [
    p1[0] + u * (p2[0] - p1[0]),
    p1[1] + u * (p2[1] - p1[1]),
    p3[2],
  ];
  return dist(pi, p3);
}

/** Ramer–Douglas–Peucker, Excalidraw's simplification for the outline. */
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (epsilon === 0) return points;
  if (points.length <= 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const [maxDistance, maxIndex] = points.reduce(
    ([maxDistance, maxIndex], point, index) => {
      const distance = distancePointToSegment(point, first, last);
      return distance > maxDistance ? [distance, index] : [maxDistance, maxIndex];
    },
    [0, -1] as [number, number],
  );
  if (maxDistance >= epsilon) {
    const maxIndexPoint = points[maxIndex];
    return [
      ...douglasPeucker(
        [first, ...points.slice(1, maxIndex), maxIndexPoint],
        epsilon,
      ).slice(0, -1),
      maxIndexPoint,
      ...douglasPeucker(
        [maxIndexPoint, ...points.slice(maxIndex, -1), last],
        epsilon,
      ).slice(1),
    ];
  }
  return [first, last];
}

const CORNER_MAX_ANGLE = (75 / 180) * Math.PI;
const cornerVariance = (speed: number) => (speed > 35 ? 0.5 : 1);

/**
 * The closed outline of a swept ribbon, Excalidraw's
 * LaserPointer.getStrokeOutline. Each point carries its own half-width in
 * `r`, which is how the eraser's tail tapers and melts with time. `keepHead`
 * caps the ribbon with a full-width circle at the tip — the cursor dot that
 * survives while the rest of the trail drains away.
 */
export function trailOutline(
  points: Point[],
  keepHead: boolean,
  headSize: number,
): Point[] {
  const len = points.length;

  if (len === 0) return [];
  if (len === 1) {
    const c = points[0];
    const size = c[2];
    if (size < 0.5) return [];
    const ps: Point[] = [];
    for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) {
      ps.push(add(c, smul(rot([1, 0, 0], theta), size)));
    }
    ps.push(add(c, smul([1, 0, 0], size)));
    return ps;
  }
  if (len === 2) {
    const c = points[0];
    const n = points[1];
    const cSize = c[2];
    const nSize = n[2];
    if (cSize < 0.5 || nSize < 0.5) return [];
    const ps: Point[] = [];
    const pAngle = angle(c, [c[0], c[1] - 100, c[2]], n);
    for (let theta = pAngle; theta <= Math.PI + pAngle; theta += Math.PI / 16) {
      ps.push(add(c, smul(rot([1, 0, 0], theta), cSize)));
    }
    for (
      let theta = Math.PI + pAngle;
      theta <= Math.PI * 2 + pAngle;
      theta += Math.PI / 16
    ) {
      ps.push(add(n, smul(rot([1, 0, 0], theta), nSize)));
    }
    ps.push(ps[0]);
    return ps;
  }

  const forwardPoints: Point[] = [];
  const backwardPoints: Point[] = [];
  let speed = 0;
  let prevSpeed = 0;
  let visibleStartIndex = 0;
  let runningLength = 0;

  for (let i = 1; i < len - 1; i++) {
    const p = points[i - 1];
    const c = points[i];
    const n = points[i + 1];

    const d = dist(p, c);
    runningLength += d;
    speed = prevSpeed + (d - prevSpeed) * 0.2;

    const cSize = c[2];
    if (cSize === 0) {
      visibleStartIndex = i + 1;
      continue;
    }

    const dirPC = norm(sub(p, c));
    const dirNC = norm(sub(n, c));
    const p1dirPC = rot(dirPC, Math.PI / 2);
    const p2dirPC = rot(dirPC, -Math.PI / 2);
    const p1dirNC = rot(dirNC, Math.PI / 2);
    const p2dirNC = rot(dirNC, -Math.PI / 2);

    const p1PC = add(c, smul(p1dirPC, cSize));
    const p2PC = add(c, smul(p2dirPC, cSize));
    const p1NC = add(c, smul(p1dirNC, cSize));
    const p2NC = add(c, smul(p2dirNC, cSize));

    const ftdir = add(p1dirPC, p2dirNC);
    const btdir = add(p2dirPC, p1dirNC);

    const paPC = add(c, smul(mag(ftdir) === 0 ? dirPC : norm(ftdir), cSize));
    const paNC = add(c, smul(mag(btdir) === 0 ? dirNC : norm(btdir), cSize));

    const cAngle = normAngle(angle(c, p, n));
    const D_ANGLE = CORNER_MAX_ANGLE * cornerVariance(speed);

    if (Math.abs(cAngle) < D_ANGLE) {
      const tAngle = Math.abs(normAngle(Math.PI - cAngle));
      if (tAngle === 0) continue;

      if (cAngle < 0) {
        backwardPoints.push(p2PC, paNC);
        for (let theta = 0; theta <= tAngle; theta += tAngle / 4) {
          forwardPoints.push(add(c, rot(smul(p1dirPC, cSize), theta)));
        }
        for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) {
          backwardPoints.push(add(c, rot(smul(p1dirPC, cSize), theta)));
        }
        backwardPoints.push(paNC, p1NC);
      } else {
        forwardPoints.push(p1PC, paPC);
        for (let theta = 0; theta <= tAngle; theta += tAngle / 4) {
          backwardPoints.push(add(c, rot(smul(p1dirPC, -cSize), -theta)));
        }
        for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) {
          forwardPoints.push(add(c, rot(smul(p1dirPC, -cSize), -theta)));
        }
        forwardPoints.push(paPC, p2NC);
      }
    } else {
      forwardPoints.push(paPC);
      backwardPoints.push(paNC);
    }

    prevSpeed = speed;
  }

  if (visibleStartIndex >= len - 2) {
    if (keepHead) {
      const c = points[len - 1];
      const ps: Point[] = [];
      for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) {
        ps.push(add(c, smul(rot([1, 0, 0], theta), headSize)));
      }
      ps.push(add(c, smul([1, 0, 0], headSize)));
      return ps;
    }
    return [];
  }

  const first = points[visibleStartIndex];
  const second = points[visibleStartIndex + 1];
  const penultimate = points[len - 2];
  const ultimate = points[len - 1];

  const dirFS = norm(sub(second, first));
  const dirPU = norm(sub(penultimate, ultimate));

  const ppdirFS = rot(dirFS, -Math.PI / 2);
  const ppdirPU = rot(dirPU, Math.PI / 2);

  const startCapSize = first[2];
  const startCap: Point[] = [];

  const endCapSize = keepHead ? headSize : penultimate[2];
  const endCap: Point[] = [];

  if (startCapSize > 0.1) {
    for (let theta = 0; theta <= Math.PI; theta += Math.PI / 16) {
      startCap.unshift(add(first, rot(smul(ppdirFS, startCapSize), -theta)));
    }
    startCap.unshift(add(first, smul(ppdirFS, -startCapSize)));
  } else {
    startCap.push(first);
  }

  for (let theta = 0; theta <= Math.PI * 3; theta += Math.PI / 16) {
    endCap.push(add(ultimate, rot(smul(ppdirPU, -endCapSize), -theta)));
  }

  const strokeOutline = [
    ...startCap,
    ...forwardPoints,
    ...endCap.reverse(),
    ...backwardPoints.reverse(),
  ];

  if (startCap.length > 0) {
    strokeOutline.push(startCap[0]);
  }

  return douglasPeucker(strokeOutline, 0.1);
}