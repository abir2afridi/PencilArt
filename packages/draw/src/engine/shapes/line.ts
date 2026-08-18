import type { ShapeDef } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** Line: a single segment between the two anchors. A straight drag locks it
    to the nearest of the eight compass directions. */
export const line: ShapeDef = {
  kind: "line",
  name: "Line",
  key: "l",
  defaultSize: 6,
  defaultOpacity: 1,
  figure({ x, y, w, h, bend }) {
    return bend
      ? { d: `M${r(x)} ${r(y)}Q${r(bend.x)} ${r(bend.y)} ${r(x + w)} ${r(y + h)}` }
      : { d: `M${r(x)} ${r(y)}L${r(x + w)} ${r(y + h)}` };
  },
  snap(w, h) {
    const len = Math.hypot(w, h);
    if (len === 0) return { w, h };
    const heading =
      (Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI) / 4;
    return { w: Math.cos(heading) * len, h: Math.sin(heading) * len };
  },
};
