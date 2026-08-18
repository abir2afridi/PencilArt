import type { ShapeDef, Stroke } from "../types";

const r = (n: number) => Math.round(n * 10) / 10;

/** The next frame name: `frame-1`, `frame-2`… never reusing a number that's
    still on the board. */
export function nextFrameName(existing: Stroke[]): string {
  let max = 0;
  for (const s of existing) {
    if (s.figure?.kind !== "frame" || !s.figure.frameName) continue;
    const m = /^frame-(\d+)$/.exec(s.figure.frameName);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `frame-${max + 1}`;
}

/** Frame: a labelled container that gathers whatever is drawn inside it. It
    draws like a crop mark — a light box with a name — and moving or deleting
    it carries its members along. */
export const frame: ShapeDef = {
  kind: "frame",
  name: "Frame",
  key: "f",
  defaultSize: 2,
  defaultOpacity: 1,
  figure({ x, y, w, h }) {
    return { d: `M${r(x)} ${r(y)}h${r(w)}v${r(h)}h${r(-w)}Z` };
  },
  snap(w, h) {
    const s = Math.max(Math.abs(w), Math.abs(h));
    return { w: Math.sign(w || 1) * s, h: Math.sign(h || 1) * s };
  },
};