import type { ShapeDef } from "../types";
import { arrowShaft } from "./arrow";

/** Double-ended arrow: the same shaft as the arrow, with a head at each end.
    A straight drag locks it like the others. Each head can be turned off,
    which makes it a single-ended arrow of either direction. */
export const doubleArrow: ShapeDef = {
  kind: "double-arrow",
  name: "Double arrow",
  key: "b",
  defaultSize: 6,
  defaultOpacity: 1,
  figure(shape, size) {
    return arrowShaft(shape, size, true, true);
  },
  snap(w, h) {
    const len = Math.hypot(w, h);
    if (len === 0) return { w, h };
    const heading =
      (Math.round(Math.atan2(h, w) / (Math.PI / 4)) * Math.PI) / 4;
    return { w: Math.cos(heading) * len, h: Math.sin(heading) * len };
  },
};