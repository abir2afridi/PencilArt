import type { ShapeDef } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** Ellipse: fitted to the drag's bounding box. A straight drag circles it,
    the longer leg ruling like a crop square. */
export const ellipse: ShapeDef = {
  kind: "ellipse",
  name: "Ellipse",
  key: "o",
  defaultSize: 6,
  defaultOpacity: 1,
  figure({ x, y, w, h }) {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    return {
      d: `M${r(cx - rx)} ${r(cy)}a${r(rx)} ${r(ry)} 0 1 0 ${r(rx * 2)} 0` +
        `a${r(rx)} ${r(ry)} 0 1 0 ${r(-rx * 2)} 0Z`,
    };
  },
  snap(w, h) {
    // The longer leg rules.
    const s = Math.max(Math.abs(w), Math.abs(h));
    return { w: Math.sign(w || 1) * s, h: Math.sign(h || 1) * s };
  },
};
