import { useEffect, useRef } from "react";
import { readImageFile } from "../components/DrawSurface";
import { unionBounds } from "../engine/geometry";
import { parseDrawing, remapStrokes, serializeDrawing } from "../engine/import";
import { toPng } from "../engine/serialize";
import type { Stroke } from "../engine/types";
import type { DrawingController } from "./use-drawing";

/** What the clipboard needs to know about the host. */
export type ClipboardScope = {
  /** The elements in hand, by id. */
  getSelection: () => number[];
  /** Where pasted content lands: the centre of the current view. */
  viewCentre: () => { x: number; y: number };
  /** Whether clipboard events should act: focus is on the surface. */
  inScope: () => boolean;
  /** A selection change made by the paste or the cut itself. */
  onPasted?: (ids: number[]) => void;
  /** The board, and the paint behind it, for the PNG copy. */
  board: () => { w: number; h: number; paint: string | null };
};

const copyFormat = (strokes: Stroke[]) => {
  const b = unionBounds(strokes);
  const pad = 20;
  return {
    json: serializeDrawing(strokes),
    bounds: {
      x: b.x - pad,
      y: b.y - pad,
      w: b.w + pad * 2,
      h: b.h + pad * 2,
    },
  };
};

/**
 * Copy, cut and paste, over the native clipboard: the drawing as its own
 * JSON format alongside a PNG of the selection, and images pasted in as
 * marks. All three speak to the element in hand.
 */
export function useClipboard(
  drawing: DrawingController,
  scope: ClipboardScope,
) {
  const latest = useRef({ drawing, scope });
  latest.current = { drawing, scope };

  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const { drawing, scope } = latest.current;
      const ids = scope.getSelection();
      if (!ids.length || !scope.inScope()) return;
      e.preventDefault();
      const selected = drawing.strokes.filter((s) => ids.includes(s.id));
      if (!selected.length) return;
      const { json, bounds } = copyFormat(selected);
      // The synchronous text is the floor; the async write carries the PNG
      // too, and replaces it when it lands.
      e.clipboardData?.setData("text/plain", json);
      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write &&
        bounds.w > 0 &&
        bounds.h > 0
      ) {
        const { w, h, paint } = scope.board();
        toPng(selected, w, h, paint, 2, bounds)
          .then((blob) =>
            navigator.clipboard.write([
              new ClipboardItem({
                "text/plain": new Blob([json], { type: "text/plain" }),
                "image/png": blob,
              }),
            ]),
          )
          .catch(() => {
            /* the sync text already made it */
          });
      }
    };

    const onCut = (e: ClipboardEvent) => {
      const { drawing, scope } = latest.current;
      const ids = scope.getSelection();
      if (!ids.length || !scope.inScope()) return;
      e.preventDefault();
      const selected = drawing.strokes.filter((s) => ids.includes(s.id));
      if (!selected.length) return;
      const { json, bounds } = copyFormat(selected);
      e.clipboardData?.setData("text/plain", json);
      const set = new Set(ids);
      drawing.commit(drawing.strokes.filter((s) => !set.has(s.id)));
      scope.onPasted?.([]);
      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write &&
        bounds.w > 0 &&
        bounds.h > 0
      ) {
        const { w, h, paint } = scope.board();
        toPng(selected, w, h, paint, 2, bounds)
          .then((blob) =>
            navigator.clipboard.write([
              new ClipboardItem({
                "text/plain": new Blob([json], { type: "text/plain" }),
                "image/png": blob,
              }),
            ]),
          )
          .catch(() => {
            /* the sync text already made it */
          });
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const { drawing, scope } = latest.current;
      if (!scope.inScope()) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const text = cd.getData("text/plain");
      if (text) {
        const parsed = parseDrawing(text);
        if (parsed) {
          e.preventDefault();
          insertParsed(parsed.strokes, drawing, scope);
          return;
        }
      }
      const file = Array.from(cd.items ?? [])
        .map((item) => item.getAsFile())
        .find((f) => f?.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        const at = scope.viewCentre();
        readImageFile(file, at, drawing, (id) => scope.onPasted?.([id]));
      }
    };

    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
    };
  }, []);
}

/** Insert pasted strokes, ids and groups made fresh, centred on the view. */
function insertParsed(
  strokes: Stroke[],
  drawing: DrawingController,
  scope: ClipboardScope,
) {
  const remapped = remapStrokes(strokes, scope.viewCentre());
  drawing.commit([...drawing.strokes, ...remapped]);
  scope.onPasted?.(remapped.map((s) => s.id));
}