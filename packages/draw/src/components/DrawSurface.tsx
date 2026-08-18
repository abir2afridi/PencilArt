import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  anchorsToShape,
  boundsOf,
  centreOf,
  dashArray,
  dotRadius,
  eraseLayers,
  figureMarkup,
  hitTest,
  lineHeight,
  marqueeHits,
  nextId,
  polylinePath,
  rotateAbout,
  strokePath,
  translateStroke,
  unionBounds,
} from "../engine/geometry";
import { PEN_BY_ID } from "../engine/pens";
import { nextFrameName } from "../engine/shapes/frame";
import { HAND, measureLines } from "../engine/text";
import type { Board, Box, FigureDash, FigureFill, Point, Shape, ShapeKind, Stroke } from "../engine/types";
import type { DrawingController } from "../hooks/use-drawing";

export type Tool =
  | {
      kind: "pen";
      pen: import("../engine/types").PenId;
      color: string;
      size: number;
      opacity: number;
      shape?: import("../engine/types").StrokeShape;
    }
  | { kind: "eraser"; size: number }
  | {
      kind: ShapeKind;
      color: string;
      size: number;
      opacity: number;
    }
  | { kind: "select" }
  | { kind: "text"; color: string; size: number; opacity: number };

/** What part of the board is in view: top-left corner and zoom factor. */
export type View = { x: number; y: number; k: number };

export type DrawSurfaceProps = {
  drawing: DrawingController;
  board: Board;
  /** CSS colour, `"transparent"` to paint nothing, or `"checker"`. */
  background?: string;
  tool: Tool;
  /** The part of the board in view. Zoom is about the pointer; the wheel
   *  pans unless a modifier turns it into zoom. */
  view: View;
  onViewChange: (view: View) => void;
  /** The elements in hand, by id. */
  selection?: number[];
  onSelection?: (ids: number[]) => void;
  /** Fired once a figure has been committed — the mark is already in hand,
   *  so the host can switch back to the select tool and let the next click
   *  move or resize it. */
  onShapeDone?: () => void;
  /** A right-click on the surface: the event, and the board point under it. */
  onContextMenu?: (
    e: React.MouseEvent<SVGSVGElement>,
    point: { x: number; y: number },
  ) => void;
  /** Draw a GRID-unit lattice under the ink, and snap draws and drags to it. */
  grid?: boolean;
  /** Show a ring at the pointer at the brush's true size. Off for touch-only. */
  showBrushCursor?: boolean;
  /** Ignore all input — the surface is inert but still shows the drawing. */
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Points laid along a straight run, rather than just its two ends. */
function runPoints(from: Point, to: Point, pressure: number): Point[] {
  const run = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.round(run / 3));
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    out.push([
      from[0] + (to[0] - from[0]) * f,
      from[1] + (to[1] - from[1]) * f,
      pressure,
    ]);
  }
  return out;
}

/** A zoomed view is still letterboxed; the viewBox is the visible region. */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 8;

/** What a pointer is doing on the surface. */
type Gesture =
  | { mode: "none" }
  | { mode: "draw" }
  | {
      mode: "pan";
      startX: number;
      startY: number;
      vx: number;
      vy: number;
    }
  | { mode: "move"; ids: number[] }
  | { mode: "bend"; ids: number[] }
  | { mode: "resize"; ids: number[]; handle: number; union: { x: number; y: number; w: number; h: number } }
  | { mode: "rotate"; ids: number[]; center: [number, number] }
  | { mode: "marquee" };

/** The grid step, in board units, when the grid is on. */
const GRID = 20;

/** The eight resize points, corner to corner, clockwise. */
const HANDLES = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
] as const;

/** The point of a linear element a bend handle rides: the curve's midpoint,
    or the plain segment's midpoint when the shaft is straight. */
function curveMid(f: Shape): readonly [number, number] {
  const sx = f.x;
  const sy = f.y;
  const ex = f.x + f.w;
  const ey = f.y + f.h;
  return f.bend
    ? [(sx + 2 * f.bend.x + ex) / 4, (sy + 2 * f.bend.y + ey) / 4]
    : [(sx + ex) / 2, (sy + ey) / 2];
}

/** Sticky anchors: an arrow whose tip starts or ends on a closed shape
    records where it landed, so the shape carries the arrow with it. */
function bindArrowAnchors(stroke: Stroke, all: Stroke[]): void {
  const f = stroke.figure!;
  const bind = (ax: number, ay: number): { id?: number; ox?: number; oy?: number } => {
    for (let i = all.length - 1; i >= 0; i--) {
      const el = all[i];
      if (el.locked || el.erase) continue;
      const ef = el.figure;
      if (
        !ef ||
        ef.kind === "line" ||
        ef.kind === "arrow" ||
        ef.kind === "double-arrow"
      ) {
        continue;
      }
      if (!hitTest(el, ax, ay, 6)) continue;
      const b = boundsOf(el);
      if (el.rotate) {
        const [cx, cy] = centreOf(b);
        const [rx, ry] = rotateAbout(ax - cx, ay - cy, 0, 0, -el.rotate);
        return { id: el.id, ox: rx + b.w / 2, oy: ry + b.h / 2 };
      }
      return { id: el.id, ox: ax - b.x, oy: ay - b.y };
    }
    return {};
  };
  const s = bind(f.x, f.y);
  const e = bind(f.x + f.w, f.y + f.h);
  const bound: Shape["bound"] = {};
  if (s.id !== undefined) {
    bound.start = s.id;
    bound.sx = s.ox;
    bound.sy = s.oy;
  }
  if (e.id !== undefined) {
    bound.end = e.id;
    bound.ex = e.ox;
    bound.ey = e.oy;
  }
  if (bound.start !== undefined || bound.end !== undefined) f.bound = bound;
}

export function DrawSurface({
  drawing,
  board,
  background = "#ffffff",
  tool,
  view,
  onViewChange,
  selection = [],
  onSelection,
  onShapeDone,
  onContextMenu,
  grid = false,
  showBrushCursor = true,
  disabled = false,
  className,
  style,
}: DrawSurfaceProps) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);

  const [current, setCurrent] = useState<Point[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  /** The marquee being dragged out, in board coordinates. */
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const drawingNow = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const activePointer = useRef<number | null>(null);
  const gesture = useRef<Gesture>({ mode: "none" });
  /**
   * Palm rejection: once a stylus has been seen on this surface, ignore touch
   * entirely. Resting a hand on a tablet while drawing is the normal way to
   * hold a pen, and without this every drawing gets a smear across it.
   */
  const sawPen = useRef(false);

  /** State for drawing in straight runs while shift is held. */
  const straight = useRef<{
    anchor: Point;
    heading: number | null;
    settled: Point[];
  } | null>(null);

  /** Whether the stroke in progress carries real hardware pressure. */
  const realPressure = useRef(false);

  const state = useRef({ tool, drawing, selection, view, onViewChange, onSelection, onShapeDone });
  state.current = { tool, drawing, selection, view, onViewChange, onSelection, onShapeDone };
  const viewRef = useRef(view ?? { x: 0, y: 0, k: 1 });
  viewRef.current = view ?? { x: 0, y: 0, k: 1 };

  const toBoard = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const v = viewRef.current;
      const vw = board.w / v.k;
      const vh = board.h / v.k;
      // The viewBox is letterboxed by preserveAspectRatio, so it does NOT fill
      // the element whenever the aspect ratios differ. Mapping as though it
      // did puts the ink up to ~50px away from the pointer at the edges.
      const scale = Math.min(r.width / vw, r.height / vh);
      const offsetX = (r.width - vw * scale) / 2;
      const offsetY = (r.height - vh * scale) / 2;
      return {
        x: v.x + (clientX - r.left - offsetX) / scale,
        y: v.y + (clientY - r.top - offsetY) / scale,
      };
    },
    [board.w, board.h],
  );

  /** The screen scale the view is rendered at, and its letterbox offset. */
  const screenScale = useCallback(() => {
    const el = ref.current;
    const v = viewRef.current;
    const r = el?.getBoundingClientRect();
    if (!r || !r.width) return { scale: 1, ox: 0, oy: 0 };
    const vw = board.w / v.k;
    const vh = board.h / v.k;
    const scale = Math.min(r.width / vw, r.height / vh);
    return { scale, ox: (r.width - vw * scale) / 2, oy: (r.height - vh * scale) / 2 };
  }, [board.w, board.h]);

  /** How the view is nudged, from a host's button or the pointer. */
  const changeView = useCallback(
    (next: View) => {
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next.k));
      state.current.onViewChange?.({ x: next.x, y: next.y, k });
    },
    [],
  );

  // The wheel pans; ctrl/cmd turns it into a zoom about the pointer. A native
  // listener, because React can't mark it passive:false.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const p = toBoard(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * Math.exp(-e.deltaY * 0.0015)));
        if (k === v.k) return;
        // Keep the board point under the cursor fixed: the view moves so
        // that point lands where it already is on screen.
        const { scale: s, ox, oy } = screenScale();
        const vw = board.w / k;
        const vh = board.h / k;
        const s2 = Math.min(el.getBoundingClientRect().width / vw, el.getBoundingClientRect().height / vh);
        const ox2 = (el.getBoundingClientRect().width - vw * s2) / 2;
        const oy2 = (el.getBoundingClientRect().height - vh * s2) / 2;
        const sx = (e.clientX - el.getBoundingClientRect().left - ox) / s;
        const sy = (e.clientY - el.getBoundingClientRect().top - oy) / s;
        changeView({
          x: p.x - (e.clientX - el.getBoundingClientRect().left - ox2) / s2,
          y: p.y - (e.clientY - el.getBoundingClientRect().top - oy2) / s2,
          k,
        });
        void sx;
        void sy;
        return;
      }
      const { scale: s } = screenScale();
      changeView({ x: v.x + e.deltaX / s, y: v.y + e.deltaY / s, k: v.k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [board.w, board.h, toBoard, screenScale, changeView]);

  // Space turns the pointer into a pan hand, anywhere over the page.
  const spaceHeld = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (
        (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]")
      ) {
        return;
      }
      if (e.type === "keydown") {
        spaceHeld.current = true;
        e.preventDefault();
      } else {
        spaceHeld.current = false;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const ignore = (e: React.PointerEvent) => {
    if (disabled) return true;
    if (e.pointerType === "pen") sawPen.current = true;
    return e.pointerType === "touch" && sawPen.current;
  };

  /** The strokes in hand, by id, in board order. */
  const selectedStrokes = useCallback(
    (ids: number[]) => {
      const set = new Set(ids);
      return drawing.strokes.filter((s) => set.has(s.id));
    },
    [drawing.strokes],
  );

  /** The union of the selection's boxes, padded so thin marks stay grabbable. */
  const selUnion = useCallback((ids: number[]) => {
    const b = unionBounds(selectedStrokes(ids));
    return { x: b.x - 6, y: b.y - 6, w: b.w + 12, h: b.h + 12 };
  }, [selectedStrokes]);

  /** Which resize point (or the rotate handle) a board point is on. */
  const handleAt = useCallback(
    (x: number, y: number, ids: number[]) => {
      if (!ids.length) return null;
      const k = viewRef.current.k;
      const grab = 11 / k;
      const u = selUnion(ids);
      const cx = u.x + u.w / 2;
      // A single line or arrow bends from its curve's midpoint.
      if (ids.length === 1) {
        const s = drawing.strokes.find((st) => st.id === ids[0]);
        const f = s?.figure;
        if (f && (f.kind === "line" || f.kind === "arrow" || f.kind === "double-arrow")) {
          const [mx, my] = curveMid(f);
          if (Math.hypot(x - mx, y - my) <= grab) return 9;
        }
      }
      const spots: [number, number][] = HANDLES.map(([hx, hy]) => [
        u.x + (u.w / 2) * (hx + 1),
        u.y + (u.h / 2) * (hy + 1),
      ]);
      for (let i = 0; i < spots.length; i++) {
        if (Math.hypot(x - spots[i][0], y - spots[i][1]) <= grab) return i;
      }
      // The rotate handle sits above the top edge, on its own stem.
      if (Math.hypot(x - cx, y - (u.y - 26 / k)) <= grab) return 8;
      return null;
    },
    [selUnion, drawing.strokes],
  );

  /** Expand a click on one member to its whole group. */
  const expandGroup = useCallback(
    (id: number) => {
      const st = drawing.strokes.find((s) => s.id === id);
      if (!st?.group) return [id];
      return drawing.strokes.filter((s) => s.group === st.group).map((s) => s.id);
    },
    [drawing.strokes],
  );

  /** Transform every selected element by the same rule. Locked elements are
      in the hand but stay put — only the lock toggle can move them. */
  const mapSelected = useCallback(
    (ids: number[], fn: (s: Stroke) => Stroke): Stroke[] =>
      drawing.strokes.map((s) =>
        ids.includes(s.id) && !s.locked ? fn(s) : s,
      ),
    [drawing.strokes],
  );

  /** The strokes as they were when a move/resize/rotate began. Every pointer
      move re-derives positions from these, so a gesture is one smooth sweep
      instead of a pile-up of little translations. */
  const orig = useRef<Map<number, Stroke> | null>(null);
  const snapshot = useCallback(
    (ids: number[]) => {
      orig.current = new Map(
        drawing.strokes
          .filter((s) => ids.includes(s.id))
          .map((s) => [s.id, s]),
      );
    },
    [drawing.strokes],
  );

  /** Whether a stroke is a frame. */
  const isFrame = useCallback((s: Stroke) => s.figure?.kind === "frame", []);

  /** The members of the frames among `ids`, not already included: moving a
      frame carries its contents along. */
  const frameMembers = useCallback(
    (ids: number[]) => {
      const frames = new Set(
        ids.filter((id) =>
          drawing.strokes.some((s) => s.id === id && isFrame(s)),
        ),
      );
      if (!frames.size) return [];
      return drawing.strokes
        .filter(
          (s) =>
            s.frameId !== undefined &&
            frames.has(s.frameId) &&
            !ids.includes(s.id) &&
            !s.locked,
        )
        .map((s) => s.id);
    },
    [drawing.strokes, isFrame],
  );

  /** The innermost frame that fully contains the box — the deepest container
      wins, and frames never sit inside frames. */
  const assignFrame = useCallback(
    (b: Box): number | undefined => {
      let best: Stroke | undefined;
      let bestArea = Infinity;
      for (const f of drawing.strokes) {
        if (!isFrame(f) || !f.figure) continue;
        const { x, y, w, h } = f.figure;
        if (b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + h) {
          const area = w * h;
          if (area < bestArea) {
            best = f;
            bestArea = area;
          }
        }
      }
      return best?.id;
    },
    [drawing.strokes, isFrame],
  );

  /** Grid and object snap for a drag: return the adjusted delta. The grid
   *  locks the union box onto GRID units; object snap then lines a box edge
   *  up with another element's edge, or a centre with a centre, when they
   *  come within 6 units. Other elements are read from the raw strokes —
   *  a bound connector's resolved box follows its target and would make the
   *  snap chase itself. */
  const snapMove = useCallback(
    (g: { mode: "move"; ids: number[] }, dx: number, dy: number): [number, number] => {
      const origs = g.ids
        .map((id) => orig.current?.get(id) ?? drawing.raw.find((s) => s.id === id))
        .filter((s): s is Stroke => !!s);
      const boxes = origs
        .map((s) => s.figure)
        .filter((f): f is NonNullable<typeof f> => !!f);
      if (!boxes.length) return [dx, dy];
      const ux = Math.min(...boxes.map((b) => b.x));
      const uy = Math.min(...boxes.map((b) => b.y));
      const ux2 = Math.max(...boxes.map((b) => b.x + b.w));
      const uy2 = Math.max(...boxes.map((b) => b.y + b.h));
      const ow = ux2 - ux;
      const oh = uy2 - uy;
      let ox = ux + dx;
      let oy = uy + dy;
      if (grid) {
        ox = Math.round(ox / GRID) * GRID;
        oy = Math.round(oy / GRID) * GRID;
      }
      // Edge targets and centre targets are matched only against the same
      // sort of line on the other elements.
      const xs: number[] = [];
      const xc: number[] = [];
      const ys: number[] = [];
      const yc: number[] = [];
      for (const s of drawing.raw) {
        if (s.erase || s.locked) continue;
        if (g.ids.includes(s.id)) continue;
        const f = s.figure;
        if (!f) continue;
        xs.push(f.x, f.x + f.w);
        xc.push(f.x + f.w / 2);
        ys.push(f.y, f.y + f.h);
        yc.push(f.y + f.h / 2);
      }
      const TOL = 6;
      let bestX = 0;
      let bestY = 0;
      for (const me of [ox, ox + ow]) {
        for (const t of xs) {
          const d = t - me;
          if (Math.abs(d) <= TOL && (bestX === 0 || Math.abs(d) < Math.abs(bestX)))
            bestX = d;
        }
      }
      for (const me of [ox + ow / 2]) {
        for (const t of xc) {
          const d = t - me;
          if (Math.abs(d) <= TOL && (bestX === 0 || Math.abs(d) < Math.abs(bestX)))
            bestX = d;
        }
      }
      for (const me of [oy, oy + oh]) {
        for (const t of ys) {
          const d = t - me;
          if (Math.abs(d) <= TOL && (bestY === 0 || Math.abs(d) < Math.abs(bestY)))
            bestY = d;
        }
      }
      for (const me of [oy + oh / 2]) {
        for (const t of yc) {
          const d = t - me;
          if (Math.abs(d) <= TOL && (bestY === 0 || Math.abs(d) < Math.abs(bestY)))
            bestY = d;
        }
      }
      return [dx + (ox - (ux + dx)) + bestX, dy + (oy - (uy + dy)) + bestY];
    },
    [drawing.raw, grid],
  );

  const startSelectGesture = (x: number, y: number, e: React.PointerEvent) => {
    const st = state.current;
    const ids = st.selection;

    // A resize or rotate handle of the current selection comes first.
    if (ids.length) {
      const h = handleAt(x, y, ids);
      if (h !== null) {
        pointsRef.current = [[x, y, 1]];
        if (h === 8) {
          const u = selUnion(ids);
          const center = [u.x + u.w / 2, u.y + u.h / 2] as [number, number];
          gesture.current = { mode: "rotate", ids, center };
        } else if (h === 9) {
          gesture.current = { mode: "bend", ids };
        } else {
          gesture.current = { mode: "resize", ids, handle: h, union: selUnion(ids) };
        }
        snapshot(ids);
        drawing.begin();
        return;
      }
    }

    // Topmost element first — the last one in the array.
    for (let i = drawing.strokes.length - 1; i >= 0; i--) {
      const s = drawing.strokes[i];
      if (s.erase) continue;
      if (!hitTest(s, x, y)) continue;
      const picked = ids.includes(s.id) ? ids : expandGroup(s.id);
      if (!ids.includes(s.id)) {
        st.onSelection?.(picked);
        state.current.selection = picked;
      }
      // A frame takes its members with it; they're not selected, just moved.
      const moveIds = [...picked, ...frameMembers(picked)];
      gesture.current = { mode: "move", ids: moveIds };
      pointsRef.current = [[x, y, 1]];
      snapshot(moveIds);
      drawing.begin();
      return;
    }

    // Empty ground: a marquee. The selection clears on release if it never
    // moved; this way one stray pixel doesn't wipe a careful selection.
    gesture.current = { mode: "marquee" };
    pointsRef.current = [[x, y, 1]];
    setMarquee({ x, y, w: 0, h: 0 });
    void e;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (ignore(e)) return;
    // While a text is being edited, only the textarea itself matters.
    if (editing) {
      if (!(e.target as Element).closest("foreignObject")) commitText();
      return;
    }
    // One pointer at a time: a second finger is a pan/zoom gesture, not a
    // second stroke.
    if (activePointer.current !== null) return;
    e.preventDefault();
    activePointer.current = e.pointerId;
    try {
      ref.current?.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }

    const { x, y } = toBoard(e.clientX, e.clientY);

    // Middle button or the space hand: pan.
    if (e.button === 1 || spaceHeld.current) {
      const v = viewRef.current;
      gesture.current = { mode: "pan", startX: e.clientX, startY: e.clientY, vx: v.x, vy: v.y };
      return;
    }

    if (tool.kind === "select") {
      startSelectGesture(x, y, e);
      return;
    }

    if (tool.kind === "text") {
      beginText({ x, y });
      return;
    }

    drawingNow.current = true;
    gesture.current = { mode: "draw" };
    straight.current = null;

    // An eraser pass is recorded exactly like a mark — it just subtracts.
    realPressure.current = false;
    const p: Point = [x, y, e.pressure || 0.5];
    pointsRef.current = [p];
    setCurrent([p]);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (ignore(e)) return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    if (e.pointerType !== "touch") setHover({ x, y });
    if (e.pointerId !== activePointer.current) return;

    const g = gesture.current;

    if (g.mode === "pan") {
      const { scale: s } = screenScale();
      changeView({
        x: g.vx + (e.clientX - g.startX) / s,
        y: g.vy + (e.clientY - g.startY) / s,
        k: viewRef.current.k,
      });
      return;
    }

    if (g.mode === "move") {
      const start = pointsRef.current[0] ?? [x, y];
      let dx = x - start[0];
      let dy = y - start[1];
      [dx, dy] = snapMove(g, dx, dy);
      drawing.update(
        mapSelected(g.ids, (s) =>
          translateStroke(orig.current?.get(s.id) ?? s, dx, dy),
        ),
      );
      return;
    }

    // Bending: the control point follows the pointer, kept inside the box so
    // the curve never escapes the selection chrome.
    if (g.mode === "bend") {
      drawing.update(
        mapSelected(g.ids, (s) => {
          const f = s.figure;
          if (!f) return s;
          const pad = 1;
          return {
            ...s,
            figure: {
              ...f,
              bend: {
                x: Math.max(f.x + pad, Math.min(f.x + f.w - pad, x)),
                y: Math.max(f.y + pad, Math.min(f.y + f.h - pad, y)),
              },
            },
          };
        }),
      );
      return;
    }

    if (g.mode === "resize") {
      const start = pointsRef.current[0] ?? [x, y];
      const u = g.union;
      const dx = x - start[0];
      const dy = y - start[1];
      const [hx, hy] = HANDLES[g.handle];
      const left = hx < 0;
      const top = hy < 0;
      // The corner opposite the handle stays put.
      let nx = left ? u.x + dx : u.x;
      let ny = top ? u.y + dy : u.y;
      let nw = left ? u.w - dx : u.w + dx;
      let nh = top ? u.h - dy : u.h + dy;
      if (e.shiftKey) {
        const f = Math.max(nw / u.w, nh / u.h);
        nw = u.w * f;
        nh = u.h * f;
        nx = left ? u.x + (u.w - nw) : u.x;
        ny = top ? u.y + (u.h - nh) : u.y;
      }
      if (nw < 8 || nh < 8) return;
      const fx = (b: { x: number; w: number }) => ({
        x: nx + ((b.x - u.x) / u.w) * nw,
        w: (b.w / u.w) * nw,
      });
      const fy = (b: { y: number; h: number }) => ({
        y: ny + ((b.y - u.y) / u.h) * nh,
        h: (b.h / u.h) * nh,
      });
      drawing.update(
        mapSelected(g.ids, (s) => {
          const o = orig.current?.get(s.id) ?? s;
          if (o.figure) {
            const f = o.figure;
            const bx = fx(f);
            const by = fy(f);
            return { ...o, figure: { ...f, ...bx, ...by } };
          }
          if (o.image || o.text) {
            const part = (o.image ?? o.text)!;
            const p0 = o.points[0] ?? [0, 0, 0.5];
            const bx = fx({ x: p0[0], w: part.w });
            const by = fy({ y: p0[1], h: part.h });
            return {
              ...o,
              points: [[bx.x, by.y, p0[2]]],
              image: o.image ? { ...o.image, w: bx.w, h: by.h } : undefined,
              text: o.text
                ? {
                    ...o.text,
                    w: bx.w,
                    h: by.h,
                    size: Math.max(6, o.text.size * (by.h / part.h)),
                  }
                : undefined,
            };
          }
          const b = boundsOf(o);
          const bx = fx(b);
          const by = fy(b);
          const sx = b.w ? bx.w / b.w : 1;
          const sy = b.h ? by.h / b.h : 1;
          return {
            ...o,
            points: o.points.map(([px, py, pr]) => [
              bx.x + (px - b.x) * sx,
              by.y + (py - b.y) * sy,
              pr,
            ]),
          };
        }),
      );
      return;
    }

    if (g.mode === "rotate") {
      const start = pointsRef.current[0] ?? [x, y];
      const [cx, cy] = g.center;
      const a0 = Math.atan2(start[1] - cy, start[0] - cx);
      let a = Math.atan2(y - cy, x - cx) - a0;
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
      const deg = (a * 180) / Math.PI;
      drawing.update(
        mapSelected(g.ids, (s) => {
          const o = orig.current?.get(s.id) ?? s;
          return {
            ...o,
            rotate: Math.round((((o.rotate ?? 0) + deg) % 360) * 100) / 100,
          };
        }),
      );
      return;
    }

    if (g.mode === "marquee") {
      const start = pointsRef.current[0] ?? [x, y];
      setMarquee({
        x: Math.min(start[0], x),
        y: Math.min(start[1], y),
        w: Math.abs(x - start[0]),
        h: Math.abs(y - start[1]),
      });
      return;
    }

    if (!drawingNow.current || g.mode !== "draw") return;

    const pts = pointsRef.current;
    const pressure = e.pressure || 0.5;

    // A figure is a drag between two anchors, not a traced path: the preview
    // grows from where the pointer went down and is redrawn each move. Shift
    // holds it to a square or to the eight compass points.
    if (
      tool.kind !== "pen" &&
      tool.kind !== "eraser" &&
      tool.kind !== "select" &&
      tool.kind !== "text"
    ) {
      const start = pts[0];
      if (!start) return;
      let end: Point = [x, y, pressure];
      if (grid) {
        start[0] = Math.round(start[0] / GRID) * GRID;
        start[1] = Math.round(start[1] / GRID) * GRID;
        end[0] = Math.round(end[0] / GRID) * GRID;
        end[1] = Math.round(end[1] / GRID) * GRID;
      }
      if (e.shiftKey) {
        const shape = anchorsToShape(tool.kind, start, end, true);
        end[0] = shape.w === 0 ? start[0] : shape.x + shape.w;
        end[1] = shape.h === 0 ? start[1] : shape.y + shape.h;
      }
      pointsRef.current = [start, end];
      setCurrent([start, end]);
      return;
    }

    // Anything other than the flat default means the hardware is really
    // measuring it. Pens that report a constant 0.5 are treated as pressureless.
    if (e.pointerType === "pen" && e.pressure > 0 && e.pressure !== 0.5) {
      realPressure.current = true;
    }

    if (e.shiftKey) {
      if (!straight.current) {
        straight.current = {
          anchor: pts[pts.length - 1] ?? [x, y, pressure],
          heading: null,
          settled: pts,
        };
      }

      const st = straight.current;
      const dx = x - st.anchor[0];
      const dy = y - st.anchor[1];

      if (st.heading === null) {
        if (Math.hypot(dx, dy) < 16) return;
        st.heading =
          (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
      }

      const cos = Math.cos(st.heading);
      const sin = Math.sin(st.heading);
      const along = dx * cos + dy * sin;
      const tip: Point = [
        st.anchor[0] + cos * along,
        st.anchor[1] + sin * along,
        pressure,
      ];

      pointsRef.current = [...st.settled, ...runPoints(st.anchor, tip, pressure)];
      setCurrent(pointsRef.current);
      return;
    }

    straight.current = null;

    // Drop points closer than a screen pixel — at high zoom this is the
    // difference between a smooth line and thousands of redundant samples.
    const last = pts[pts.length - 1];
    if (last && Math.hypot(x - last[0], y - last[1]) < 1.1 / viewRef.current.k) return;

    pointsRef.current = [...pts, [x, y, pressure]];
    setCurrent(pointsRef.current);
  };

  const finishGesture = (e?: React.PointerEvent) => {
    if (e && e.pointerId !== activePointer.current) return;
    activePointer.current = null;

    const g = gesture.current;
    gesture.current = { mode: "none" };

    if (g.mode === "pan") return;

    // A marquee settles its picks on release; a click that never grew one
    // clears the selection instead.
    if (g.mode === "marquee") {
      const st = state.current;
      const start = pointsRef.current[0];
      const m = marquee;
      setMarquee(null);
      const grew = start && m && (m.w > 3 || m.h > 3);
      if (grew && m) {
        const hits = marqueeHits(drawing.strokes, m);
        st.onSelection?.(hits.map((s) => s.id));
      } else if (st.selection.length) {
        st.onSelection?.([]);
      }
      drawingNow.current = false;
      pointsRef.current = [];
      setCurrent([]);
      return;
    }

    if (g.mode === "move" || g.mode === "resize" || g.mode === "rotate" || g.mode === "bend") {
      drawing.end();
      drawingNow.current = false;
      pointsRef.current = [];
      setCurrent([]);
      return;
    }

    if (!drawingNow.current) return;
    drawingNow.current = false;
    straight.current = null;

    const pts = pointsRef.current;
    pointsRef.current = [];
    setCurrent([]);
    if (!pts.length) return;

    // A figure commits its two anchors and the box they describe; a tap with
    // no drag still deserves a dot-sized square or circle.
    if (
      tool.kind !== "pen" &&
      tool.kind !== "eraser" &&
      tool.kind !== "select" &&
      tool.kind !== "text"
    ) {
      const a = pts[0];
      const b = pts[pts.length - 1] ?? a;
      let figure = anchorsToShape(tool.kind, a, b);
      if (
        Math.hypot(b[0] - a[0], b[1] - a[1]) < 1 &&
        (tool.kind === "rect" || tool.kind === "ellipse" || tool.kind === "diamond")
      ) {
        const d = Math.max(12, tool.size * 2.5);
        figure = { kind: tool.kind, x: a[0] - d / 2, y: a[1] - d / 2, w: d, h: d };
      }
      const stroke: Stroke = {
        id: nextId(),
        pen: "pen" as const,
        color: tool.color,
        size: tool.size,
        opacity: tool.opacity,
        points: pts,
        figure,
        frameId: assignFrame(figure),
      };
      if (tool.kind === "frame") {
        stroke.figure!.frameName = nextFrameName(drawing.strokes);
        stroke.frameId = undefined;
      }
      if (tool.kind === "arrow" || tool.kind === "double-arrow") {
        bindArrowAnchors(stroke, drawing.strokes);
      }
      drawing.commit([...drawing.strokes, stroke]);
      state.current.onSelection?.([stroke.id]);
      state.current.onShapeDone?.();
      return;
    }

    // A traced path: a pen's shape, or the eraser's blanked-out marks.
    if (tool.kind === "pen" || tool.kind === "eraser") {
      drawing.commit([
        ...drawing.strokes,
        tool.kind === "eraser"
          ? {
              id: nextId(),
              pen: "pen" as const,
              color: "#000",
              size: tool.size,
              opacity: 1,
              points: pts,
              erase: true,
            }
          : {
              id: nextId(),
              pen: tool.pen,
              color: tool.color,
              size: tool.size,
              opacity: tool.opacity,
              points: pts,
              shape: { ...tool.shape, simulatePressure: !realPressure.current },
              frameId: assignFrame(boundsOf({ id: 0, pen: tool.pen, color: tool.color, size: tool.size, opacity: tool.opacity, points: pts })),
            },
      ]);
    }
  };

  /*
   * Text: a click with the text tool drops a mark and starts typing into an
   * overlay; a double-click on an existing mark reopens it. Everything stays
   * uncommitted until the overlay goes away.
   */
  type TextDraft = {
    id: number | null;
    x: number;
    y: number;
    w: number;
    h: number;
    size: number;
    color: string;
    font: string;
    bold?: boolean;
    italic?: boolean;
    align?: "left" | "center" | "right";
    background?: string;
    content: string;
  };
  const [editing, setEditing] = useState<TextDraft | null>(null);
  const editingRef = useRef<TextDraft | null>(null);
  editingRef.current = editing;
  const originalText = useRef<Stroke | null>(null);

  const beginText = (at: { x: number; y: number }, existing?: Stroke) => {
    if (existing) {
      const t = existing.text!;
      const [x, y] = existing.points[0] ?? [0, 0];
      originalText.current = existing;
      drawing.begin();
      setEditing({
        id: existing.id,
        x,
        y,
        w: t.w,
        h: t.h,
        size: t.size,
        color: existing.color,
        font: t.font,
        bold: t.bold,
        italic: t.italic,
        align: t.align,
        background: t.background,
        content: t.content,
      });
      return;
    }
    const t = state.current.tool;
    if (t.kind !== "text") return;
    originalText.current = null;
    setEditing({
      id: null,
      x: at.x,
      y: at.y,
      w: 4,
      h: lineHeight(t.size),
      size: t.size,
      color: t.color,
      font: HAND,
      content: "",
    });
  };

  /** Measure the draft and write it (or update its mark). */
  const applyText = (draft: TextDraft) => {
    const laid = measureLines(draft.content, draft.size, draft.font, draft.bold, draft.italic);
    if (draft.id === null) {
      if (!draft.content) return null;
      const stroke: Stroke = {
        id: nextId(),
        pen: "pen" as const,
        color: draft.color,
        size: draft.size,
        opacity: 1,
        points: [[draft.x, draft.y, 0.5]],
        text: {
          content: draft.content,
          size: draft.size,
          w: laid.w,
          h: laid.h,
          font: draft.font,
          bold: draft.bold,
          italic: draft.italic,
          align: draft.align,
          background: draft.background,
        },
      };
      return stroke;
    }
    return drawing.strokes.find((s) => s.id === draft.id) ?? null;
  };

  const commitText = () => {
    const draft = editingRef.current;
    if (!draft) return;
    setEditing(null);
    const isNew = draft.id === null;
    const stroke = applyText(draft);
    if (isNew) {
      if (stroke) {
        drawing.commit([...drawing.strokes, stroke]);
        state.current.onSelection?.([stroke.id]);
      }
      return;
    }
    // Update the existing mark with the typed text, measured afresh.
    const laid = measureLines(draft.content, draft.size, draft.font, draft.bold, draft.italic);
    if (draft.content) {
      drawing.update(
        drawing.strokes.map((s) =>
          s.id === draft.id && s.text
            ? {
                ...s,
                text: {
                  ...s.text,
                  content: draft.content,
                  size: draft.size,
                  w: laid.w,
                  h: laid.h,
                  bold: draft.bold,
                  italic: draft.italic,
                  align: draft.align,
                  background: draft.background,
                },
              }
            : s,
        ),
      );
    } else {
      drawing.update(drawing.strokes.filter((s) => s.id !== draft.id));
    }
    drawing.end();
    originalText.current = null;
  };

  // Committed outlines are recomputed only when the stroke set changes, never
  // on a pointer move — otherwise drawing gets slower the more you've drawn.
  const layers = useMemo(() => {
    const all = drawing.strokes;
    return eraseLayers(all).map((layer) => ({
      erasers: layer.erasers.map((i) => ({
        d: polylinePath(all[i].points),
        width: all[i].size,
      })),
      ink: layer.ink.map((i) => {
        const st = all[i];
        if (st.figure?.kind === "frame") {
          const f = st.figure;
          return {
            id: st.id,
            kind: "frame" as const,
            x: f.x,
            y: f.y,
            w: f.w,
            h: f.h,
            name: f.frameName,
            width: st.size,
            opacity: st.opacity,
          };
        }
        if (st.figure) {
          const { d, head } = figureMarkup(st.figure, st.size);
          return {
            id: st.id,
            kind: "figure" as const,
            d,
            head,
            width: st.size,
            color: st.color,
            opacity: st.opacity,
            fill: st.figure.fill ?? false,
            fillColor: st.figure.fillColor ?? null,
            dash: st.figure.dash ?? "solid",
          };
        }
        if (st.image) {
          const [x, y] = st.points[0] ?? [0, 0];
          return {
            id: st.id,
            kind: "image" as const,
            data: st.image.data,
            x,
            y,
            w: st.image.w,
            h: st.image.h,
            opacity: st.opacity,
          };
        }
        if (st.text) {
          const [x, y] = st.points[0] ?? [0, 0];
          return {
            id: st.id,
            kind: "text" as const,
            content: st.text.content,
            x,
            y,
            size: st.text.size,
            w: st.text.w,
            h: st.text.h,
            font: st.text.font,
            bold: st.text.bold,
            italic: st.text.italic,
            align: st.text.align,
            background: st.text.background,
            color: st.color,
            opacity: st.opacity,
          };
        }
        return {
          id: st.id,
          kind: "stroke" as const,
          d: strokePath(st.pen, st.size, st.points, true, st.shape),
          color: st.color,
          opacity: st.opacity,
          blend: PEN_BY_ID[st.pen].blend === "multiply",
          dot: st.points.length
            ? { x: st.points[0][0], y: st.points[0][1], r: dotRadius(st.size) }
            : null,
        };
      }),
    }));
  }, [drawing.strokes, uid]);

  // Remember where it was so the ring can fade from its last position instead
  // of jumping to the origin as hover clears.
  const lastHover = useRef<{ x: number; y: number } | null>(null);
  if (hover) lastHover.current = hover;

  const overBoard =
    hover &&
    hover.x >= 0 &&
    hover.y >= 0 &&
    hover.x <= board.w &&
    hover.y <= board.h;

  const v = viewRef.current;

  // The selection chrome, in the board's own units.
  const selectionChrome = (() => {
    const ids = selection.filter((id) => drawing.strokes.some((s) => s.id === id));
    if (!ids.length) return null;
    const u = selUnion(ids);
    const k = v.k;
    const s = 1 / k;
    const cx = u.x + u.w / 2;
    const cy = u.y + u.h / 2;
    const r = 5.5 * s;
    const spot = (hx: number, hy: number) => ({
      x: u.x + (u.w / 2) * (hx + 1) - r,
      y: u.y + (u.h / 2) * (hy + 1) - r,
    });
    const cursors = [
      "nwse-resize", "ns-resize", "nesw-resize", "ew-resize",
      "nwse-resize", "ns-resize", "nesw-resize", "ew-resize",
    ];
    return (
      <g pointerEvents="none">
        <rect
          x={u.x}
          y={u.y}
          width={u.w}
          height={u.h}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5 * s}
          strokeDasharray={`6 ${4 * s}`}
        />
        {HANDLES.map(([hx, hy], i) => {
          const p = spot(hx, hy);
          return (
            <rect
              key={i}
              data-handle={i}
              x={p.x}
              y={p.y}
              width={r * 2}
              height={r * 2}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={1.5 * s}
              style={{ cursor: cursors[i], pointerEvents: "all" }}
            />
          );
        })}
        {/* The rotate handle, on a stem above the top edge. */}
        <line
          x1={cx}
          y1={u.y}
          x2={cx}
          y2={u.y - 26 * s}
          stroke="#3b82f6"
          strokeWidth={1.5 * s}
        />
        <circle
          data-handle={8}
          cx={cx}
          cy={u.y - 26 * s}
          r={r}
          fill="#fff"
          stroke="#3b82f6"
          strokeWidth={1.5 * s}
          style={{ cursor: "crosshair", pointerEvents: "all" }}
        />
        {/* A single line or arrow bends from its curve's midpoint. */}
        {ids.length === 1 &&
          (() => {
            const lone = drawing.strokes.find((st) => st.id === ids[0]);
            const lf = lone?.figure;
            if (
              !lf ||
              (lf.kind !== "line" && lf.kind !== "arrow" && lf.kind !== "double-arrow")
            ) {
              return null;
            }
            const [mx, my] = curveMid(lf);
            return (
              <circle
                data-handle={9}
                cx={mx}
                cy={my}
                r={r}
                fill="#fff"
                stroke="#3b82f6"
                strokeWidth={1.5 * s}
                style={{ cursor: "crosshair", pointerEvents: "all" }}
              />
            );
          })()}
        {/* The centre point: useful when rotating several things at once. */}
        <circle cx={cx} cy={cy} r={2.5 * s} fill="#3b82f6" />
      </g>
    );
  })();

  const ringOn = showBrushCursor && tool.kind !== "select" && tool.kind !== "text";
  const panning = gesture.current.mode === "pan" || spaceHeld.current;
  const cursor = disabled
    ? "default"
    : panning
      ? "grabbing"
      : tool.kind === "select"
        ? "default"
        : tool.kind === "text"
          ? "text"
          : showBrushCursor
            ? "none"
            : "crosshair";

  return (
    <svg
      ref={ref}
      width="100%"
      height="100%"
      viewBox={`${v.x} ${v.y} ${board.w / v.k} ${board.h / v.k}`}
      className={className}
      style={{
        display: "block",
        pointerEvents: disabled ? "none" : undefined,
        touchAction: disabled ? "auto" : "none",
        WebkitUserSelect: disabled ? "auto" : "none",
        userSelect: disabled ? "auto" : "none",
        WebkitTapHighlightColor: "transparent",
        cursor,
        ...style,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      onPointerLeave={(e) => {
        setHover(null);
        finishGesture(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // A right-click on an element brings it into the hand first, so the
        // menu acts on what the pointer is on.
        const { x, y } = toBoard(e.clientX, e.clientY);
        for (let i = drawing.strokes.length - 1; i >= 0; i--) {
          const s = drawing.strokes[i];
          if (s.erase) continue;
          if (!hitTest(s, x, y)) continue;
          const picked = expandGroup(s.id);
          if (!selection.includes(s.id)) {
            state.current.onSelection?.(picked);
            state.current.selection = picked;
          }
          break;
        }
        onContextMenu?.(e, { x, y });
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = Array.from(e.dataTransfer.files).find((f) =>
          f.type.startsWith("image/"),
        );
        if (!file) return;
        const p = toBoard(e.clientX, e.clientY);
        readImageFile(file, p, state.current.drawing, (id) =>
          state.current.onSelection?.([id]),
        );
      }}
      onDoubleClick={(e) => {
        // With the select tool, opening an existing mark for editing is a
        // double-click, like every other editor.
        if (tool.kind !== "select") return;
        const { x, y } = toBoard(e.clientX, e.clientY);
        for (let i = drawing.strokes.length - 1; i >= 0; i--) {
          const s = drawing.strokes[i];
          if (s.erase || s.locked || !s.text) continue;
          if (hitTest(s, x, y)) {
            beginText({ x, y }, s);
            return;
          }
        }
      }}
    >
      <defs>
        <pattern
          id={`c-${uid}`}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <rect width="16" height="16" fill="#fff" />
          <rect width="8" height="8" fill="#ececec" />
          <rect x="8" y="8" width="8" height="8" fill="#ececec" />
        </pattern>
        <pattern
          id={`g-${uid}`}
          width={GRID}
          height={GRID}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M${GRID} 0H0V${GRID}`}
            fill="none"
            stroke="#000"
            strokeOpacity="0.07"
            strokeWidth="1"
          />
        </pattern>
        <clipPath id={`b-${uid}`}>
          <rect
            x={v.x}
            y={v.y}
            width={board.w / v.k}
            height={board.h / v.k}
          />
        </clipPath>
      </defs>

      <g>
        <rect
          x={v.x}
          y={v.y}
          width={board.w / v.k}
          height={board.h / v.k}
          fill={
            background === "transparent"
              ? "none"
              : background === "checker"
                ? `url(#c-${uid})`
                : background
          }
        />

        <g clipPath={`url(#b-${uid})`}>
          {grid && (
            <rect
              x={v.x}
              y={v.y}
              width={board.w / v.k}
              height={board.h / v.k}
              fill={`url(#g-${uid})`}
            />
          )}
          {layers.map((layer, li) => {
            // The pass in progress subtracts too, so erasing is visible under
            // the nub as it happens rather than only on release.
            const live =
              tool.kind === "eraser" &&
              current.length > 0 &&
              li === layers.length - 1
                ? [{ d: polylinePath(current), width: tool.size }]
                : [];
            const cuts = [...layer.erasers, ...live];
            const maskId = `e-${uid}-${li}`;
            return (
              <g key={li} mask={cuts.length ? `url(#${maskId})` : undefined}>
                {cuts.length > 0 && (
                  <defs>
                    <mask
                      id={maskId}
                      maskUnits="userSpaceOnUse"
                      x={v.x}
                      y={v.y}
                      width={board.w / v.k}
                      height={board.h / v.k}
                    >
                      <rect
                        x={v.x}
                        y={v.y}
                        width={board.w / v.k}
                        height={board.h / v.k}
                        fill="#fff"
                      />
                      {cuts.map((c, ci) => (
                        <path
                          key={ci}
                          d={c.d}
                          fill="none"
                          stroke="#000"
                          strokeWidth={c.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </mask>
                  </defs>
                )}
                {layer.ink.map((s) => {
                  const rot = drawing.strokes.find((st) => st.id === s.id);
                  const rotate = rot?.rotate;
                  const g =
                    s.kind === "frame" ? (
                      <FrameShape x={s.x} y={s.y} w={s.w} h={s.h} name={s.name} width={s.width} />
                    ) : s.kind === "figure" ? (
                      <FigureShape
                        d={s.d}
                        head={s.head}
                        width={s.width}
                        color={s.color}
                        opacity={s.opacity}
                        fill={s.fill}
                        fillColor={s.fillColor}
                        dash={s.dash}
                      />
                    ) : s.kind === "image" ? (
                      <image
                        x={s.x}
                        y={s.y}
                        width={s.w}
                        height={s.h}
                        href={s.data}
                        preserveAspectRatio="none"
                        opacity={s.opacity}
                      />
                    ) : s.kind === "text" ? (
                      <TextShape {...s} />
                    ) : s.d ? (
                      <path
                        d={s.d}
                        fill={s.color}
                        fillOpacity={s.opacity}
                        style={s.blend ? { mixBlendMode: "multiply" } : undefined}
                      />
                    ) : s.dot ? (
                      <circle
                        cx={s.dot.x}
                        cy={s.dot.y}
                        r={s.dot.r}
                        fill={s.color}
                        fillOpacity={s.opacity}
                        style={s.blend ? { mixBlendMode: "multiply" } : undefined}
                      />
                    ) : null;
                  if (!g) return null;
                  if (!rotate) return <g key={s.id}>{g}</g>;
                  const b = boundsOf(rot!);
                  const [cx, cy] = centreOf(b);
                  return (
                    <g
                      key={s.id}
                      transform={`rotate(${rotate} ${cx} ${cy})`}
                    >
                      {g}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {tool.kind === "pen" && current.length > 0 && (
            <path
              d={strokePath(tool.pen, tool.size, current, false, {
                ...tool.shape,
                simulatePressure: !realPressure.current,
              })}
              fill={tool.color}
              fillOpacity={tool.opacity}
              style={
                PEN_BY_ID[tool.pen].blend === "multiply"
                  ? { mixBlendMode: "multiply" }
                  : undefined
              }
            />
          )}

          {tool.kind !== "pen" &&
            tool.kind !== "eraser" &&
            tool.kind !== "select" &&
            tool.kind !== "text" &&
            current.length > 1 &&
            (tool.kind === "frame" ? (
              (() => {
                const f = anchorsToShape(tool.kind, current[0], current[1]);
                return (
                  <FrameShape
                    x={f.x}
                    y={f.y}
                    w={f.w}
                    h={f.h}
                    width={tool.size}
                  />
                );
              })()
            ) : (
              (() => {
                const { d, head } = figureMarkup(
                  anchorsToShape(tool.kind, current[0], current[1]),
                  tool.size,
                );
                return (
                  <FigureShape
                    d={d}
                    head={head}
                    width={tool.size}
                    color={tool.color}
                    opacity={tool.opacity}
                  />
                );
              })()
            ))}

          {/* The text being typed, live under the overlay. */}
          {editing && (
            <TextShape
              id={editing.id ?? -1}
              content={editing.content}
              x={editing.x}
              y={editing.y}
              size={editing.size}
              w={editing.w}
              h={editing.h}
              font={editing.font}
              bold={editing.bold}
              italic={editing.italic}
              align={editing.align}
              background={editing.background}
              color={editing.color}
              opacity={1}
            />
          )}

          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="rgba(59,130,246,0.08)"
              stroke="#3b82f6"
              strokeWidth={1 / v.k}
              strokeDasharray={`${5 / v.k} ${4 / v.k}`}
            />
          )}

          {selectionChrome}

          {/* The editing overlay, sized and positioned like the mark. */}
          {editing && (
            <foreignObject
              x={editing.x}
              y={editing.y}
              width={Math.max(8, editing.w)}
              height={Math.max(lineHeight(editing.size), editing.h)}
            >
              <div style={{ width: "100%", height: "100%" }}>
                <textarea
                  autoFocus
                  value={editing.content}
                  placeholder="Type…"
                  style={{
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    resize: "none",
                    border: 0,
                    outline: "none",
                    padding: 0,
                    background: "transparent",
                    color: editing.color,
                    fontFamily: editing.font,
                    fontSize: editing.size,
                    fontWeight: editing.bold ? 700 : 400,
                    fontStyle: editing.italic ? "italic" : "normal",
                    textAlign: editing.align ?? "left",
                    lineHeight: 1.35,
                    overflow: "hidden",
                    whiteSpace: "pre",
                  }}
                  onChange={(e) =>
                    setEditing((d) => (d ? { ...d, content: e.target.value } : d))
                  }
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitText();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      commitText();
                    }
                  }}
                />
              </div>
            </foreignObject>
          )}
        </g>

        {/* Kept mounted and faded, so crossing onto the toolbar is a soft
            hand-off to the system cursor rather than a blink. */}
        {ringOn && lastHover.current && (
          <g
            opacity={overBoard ? 1 : 0}
            style={{ transition: "opacity 120ms ease" }}
            pointerEvents="none"
          >
            <BrushCursor
              tool={tool}
              at={lastHover.current}
              scale={v.k}
              background={background}
            />
          </g>
        )}
      </g>
    </svg>
  );
}

/**
 * Read an image file in at a board point, sized to the page, and commit it
 * through the surface's own controller — selected on arrival.
 */
export function readImageFile(
  file: File,
  at: { x: number; y: number },
  drawing: DrawingController,
  onAdded?: (id: number) => void,
) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result as string;
    const img = new Image();
    img.onload = () => {
      const max = 640;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const stroke: Stroke = {
        id: nextId(),
        pen: "pen" as const,
        color: "#000",
        size: 1,
        opacity: 1,
        points: [[at.x, at.y, 0.5]],
        image: {
          data,
          w: Math.max(1, img.width * scale),
          h: Math.max(1, img.height * scale),
        },
      };
      drawing.commit([...drawing.strokes, stroke]);
      onAdded?.(stroke.id);
    };
    img.src = data;
  };
  reader.readAsDataURL(file);
}

/** A geometric figure, drawn the way an outline is on paper: a stroked shaft
    at the tool's width, a filled head on top for an arrow, and a fill when
    the shape asks for one — a plain wash, or hatch lines for the drawn look. */
function FigureShape({
  d,
  head,
  width,
  color,
  opacity,
  fill,
  fillColor,
  dash,
}: {
  d: string;
  head?: string;
  width: number;
  color: string;
  opacity: number;
  fill?: FigureFill | boolean;
  fillColor?: string | null;
  dash?: FigureDash;
}) {
  const uid = useId().replace(/:/g, "");
  const closed = d.endsWith("Z");
  const mode: FigureFill | null =
    fill === true ? "solid" : fill === false || !fill ? null : fill;
  /** The fill's own colour, or the stroke colour when it has none. */
  const ink = fillColor ?? color;
  const hatch = (id: string, angle: number) => (
    <pattern
      id={id}
      width="8"
      height="8"
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${angle})`}
    >
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="8"
        stroke={ink}
        strokeOpacity={0.25 * opacity}
        strokeWidth={1.2}
      />
    </pattern>
  );
  return (
    <g opacity={opacity}>
      {closed && mode === "solid" && (
        <path d={d} fill={ink} fillOpacity={0.22 * opacity} />
      )}
      {closed && (mode === "hachure" || mode === "cross-hatch") && (
        <g>
          <defs>
            {hatch(`h-${uid}`, 45)}
            {mode === "cross-hatch" && hatch(`x-${uid}`, -45)}
          </defs>
          <path d={d} fill={`url(#h-${uid})`} />
          {mode === "cross-hatch" && <path d={d} fill={`url(#x-${uid})`} />}
        </g>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash ? dashArray(dash as never) : undefined}
      />
      {head ? <path d={head} fill={color} /> : null}
    </g>
  );
}

/** A frame: a light container box with a dashed edge and its name in the
    top-left corner. It reads as a region, not an outline. */
function FrameShape({
  x,
  y,
  w,
  h,
  name,
  width,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  width: number;
}) {
  const d = `M${x} ${y}h${w}v${h}h${-w}Z`;
  return (
    <g opacity={0.9}>
      <path d={d} fill="rgba(80,140,255,0.08)" />
      <path
        d={d}
        fill="none"
        stroke="rgba(80,140,255,0.6)"
        strokeWidth={Math.max(1, width)}
        strokeDasharray="6 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {name ? (
        <text
          x={x + 6}
          y={y + 14}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="12"
          fontWeight="600"
          fill="#5a8dff"
        >
          {name}
        </text>
      ) : null}
    </g>
  );
}

/** A committed text mark, one tspan per line. */
function TextShape({
  content,
  x,
  y,
  size,
  w,
  h,
  font,
  bold,
  italic,
  align,
  background,
  color,
  opacity,
}: {
  id: number;
  content: string;
  x: number;
  y: number;
  size: number;
  w: number;
  h: number;
  font: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  background?: string;
  color: string;
  opacity: number;
}) {
  const lineH = lineHeight(size);
  const lines = content.split("\n");
  // Where the lines sit inside the mark's box, and how each is anchored.
  const tx =
    align === "center" ? x + w / 2 : align === "right" ? x + w : x;
  const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  return (
    <g opacity={opacity}>
      {background && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={Math.min(4, size / 4)}
          fill={background}
        />
      )}
      <text
        x={tx}
        textAnchor={anchor}
        y={y + size * 0.85}
        fontFamily={font}
        fontSize={size}
        fontWeight={bold ? 700 : undefined}
        fontStyle={italic ? "italic" : undefined}
        fill={color}
        fillOpacity={opacity}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={tx} dy={i === 0 ? 0 : lineH}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Whether a colour is light. */
function isPale(hex: string) {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const l =
    0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l / 255 > 0.72;
}

/**
 * The smallest the ring is ever drawn, in screen pixels.
 *
 * The pencil's nib is one unit across, which put the ring at half a pixel: the
 * cursor simply wasn't there for the tool people reach for first. Below this
 * the nib is finer than anything that could be drawn to represent it, so the
 * ring stops reporting size and just says where the point is.
 */
const MIN_RADIUS = 3.5;

/** The pointer, drawn as the mark the tool is about to make. */
function BrushCursor({
  tool,
  at,
  scale,
  background,
}: {
  tool: Exclude<Tool, { kind: "select" } | { kind: "text" }>;
  at: { x: number; y: number };
  scale: number;
  /** Tints the eraser's fill; the rings carry their own contrast. */
  background: string;
}) {
  const hair = 1 / scale;
  const onDark = !isPale(background) && background !== "transparent";
  const r = Math.max(tool.kind === "eraser" ? tool.size / 2 : tool.size / 2, MIN_RADIUS / scale);

  /*
   * One ring on a dark canvas, two on a light one.
   *
   * The pale ring exists for the case the background prop can't answer: on
   * paper, the pointer spends most of its time over ink that has already been
   * laid down, and a dark hairline over a black stroke is nothing. Underneath a
   * dark hairline it reads as a sliver of light either side of a dark line.
   *
   * On a dark canvas that same pair reads as a double outline instead — white,
   * dark, white — because there is no dark backdrop for the dark line to
   * disappear into, so both edges of the halo stay visible. Any concentric
   * sandwich does this; it is only invisible when the outer ring matches what
   * is behind it. So on dark there is one pale ring and nothing else, which is
   * legible over dark paper and over dark ink alike.
   */
  const stroke = onDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.62)";
  const halo = onDark ? null : (
    <circle
      cx={at.x}
      cy={at.y}
      r={r}
      fill="none"
      stroke="rgba(255,255,255,0.92)"
      strokeWidth={hair * 3}
    />
  );

  if (tool.kind === "eraser") {
    return (
      <>
        {halo}
        <circle
          cx={at.x}
          cy={at.y}
          r={r}
          fill={onDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}
          stroke={stroke}
          strokeWidth={hair}
        />
        {!onDark && (
          <path
            d={`M${at.x - 3 * hair} ${at.y}h${6 * hair}M${at.x} ${at.y - 3 * hair}v${6 * hair}`}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={hair * 2.5}
          />
        )}
        <path
          d={`M${at.x - 3 * hair} ${at.y}h${6 * hair}M${at.x} ${at.y - 3 * hair}v${6 * hair}`}
          stroke={stroke}
          strokeWidth={hair}
        />
      </>
    );
  }

  /*
   * Every pen gets the same ring, the nib pens included. Drawing the nib's own
   * angled edge is more literal but worse to aim with: it changes length as you
   * turn, so the cursor stops being a reliable indication of where the mark will
   * land and how big it will be.
   *
   * One neutral ring, never the ink. Drawing it in the current colour was the
   * clever version and the wrong one — a pale ink is invisible on pale paper.
   * Which ink is loaded is already answered by the tool standing lit in the
   * tray, by the colour in the bar, and by the mark itself the moment you draw.
   */
  return (
    <>
      {halo}
      <circle
        cx={at.x}
        cy={at.y}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={hair}
      />
    </>
  );
}