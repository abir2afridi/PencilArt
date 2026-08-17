import { lineHeight } from "./geometry";

/** The handwriting the text marks are drawn in, by default. */
export const HAND = '"Segoe Print", "Comic Sans MS", "Bradley Hand", cursive';

/**
 * Measure text as the browser will draw it. `font` is a CSS family, like
 * `"Segoe Print", cursive` — the size and weight are added by the caller's
 * own hand here, so every measurement is against the exact same style the
 * mark will render in.
 */
export function measureLines(
  content: string,
  size: number,
  font = HAND,
  bold?: boolean,
  italic?: boolean,
): { lines: string[]; w: number; h: number; lineH: number } {
  const lines = content.split("\n");
  const style = `${italic ? "italic " : ""}${bold ? "700 " : "400 "}${size}px ${font}`;
  const ctx = measureCtx();
  ctx.font = style;
  let w = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > w) w = m.width;
  }
  const lineH = lineHeight(size);
  return { lines, w, h: lines.length * lineH, lineH };
}

/** One shared canvas, so measuring never has to allocate its own. */
let probe: CanvasRenderingContext2D | null = null;
function measureCtx(): CanvasRenderingContext2D {
  if (!probe) {
    probe = document.createElement("canvas").getContext("2d");
  }
  if (!probe) throw new Error("No 2D context for text measurement");
  return probe;
}