import { useCallback, useState } from "react";
import { boundsOf, nextId, translateStroke, unionBounds } from "../engine/geometry";
import type { FigureDash, FigureFill, Stroke } from "../engine/types";
import type { DrawingController } from "./use-drawing";

/** What a style action may change on the elements in hand. */
export type StylePatch = {
  color?: string;
  size?: number;
  opacity?: number;
  /** The figure's fill; `null` clears it. */
  fill?: FigureFill | null;
  /** The figure's shaft style; the arrow's head stays solid. */
  dash?: FigureDash;
  /** A text mark's font, and its emphasis. */
  font?: string;
  bold?: boolean;
  italic?: boolean;
};

export type ReorderHow = "front" | "back" | "forward" | "backward";
export type AlignHow = "left" | "center" | "right" | "top" | "middle" | "bottom";

/**
 * The elements in hand, and everything that can be done to them: styling,
 * deletion, duplication, layering, alignment and grouping.
 */
export function useSelection(drawing: DrawingController) {
  const [selection, setSelection] = useState<number[]>([]);

  /** The selected strokes, in board order. */
  const picked = useCallback(
    () => drawing.strokes.filter((s) => selection.includes(s.id)),
    [drawing.strokes, selection],
  );

  /** Apply a style patch to the selection as one undoable step. */
  const styleSelection = useCallback(
    (patch: StylePatch) => {
      const ids = new Set(selection);
      if (!ids.size) return;
      const next = drawing.strokes.map((s) => {
        if (!ids.has(s.id)) return s;
        const out: Stroke = { ...s };
        if (patch.color !== undefined) out.color = patch.color;
        if (patch.size !== undefined) out.size = patch.size;
        if (patch.opacity !== undefined) out.opacity = patch.opacity;
        if (out.figure) {
          if (patch.fill !== undefined) {
            out.figure = {
              ...out.figure,
              fill: patch.fill === null ? undefined : patch.fill,
            };
          }
          if (patch.dash !== undefined)
            out.figure = { ...out.figure, dash: patch.dash };
        }
        if (out.text) {
          if (patch.font !== undefined)
            out.text = { ...out.text, font: patch.font };
          if (patch.bold !== undefined) out.text = { ...out.text, bold: patch.bold };
          if (patch.italic !== undefined)
            out.text = { ...out.text, italic: patch.italic };
        }
        return out;
      });
      drawing.begin();
      drawing.update(next);
      drawing.end();
    },
    [drawing, selection],
  );

  const deleteSelection = useCallback(() => {
    const ids = new Set(selection);
    if (!ids.size) return;
    drawing.commit(drawing.strokes.filter((s) => !ids.has(s.id)));
    setSelection([]);
  }, [drawing, selection]);

  /** Copy the selection, ten over from itself, and take the copies. */
  const duplicateSelection = useCallback(() => {
    const ids = new Set(selection);
    if (!ids.size) return;
    const groupMap = new Map<number, number>();
    const copies = drawing.strokes
      .filter((s) => ids.has(s.id))
      .map((s) => {
        let group = s.group;
        if (group !== undefined) {
          if (!groupMap.has(group)) groupMap.set(group, nextId());
          group = groupMap.get(group);
        }
        return { ...translateStroke(s, 10, 10), id: nextId(), group };
      });
    drawing.commit([...drawing.strokes, ...copies]);
    setSelection(copies.map((c) => c.id));
  }, [drawing, selection]);

  /** Fold the selection into one group; two or more marks. */
  const groupSelection = useCallback(() => {
    if (selection.length < 2) return;
    const ids = new Set(selection);
    const gid = nextId();
    drawing.commit(
      drawing.strokes.map((s) => (ids.has(s.id) ? { ...s, group: gid } : s)),
    );
  }, [drawing, selection]);

  /** Break the selected marks out of their groups. */
  const ungroupSelection = useCallback(() => {
    const ids = new Set(selection);
    drawing.commit(
      drawing.strokes.map((s) =>
        ids.has(s.id) ? { ...s, group: undefined } : s,
      ),
    );
  }, [drawing, selection]);

  /** Freeze the selection in place, or set it loose again. Locked elements
      can't be picked up, so they leave the hand either way. */
  const toggleLockSelection = useCallback(() => {
    const ids = new Set(selection);
    if (!ids.size) return;
    drawing.commit(
      drawing.strokes.map((s) =>
        ids.has(s.id) ? { ...s, locked: !s.locked } : s,
      ),
    );
    setSelection([]);
  }, [drawing, selection]);

  const selectAll = useCallback(() => {
    setSelection(
      drawing.strokes.filter((s) => !s.erase).map((s) => s.id),
    );
  }, [drawing.strokes]);

  /** Nudge the selection by whole board units. */
  const nudge = useCallback(
    (dx: number, dy: number) => {
      const ids = new Set(selection);
      if (!ids.size) return;
      drawing.begin();
      drawing.update(
        drawing.strokes.map((s) =>
          ids.has(s.id) ? translateStroke(s, dx, dy) : s,
        ),
      );
      drawing.end();
    },
    [drawing, selection],
  );

  /** Align every selected element to one edge of their union box. */
  const alignSelection = useCallback(
    (how: AlignHow) => {
      const sel = picked();
      if (sel.length < 2) return;
      const u = unionBounds(sel);
      const next = drawing.strokes.map((s) => {
        if (!selection.includes(s.id)) return s;
        const b = boundsOf(s);
        let dx = 0;
        let dy = 0;
        if (how === "left") dx = u.x - b.x;
        else if (how === "right") dx = u.x + u.w - (b.x + b.w);
        else if (how === "center") dx = u.x + u.w / 2 - (b.x + b.w / 2);
        else if (how === "top") dy = u.y - b.y;
        else if (how === "bottom") dy = u.y + u.h - (b.y + b.h);
        else dy = u.y + u.h / 2 - (b.y + b.h / 2);
        return translateStroke(s, dx, dy);
      });
      drawing.commit(next);
    },
    [drawing, picked, selection],
  );

  /** Space the selected elements evenly, keeping the two extremes fixed. */
  const distributeSelection = useCallback(
    (axis: "h" | "v") => {
      const sel = picked();
      if (sel.length < 3) return;
      const ranked = sel
        .map((s) => ({ s, b: boundsOf(s) }))
        .sort((a, b) => (axis === "h" ? a.b.x - b.b.x : a.b.y - b.b.y));
      const first = ranked[0].b;
      const last = ranked[ranked.length - 1].b;
      const extent =
        axis === "h"
          ? last.x + last.w - first.x
          : last.y + last.h - first.y;
      const total = ranked.reduce((sum, r) => sum + (axis === "h" ? r.b.w : r.b.h), 0);
      const gap = (extent - total) / (ranked.length - 1);
      let cursor = axis === "h" ? first.x : first.y;
      const next = drawing.strokes.map((s) => {
        if (!selection.includes(s.id)) return s;
        const r = ranked.find((r) => r.s.id === s.id);
        if (!r) return s;
        const b = r.b;
        const lead = axis === "h" ? b.x : b.y;
        const delta = cursor - lead;
        cursor += (axis === "h" ? b.w : b.h) + gap;
        return translateStroke(s, axis === "h" ? delta : 0, axis === "h" ? 0 : delta);
      });
      drawing.commit(next);
    },
    [drawing, picked, selection],
  );

  /** Re-order the selection within the stack: z is array order. */
  const reorderSelection = useCallback(
    (how: ReorderHow) => {
      const ids = new Set(selection);
      if (!ids.size) return;
      const all = drawing.strokes;
      if (how === "front") {
        drawing.commit([...all.filter((s) => !ids.has(s.id)), ...all.filter((s) => ids.has(s.id))]);
        return;
      }
      if (how === "back") {
        drawing.commit([...all.filter((s) => ids.has(s.id)), ...all.filter((s) => !ids.has(s.id))]);
        return;
      }
      // One step through the neighbours: swap the selection with the adjacent
      // stroke that isn't part of it.
      const out: Stroke[] = [];
      for (let i = 0; i < all.length; i++) {
        const s = all[i];
        if (how === "forward") {
          if (ids.has(s.id) && i + 1 < all.length && !ids.has(all[i + 1].id)) {
            out.push(all[i + 1], s);
            i++;
          } else out.push(s);
        } else if (ids.has(s.id) && i > 0 && !ids.has(all[i - 1].id)) {
          out.pop();
          out.push(s, all[i - 1]);
        } else out.push(s);
      }
      drawing.commit(out);
    },
    [drawing, selection],
  );

  return {
    selection,
    setSelection,
    styleSelection,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    toggleLockSelection,
    selectAll,
    nudge,
    alignSelection,
    distributeSelection,
    reorderSelection,
  };
}