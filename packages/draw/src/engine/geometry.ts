import { getStroke } from "./freehand";
import { PEN_BY_ID } from "./pens";
import { SHAPE_BY_ID } from "./shapes";
import type {
  Box,
  FigureDash,
  FigureMarkup,
  PenId,
  Point,
  Shape,
  ShapeKind,
  Stroke,
  StrokeShape,
} from "./types";

/** Turn a stroke's rings into an SVG path. */
export function getSvgPathFromStroke(rings: number[][][]): string {
  let d = "";
  for (const ring of rings) {
    if (ring.length < 3) continue;
    d += `M${r(ring[0][0])},${r(ring[0][1])}`;
    for (let i = 1; i < ring.length; i++)
      d += `L${r(ring[i][0])},${r(ring[i][1])}`;
    d += "Z";
  }
  return d;
}

function r(n: number) {
  return Math.round(n * 10) / 10;
}

/** Exponential smoothing, on the same scale the stroke engine uses. */
export function streamline(points: Point[], amount: number): Point[] {
  if (points.length < 3 || amount <= 0) return points;
  const t = 0.15 + (1 - amount) * 0.85;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[i - 1];
    const p = points[i];
    out.push([
      prev[0] + (p[0] - prev[0]) * t,
      prev[1] + (p[1] - prev[1]) * t,
      p[2],
    ]);
  }
  return out;
}

/** Build the filled outline path for a finished or in-progress stroke. */
export function strokePath(
  pen: PenId,
  size: number,
  points: Point[],
  isComplete = true,
  shape?: StrokeShape,
): string {
  const preset = PEN_BY_ID[pen];

  const opts = preset.options(size);

  const outline = getStroke(points, {
    ...opts,
    ...(shape?.simulatePressure === undefined
      ? null
      : { simulatePressure: shape.simulatePressure }),
    // A taper override replaces the preset's own, at both ends.
    ...(shape?.taper === undefined
      ? null
      : { taperStart: shape.taper, taperEnd: shape.taper }),
    ...(shape?.nibAngle === undefined ? null : { nibAngle: shape.nibAngle }),
    last: isComplete,
  });
  return getSvgPathFromStroke(outline);
}

/**
 * Radius to draw for a tap / stroke too short to produce an outline, so a
 * deliberate dot is never silently lost.
 */
export function dotRadius(size: number): number {
  return Math.max(0.75, size / 2);
}

let counter = 0;
/** Monotonic stroke id. Only needs to be unique within a session. */
export const nextId = () => ++counter;

/** A smoothed polyline through the raw points. */
export function polylinePath(points: Point[]): string {
  if (points.length === 0) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  if (points.length === 1) {
    return `M${r(points[0][0])} ${r(points[0][1])} l0.01 0.01`;
  }
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2;
    const my = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q${r(points[i][0])} ${r(points[i][1])} ${r(mx)} ${r(my)}`;
  }
  const last = points[points.length - 1];
  d += ` L${r(last[0])} ${r(last[1])}`;
  return d;
}

/**
 * The two anchors of a figure drag, normalised into a `Shape`. Each shape
 * tool owns its own straight-drag rule; when `straight` is held it squares
 * the rect and ellipse, and locks the line and arrow to the nearest of the
 * eight compass directions.
 */
export function anchorsToShape(
  kind: ShapeKind,
  a: Point,
  b: Point,
  straight = false,
): Shape {
  let w = b[0] - a[0];
  let h = b[1] - a[1];

  if (straight) ({ w, h } = SHAPE_BY_ID[kind].snap(w, h));

  return {
    kind,
    x: w < 0 ? a[0] + w : a[0],
    y: h < 0 ? a[1] + h : a[1],
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

/** The SVG markup for a figure: the stroked outline, and for an arrow the
    filled head that sits on top of it. */
export function figureMarkup(shape: Shape, size: number): FigureMarkup {
  return SHAPE_BY_ID[shape.kind].figure(shape, size);
}

/**
 * Split a drawing into layers that each need the same set of eraser
 * passes.
 */
export function eraseLayers(
  strokes: { erase?: boolean }[],
): { ink: number[]; erasers: number[] }[] {
  const eraserIndices = strokes
    .map((s, i) => (s.erase ? i : -1))
    .filter((i) => i >= 0);

  const layers: { ink: number[]; erasers: number[] }[] = [];
  let ink: number[] = [];

  strokes.forEach((s, i) => {
    if (s.erase) {
      if (ink.length) {
        layers.push({ ink, erasers: eraserIndices.filter((e) => e > i - 1) });
        ink = [];
      }
      return;
    }
    ink.push(i);
  });
  if (ink.length) layers.push({ ink, erasers: [] });
  return layers;
}

/** The axis-aligned box an element occupies on the board, rotation ignored. */
export function boundsOf(stroke: Stroke): Box {
  if (stroke.figure) {
    const { x, y, w, h } = stroke.figure;
    return { x, y, w, h };
  }
  if (stroke.image) {
    const [x, y] = stroke.points[0] ?? [0, 0];
    return { x, y, w: stroke.image.w, h: stroke.image.h };
  }
  if (stroke.text) {
    const [x, y] = stroke.points[0] ?? [0, 0];
    return { x, y, w: stroke.text.w, h: stroke.text.h };
  }
  if (stroke.points.length === 1) {
    const [x, y] = stroke.points[0];
    const r = dotRadius(stroke.size);
    return { x: x - r, y: y - r, w: r * 2, h: r * 2 };
  }
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const [x, y] of stroke.points) {
    if (x < x1) x1 = x;
    if (y < y1) y1 = y;
    if (x > x2) x2 = x;
    if (y > y2) y2 = y;
  }
  if (!Number.isFinite(x1)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Move an element by dx,dy, whatever it is made of. */
export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  if (stroke.figure) {
    return {
      ...stroke,
      figure: { ...stroke.figure, x: stroke.figure.x + dx, y: stroke.figure.y + dy },
    };
  }
  if (stroke.image || stroke.text) {
    const p0 = stroke.points[0] ?? [0, 0, 0.5];
    return { ...stroke, points: [[p0[0] + dx, p0[1] + dy, p0[2]]] };
  }
  return { ...stroke, points: stroke.points.map((p) => [p[0] + dx, p[1] + dy, p[2]]) };
}

/** The box that covers every element. */
export function unionBounds(strokes: Stroke[]): Box {
  let box: Box | null = null;
  for (const s of strokes) {
    const b = boundsOf(s);
    if (!box) {
      box = { ...b };
      continue;
    }
    const x2 = Math.max(box.x + box.w, b.x + b.w);
    const y2 = Math.max(box.y + box.h, b.y + b.h);
    box.x = Math.min(box.x, b.x);
    box.y = Math.min(box.y, b.y);
    box.w = x2 - box.x;
    box.h = y2 - box.y;
  }
  return box ?? { x: 0, y: 0, w: 0, h: 0 };
}

/** Rotate a point about a centre, by degrees clockwise. */
export function rotateAbout(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deg: number,
): [number, number] {
  if (!deg) return [x, y];
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos];
}

/** The centre of a box. */
export function centreOf(b: Box): [number, number] {
  return [b.x + b.w / 2, b.y + b.h / 2];
}

/** Whether a point sits inside a box, with a little room. */
export function inBox(x: number, y: number, b: Box, pad = 0): boolean {
  return (
    x >= b.x - pad &&
    y >= b.y - pad &&
    x <= b.x + b.w + pad &&
    y <= b.y + b.h + pad
  );
}

/** Distance from a point to a segment. */
function segDistance(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x - ax, y - ay);
  let t = ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

/**
 * Whether a board point lands on a committed mark, rotation included. `tol`
 * is the picking room in board units, before the mark's own thickness.
 */
export function hitTest(stroke: Stroke, x: number, y: number, tol = 8): boolean {
  if (stroke.erase) return false;

  // Rotated elements answer the query in their own, unrotated space.
  if (stroke.rotate) {
    const b = boundsOf(stroke);
    const [cx, cy] = centreOf(b);
    [x, y] = rotateAbout(x, y, cx, cy, -stroke.rotate);
  }

  const room = tol + stroke.size / 2 + 2;

  if (stroke.figure) {
    const { kind, x: fx, y: fy, w, h } = stroke.figure;
    if (kind === "line" || kind === "arrow" || kind === "double-arrow") {
      return segDistance(x, y, fx, fy, fx + w, fy + h) <= room;
    }
    return inBox(x, y, { x: fx, y: fy, w, h }, room);
  }

  if (stroke.image || stroke.text) {
    const b = boundsOf(stroke);
    return inBox(x, y, b, room);
  }

  if (stroke.points.length === 1) {
    const [px, py] = stroke.points[0];
    return Math.hypot(x - px, y - py) <= dotRadius(stroke.size) + tol;
  }

  for (const [px, py] of stroke.points) {
    if (Math.hypot(x - px, y - py) <= room) return true;
  }
  return false;
}

/** The marks a marquee box picks up: those whose own box it touches. */
export function marqueeHits(strokes: Stroke[], box: Box): Stroke[] {
  return strokes.filter((s) => {
    if (s.erase || s.locked) return false;
    const b = boundsOf(s);
    return (
      b.x < box.x + box.w &&
      b.x + b.w > box.x &&
      b.y < box.y + box.h &&
      b.y + b.h > box.y
    );
  });
}

/** The dash pattern for a line style, or nothing for solid. */
export function dashArray(dash?: FigureDash): string | undefined {
  if (dash === "dash") return "9 7";
  if (dash === "dot") return "2.5 6";
  return undefined;
}

/** Line height for a text mark at a given font size. */
export function lineHeight(size: number): number {
  return size * 1.35;
}
