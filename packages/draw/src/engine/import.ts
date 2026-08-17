import { nextId, translateStroke, unionBounds } from "./geometry";
import { PEN_BY_ID } from "./pens";
import type { Stroke } from "./types";

/** The marker this library writes onto the clipboard and into saved files. */
export const DRAWING_APP = "pencilart";
export const DRAWING_VERSION = 1;

/** A saved drawing: the format's own identity, and the strokes. */
export type DrawingFile = {
  app: typeof DRAWING_APP;
  version: typeof DRAWING_VERSION;
  strokes: Stroke[];
};

/** Whether a value could be a committed mark. Structural, not exhaustive:
    hostile payloads are filtered to nothing rather than crashed on. */
export function isStrokeLike(x: unknown): x is Stroke {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  if (typeof s.id !== "number" || !Number.isFinite(s.id)) return false;
  if (typeof s.pen !== "string" || !(s.pen in PEN_BY_ID)) return false;
  if (typeof s.color !== "string") return false;
  if (typeof s.size !== "number" || !Number.isFinite(s.size)) return false;
  if (typeof s.opacity !== "number" || !Number.isFinite(s.opacity)) return false;
  if (
    !Array.isArray(s.points) ||
    !s.points.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        p.every((n) => typeof n === "number" && Number.isFinite(n)),
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Parse a saved drawing's text. `null` means the payload isn't ours, or is
 * malformed enough that trusting it would be a mistake.
 */
export function parseDrawing(text: string): DrawingFile | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.app !== DRAWING_APP || d.version !== DRAWING_VERSION) return null;
  if (!Array.isArray(d.strokes) || !d.strokes.every(isStrokeLike)) return null;
  return { app: DRAWING_APP, version: DRAWING_VERSION, strokes: d.strokes };
}

/** Serialize a drawing for the clipboard or a saved file. */
export function serializeDrawing(strokes: Stroke[]): string {
  return JSON.stringify({ app: DRAWING_APP, version: DRAWING_VERSION, strokes });
}

/**
 * Strokes from outside this drawing, made fit to enter it: fresh ids, fresh
 * group ids (kept consistent within the set), and the whole set centred on a
 * board point — so a paste or an insert lands where the eye is.
 */
export function remapStrokes(
  strokes: Stroke[],
  centre: { x: number; y: number },
): Stroke[] {
  const groupMap = new Map<number, number>();
  const out = strokes.map((s) => {
    let group = s.group;
    if (group !== undefined) {
      if (!groupMap.has(group)) groupMap.set(group, nextId());
      group = groupMap.get(group);
    }
    const base = { ...s, id: nextId() };
    return group === undefined ? base : { ...base, group };
  });
  const u = unionBounds(out);
  if (u.w > 0 || u.h > 0) {
    const dx = centre.x - (u.x + u.w / 2);
    const dy = centre.y - (u.y + u.h / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = translateStroke(out[i], dx, dy);
    }
  }
  return out;
}