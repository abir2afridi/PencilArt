import type { ShapeDef } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** Arrow: a shaft with a filled head on the far anchor. A straight drag
    locks it to the nearest of the eight compass directions. */
export const arrow: ShapeDef = {
  kind: "arrow",
  name: "Arrow",
  key: "a",
  defaultSize: 6,
  defaultOpacity: 1,
  figure({ x, y, w, h }, size) {
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
  },
  snap(w, h) {
    const len = Math.hypot(w, h);
    if (len === 0) return { w, h };
    const heading =
      (Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI) / 4;
    return { w: Math.cos(heading) * len, h: Math.sin(heading) * len };
  },
};
