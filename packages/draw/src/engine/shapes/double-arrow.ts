import type { ShapeDef } from "../types";
import { arrow } from "./arrow";

const r = (n: number) => Math.round(n * 10) / 10;

/** Double-ended arrow: the same shaft as the arrow, with a head at each end.
    A straight drag locks it like the others. */
export const doubleArrow: ShapeDef = {
  kind: "double-arrow",
  name: "Double arrow",
  key: "b",
  defaultSize: 6,
  defaultOpacity: 1,
  figure(shape, size) {
    // The single arrow's markup, then the head turned around on the tail.
    const one = arrow.figure(shape, size);
    if (!one.head) return one;
    const { x, y, w, h } = shape;
    const len = Math.hypot(w, h);
    const ang = Math.atan2(h, w);
    const head = Math.min(Math.max(size * 3, 14), len * 0.4);
    const tail = headAt(x, y, ang + Math.PI, head);
    // The tail head stands on the far side of the shaft's end, so the shaft
    // must reach the head's base rather than the head's tip.
    const bx = x + Math.cos(ang) * head * 0.6;
    const by = y + Math.sin(ang) * head * 0.6;
    const ex = x + w;
    const ey = y + h;
    const bx2 = ex - Math.cos(ang) * head * 0.6;
    const by2 = ey - Math.sin(ang) * head * 0.6;
    return {
      d: `M${r(bx)} ${r(by)}L${r(bx2)} ${r(by2)}`,
      head: tail + headAt(ex, ey, ang, head),
    };
  },
  snap(w, h) {
    const len = Math.hypot(w, h);
    if (len === 0) return { w, h };
    const heading =
      (Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI) / 4;
    return { w: Math.cos(heading) * len, h: Math.sin(heading) * len };
  },
};

function headAt(ex: number, ey: number, ang: number, head: number) {
  const spread = 2.62;
  const w1x = ex + Math.cos(ang - spread) * head;
  const w1y = ey + Math.sin(ang - spread) * head;
  const w2x = ex + Math.cos(ang + spread) * head;
  const w2y = ey + Math.sin(ang + spread) * head;
  return `M${r(ex)} ${r(ey)}L${r(w1x)} ${r(w1y)}L${r(w2x)} ${r(w2y)}Z`;
}