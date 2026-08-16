import { getStroke } from "./freehand";
import { PEN_BY_ID } from "./pens";
import type { PenId, Point, Shape, ShapeKind, StrokeShape } from "./types";

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
 * The two anchors of a figure drag, normalised into a `Shape`. When `straight`
 * is held, rectangles and ellipses are constrained to a square, and lines and
 * arrows to the nearest of the eight compass directions.
 */
export function anchorsToShape(
  kind: ShapeKind,
  a: Point,
  b: Point,
  straight = false,
): Shape {
  let w = b[0] - a[0];
  let h = b[1] - a[1];

  if (straight) {
    if (kind === "rect" || kind === "ellipse") {
      // The longer leg rules, the way a camera's crop square behaves.
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * s;
      h = Math.sign(h || 1) * s;
    } else {
      const len = Math.hypot(w, h);
      if (len > 0) {
        const heading =
          (Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI) / 4;
        w = Math.cos(heading) * len;
        h = Math.sin(heading) * len;
      }
    }
  }

  return {
    kind,
    x: w < 0 ? a[0] + w : a[0],
    y: h < 0 ? a[1] + h : a[1],
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

/**
 * The SVG markup for a figure: the stroked outline, and for an arrow the
 * filled head that sits on top of it.
 */
export function figureMarkup(
  shape: Shape,
  size: number,
): { d: string; head?: string } {
  const { kind, x, y, w, h } = shape;

  switch (kind) {
    case "rect":
      return { d: `M${r(x)} ${r(y)}h${r(w)}v${r(h)}h${r(-w)}Z` };

    case "ellipse": {
      const rx = w / 2;
      const ry = h / 2;
      const cx = x + rx;
      const cy = y + ry;
      return {
        d: `M${r(cx - rx)} ${r(cy)}a${r(rx)} ${r(ry)} 0 1 0 ${r(rx * 2)} 0` +
          `a${r(rx)} ${r(ry)} 0 1 0 ${r(-rx * 2)} 0Z`,
      };
    }

    case "line":
      return { d: `M${r(x)} ${r(y)}L${r(x + w)} ${r(y + h)}` };

    case "arrow": {
      const ex = x + w;
      const ey = y + h;
      const len = Math.hypot(w, h);
      // Too short to carry a head reads as a plain line.
      if (len < size * 4) return { d: `M${r(x)} ${r(y)}L${r(ex)} ${r(ey)}` };
      const ang = Math.atan2(h, w);
      // The head's length and the base it stands on: the shaft stops short of
      // the tip so its round cap stays inside the head instead of poking out.
      const head = Math.min(Math.max(size * 3, 14), len * 0.4);
      const bx = ex - Math.cos(ang) * head * 0.6;
      const by = ey - Math.sin(ang) * head * 0.6;
      const spread = 2.62; // 150° either way
      const w1x = ex + Math.cos(ang - spread) * head;
      const w1y = ey + Math.sin(ang - spread) * head;
      const w2x = ex + Math.cos(ang + spread) * head;
      const w2y = ey + Math.sin(ang + spread) * head;
      return {
        d: `M${r(x)} ${r(y)}L${r(bx)} ${r(by)}`,
        head: `M${r(ex)} ${r(ey)}L${r(w1x)} ${r(w1y)}L${r(w2x)} ${r(w2y)}Z`,
      };
    }
  }
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
