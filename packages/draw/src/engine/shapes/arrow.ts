import type { ShapeDef } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** The shared head geometry, used by both ends of the double-ended arrow. */
export function headAt(ex: number, ey: number, ang: number, head: number) {
  const spread = 2.62; // 150° either way
  const w1x = ex + Math.cos(ang - spread) * head;
  const w1y = ey + Math.sin(ang - spread) * head;
  const w2x = ex + Math.cos(ang + spread) * head;
  const w2y = ey + Math.sin(ang + spread) * head;
  return `M${r(ex)} ${r(ey)}L${r(w1x)} ${r(w1y)}L${r(w2x)} ${r(w2y)}Z`;
}

/** How long a head is, unless the shape overrides it. */
export function headLength(shape: { headSize?: number; w: number; h: number }, size: number) {
  if (shape.headSize) return shape.headSize;
  const len = Math.hypot(shape.w, shape.h);
  return Math.min(Math.max(size * 3, 14), len * 0.4);
}

/** The shaft with whatever heads the shape asks for. The shaft stops short
    of each head so its round cap stays inside it instead of poking out. A
    `bend` control point makes the shaft a quadratic Bézier, the heads
    following the tangent at each end. */
export function arrowShaft(
  shape: { x: number; y: number; w: number; h: number; headSize?: number; headStart?: boolean; headEnd?: boolean; bend?: { x: number; y: number } },
  size: number,
  fallbackStart: boolean,
  fallbackEnd: boolean,
): { d: string; head?: string } {
  const { x, y, w, h } = shape;
  const ex = x + w;
  const ey = y + h;
  const bend = shape.bend;
  const len = Math.hypot(w, h);
  const straightAng = Math.atan2(h, w);
  const ang = bend ? Math.atan2(ey - bend.y, ex - bend.x) : straightAng;
  const startAng = bend ? Math.atan2(bend.y - y, bend.x - x) : ang + Math.PI;
  // Too short to carry a head reads as a plain line.
  const showStart = shape.headStart ?? fallbackStart;
  const showEnd = shape.headEnd ?? fallbackEnd;
  if ((showStart || showEnd) && len < size * 4) {
    return bend
      ? { d: `M${r(x)} ${r(y)}Q${r(bend.x)} ${r(bend.y)} ${r(ex)} ${r(ey)}` }
      : { d: `M${r(x)} ${r(y)}L${r(ex)} ${r(ey)}` };
  }
  const head = headLength(shape, size);
  const back = head * 0.6;
  const bx = x + Math.cos(startAng) * back;
  const by = y + Math.sin(startAng) * back;
  const bx2 = ex - Math.cos(ang) * back;
  const by2 = ey - Math.sin(ang) * back;
  const heads = (showEnd ? headAt(ex, ey, ang, head) : "") +
    (showStart ? headAt(x, y, startAng, head) : "");
  return {
    d: bend
      ? `M${r(bx)} ${r(by)}Q${r(bend.x)} ${r(bend.y)} ${r(bx2)} ${r(by2)}`
      : `M${r(bx)} ${r(by)}L${r(bx2)} ${r(by2)}`,
    ...(heads ? { head: heads } : {}),
  };
}

/** Arrow: a shaft with a filled head on the far anchor. A straight drag
    locks it to the nearest of the eight compass directions. */
export const arrow: ShapeDef = {
  kind: "arrow",
  name: "Arrow",
  key: "a",
  defaultSize: 6,
  defaultOpacity: 1,
  figure(shape, size) {
    return arrowShaft(shape, size, false, true);
  },
  snap(w, h) {
    const len = Math.hypot(w, h);
    if (len === 0) return { w, h };
    const heading =
      (Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI) / 4;
    return { w: Math.cos(heading) * len, h: Math.sin(heading) * len };
  },
};