import type { ShapeDef } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** Rectangle: a corner-to-corner box. A straight drag squares it, the way a
    camera's crop square behaves. */
export const rect: ShapeDef = {
  kind: "rect",
  name: "Rectangle",
  key: "r",
  defaultSize: 6,
  defaultOpacity: 1,
  figure({ x, y, w, h }) {
    return { d: `M${r(x)} ${r(y)}h${r(w)}v${r(h)}h${r(-w)}Z` };
  },
  snap(w, h) {
    // The longer leg rules.
    const s = Math.max(Math.abs(w), Math.abs(h));
    return { w: Math.sign(w || 1) * s, h: Math.sign(h || 1) * s };
  },
};
