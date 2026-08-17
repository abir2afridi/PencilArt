import type { ShapeDef } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** Diamond: a square stood on its corner, drawn between the two anchors. A
    straight drag squares it like the rect and ellipse. */
export const diamond: ShapeDef = {
  kind: "diamond",
  name: "Diamond",
  key: "d",
  defaultSize: 6,
  defaultOpacity: 1,
  figure({ x, y, w, h }) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    return {
      d:
        `M${r(cx)} ${r(y)}L${r(x + w)} ${r(cy)}` +
        `L${r(cx)} ${r(y + h)}L${r(x)} ${r(cy)}Z`,
    };
  },
  snap(w, h) {
    // The longer leg rules.
    const s = Math.max(Math.abs(w), Math.abs(h));
    return { w: Math.sign(w || 1) * s, h: Math.sign(h || 1) * s };
  },
};