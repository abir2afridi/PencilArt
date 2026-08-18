import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { PENS, PEN_BY_ID } from "../engine/pens";
import { SHAPES, SHAPE_BY_ID, isShape } from "../engine/shapes";
import { unionBounds } from "../engine/geometry";
import { remapStrokes } from "../engine/import";
import { toPng, toSvg } from "../engine/serialize";
import type { TooltipOptions } from "./Tooltip";
import type { Board, Box, PenId, ShapeKind, Stroke, ToolId } from "../engine/types";
import { useDrawing } from "../hooks/use-drawing";
import { useClipboard } from "../hooks/use-clipboard";
import {
  useSelection,
  type AlignHow,
  type ReorderHow,
  type StylePatch,
} from "../hooks/use-selection";
import {
  DrawSurface,
  readImageFile,
  ZOOM_MAX,
  ZOOM_MIN,
  type Tool,
  type View,
} from "./DrawSurface";
import { Toolbar, type ToolState } from "./Toolbar";
import { ShapeIcon, ToolGlyph, ToolIcon } from "./ToolIcon";
import css from "./Draw.module.css";
import "./tokens.css";

/** Where the autosave lives: one slot per page, so several drawings on the
    same host never fight over the drawing. */
const AUTOSAVE_KEY = "pencilart:autosave:v1";

/** Every shape tool, in tray order. */
const ALL_SHAPES = SHAPES.map((s) => s.kind);

/** Which of the built-in controls the toolbar offers. */
export type DrawControls = {
  /** Ink colour: the swatches, and the hex/eyedropper panel behind them. */
  color?: boolean;
  /** The size slider, and the opacity slider, separately. */
  size?: boolean;
  opacity?: boolean;
  undo?: boolean;
  clear?: boolean;
  /** The select tool; it and the text tool default on. */
  select?: boolean;
  /** The text tool. */
  text?: boolean;
  /**
   * The swatch that opens the hex field and the spectrum.
   *
   * On by default, and worth turning off on a phone, where a brand palette is
   * usually the whole point and picking an arbitrary colour on a small screen
   * is fiddly enough that nobody does it.
   */
  custom?: boolean;
  /** The button that collapses the bar into a disc. */
  minimize?: boolean;
};

/** How ink colour is shared between the tools. */
export type InkMode =
  /** One colour for everything. The highlighter is yellow like anything else. */
  | "shared"
  /** Every tool remembers its own, and the tray shows what each will draw with. */
  | "per-tool"
  /**
   * Shared, except where a tool only makes sense in its own colour — which in
   * practice means the highlighter starts yellow. The default.
   */
  | "auto";

/** How an export may be shaped. `scale` multiplies pixels on the PNG only;
    `transparent` drops the page background; `selection` exports just the
    elements in hand, cropped to them. */
export type ExportOptions = {
  scale?: number;
  transparent?: boolean;
  selection?: boolean;
};

/** What `Draw` exposes to the code that mounts it. */
export type DrawHandle = {
  /** The drawing as a standalone SVG string. */
  toSvg: (opts?: ExportOptions) => string;
  /** The drawing rasterised. `scale` is a device-pixel multiplier. */
  toPng: (opts?: ExportOptions) => Promise<Blob>;
  /** Save straight to a file. Extension picked from the format. */
  download: (
    name?: string,
    format?: "svg" | "png",
    opts?: ExportOptions,
  ) => Promise<void>;
  getStrokes: () => Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
  /** Whether there's anything to undo. */
  canUndo: () => boolean;
  /** Whether there's anything to redo. */
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  /** Pick up a tool, exactly as if it were clicked in the tray. */
  selectTool: (id: ToolId) => void;
  /** The surface size the drawing is being made at. */
  getSize: () => Board;
  /** The elements in hand, by id. */
  getSelection: () => number[];
  /** Take the elements in hand. */
  setSelection: (ids: number[]) => void;
  /** The part of the board in view. */
  getView: () => View;
  /** Zoom by a factor about the centre of the view. */
  zoomBy: (factor: number) => void;
  /** Back to the board's own scale, at its origin. */
  zoomReset: () => void;
  /** Bring everything that has been drawn into view. */
  zoomFit: () => void;
  /** Bring the elements in hand into view. */
  zoomToSelection: () => void;
  /** Restyle the elements in hand as one undoable step. */
  styleSelection: (patch: StylePatch) => void;
  /** Align the elements in hand to an edge of their union box. */
  alignSelection: (how: AlignHow) => void;
  /** Space the elements in hand evenly; needs at least three. */
  distributeSelection: (axis: "h" | "v") => void;
  /** Re-order the elements in hand within the stack. */
  reorderSelection: (how: ReorderHow) => void;
  /** Group the elements in hand, or break them out of their groups. */
  groupSelection: () => void;
  ungroupSelection: () => void;
  /** Freeze the elements in hand in place, or set them loose again. */
  toggleLockSelection: () => void;
  /** Read an image file in at the centre of the view, selected on arrival. */
  addImage: (file: File) => void;
  /** Bring strokes in from outside (a saved drawing, the library), ids and
      groups made fresh, centred on the view and selected. */
  addStrokes: (strokes: Stroke[]) => void;
};

/**
 * `rise` comes in off whichever edge the bar is on and leaves back through it.
 * `none` is instant, and is also what a reduced-motion setting falls back to.
 */
export type MotionPreset = "rise" | "none";

export type MotionOptions = {
  in?: MotionPreset;
  out?: MotionPreset;
  /** Milliseconds, for both directions. */
  duration?: number;
};

export type DrawProps = {
  /** Fixed surface size. Omit and it matches the element, which is usually
   * what you want — a fixed board letterboxes inside its container. */
  board?: Board;
  /** The canvas colour. */
  background?: string;
  /** Strokes to start from. */
  initialStrokes?: Stroke[];
  /** Keep the drawing in localStorage, and pick it up again on the next
   *  visit. Only applies to a host-owned board (no `initialStrokes`). */
  autosave?: boolean;
  onChange?: (strokes: Stroke[]) => void;
  /** Fired with the tool state whenever the tool in hand changes. */
  onToolChange?: (tool: ToolState) => void;
  /** Fired with the elements in hand whenever the selection changes. */
  onSelectionChange?: (ids: number[]) => void;
  /** Fired with the part of the board in view whenever it changes. */
  onViewChange?: (view: View) => void;
  /** Turn the built-in chrome off and drive it yourself. */
  chrome?: boolean;
  /**
   * How the bar arrives and leaves when `chrome` is switched.
   *
   * A single name sets both directions; the object form is for when they
   * differ. `duration` is milliseconds and covers whichever way is playing.
   */
  motion?: MotionPreset | MotionOptions;
  /** Which edge the toolbar sits on. */
  placement?: "bottom" | "left" | "right";
  /** How far the bar sits from its edge. A number is pixels. */
  inset?: number | string;
  /** Where along that edge it sits. */
  align?: "start" | "center" | "end";
  /** "auto" follows the OS; the others force it. */
  theme?: "light" | "dark" | "auto";
  /**
   * Whether the surface still accepts strokes while the toolbar is
   * minimised.
   */
  drawWhenMinimized?: boolean;
  /** Whether the bar starts collapsed. */
  startMinimized?: boolean;
  /** Whether the keyboard shortcuts are live. */
  shortcuts?: boolean;
  /** The colours offered in the picker, in place of the built-in palette. */
  swatches?: string[];
  /** Hover labels. */
  tooltips?: boolean | TooltipOptions;
  /** Which tools appear, and in what order. Pens and shapes can be mixed. */
  tools?: (PenId | ShapeKind)[];
  /** The shape tools in the tray, after the pens. An empty array hides the
   *  whole row — useful when a host offers the shapes in its own chrome. */
  shapes?: ShapeKind[];
  /** Whether the eraser is offered. */
  eraser?: boolean;
  /** Which of the built-in controls to show. All of them by default. */
  controls?: DrawControls;
  /** Where size and opacity live. */
  settings?: "bar" | "tool";
  /** How the tools are drawn. */
  look?: "classic" | "studio";
  /** Print the current size on the barrel of the pen in hand. */
  gauge?: boolean;
  /** Let the toolbar be picked up and moved around the surface. */
  draggable?: boolean;
  /** How ink colour is shared between tools. */
  ink?: InkMode;
  /** How much the toolbar reads as a physical object. */
  depth?: "flat" | "soft" | "regular" | "strong";
  /** Draw a GRID-unit lattice under the ink, and snap draws and drags to it. */
  grid?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Drawing, with everything switched on. */
export const Draw = forwardRef<DrawHandle, DrawProps>(function Draw(
  {
    board,
    background = "#ffffff",
    initialStrokes,
    onChange,
    onToolChange,
    onSelectionChange,
    onViewChange,
    chrome = true,
    motion,
    placement = "bottom",
    inset,
    align = "center",
    theme = "light",
    drawWhenMinimized = false,
    startMinimized = false,
    shortcuts = true,
    swatches,
    tooltips = true,
    tools,
    shapes,
    eraser = true,
    controls,
    settings = "bar",
    look = "classic",
    gauge = false,
    draggable = false,
    ink: inkMode = "auto",
    depth = "regular",
    grid = false,
    autosave = false,
    className,
    style,
  },
  ref,
) {
  // A host-owned board (initialStrokes) is the host's business: autosave only
  // runs on the blank page, and picks up where the last visit left off.
  const autosaveHere = autosave && !initialStrokes;
  const [booted] = useState<Stroke[]>(() => {
    if (!autosaveHere) return [];
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { strokes?: Stroke[] };
      return Array.isArray(parsed.strokes) ? parsed.strokes : [];
    } catch {
      return [];
    }
  });
  const drawing = useDrawing(initialStrokes ?? (autosaveHere ? booted : []));
  useEffect(() => {
    if (!autosaveHere) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ strokes: drawing.strokes }));
    } catch {
      /* a full or private store is fine to ignore */
    }
  }, [autosaveHere, drawing.strokes]);
  const root = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(startMinimized);
  const [measured, setMeasured] = useState<Board>({ w: 1600, h: 1000 });

  /** The right-click menu: where it sits, or nothing while it's closed. */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  /** The shortcut help panel: open while `?` says so. */
  const [help, setHelp] = useState(false);

  // Help goes away on Escape or on an outside press, like the menu.
  useEffect(() => {
    if (!help) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.("[data-help-panel]")) return;
      setHelp(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelp(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [help]);

  // The menu goes away on an outside press, on Escape, and after an action.
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.("[data-ctx-menu]")) return;
      setMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  /** The elements in hand, and everything that can be done to them. */
  const {
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
  } = useSelection(drawing);

  /** The part of the board in view. */
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });

  // Report the selection and the view, like the strokes and the tool.
  const reportedSelection = useRef(onSelectionChange);
  reportedSelection.current = onSelectionChange;
  const reportedView = useRef(onViewChange);
  reportedView.current = onViewChange;

  /** Clipboard events land only while the surface has the focus. */
  const inScope = useCallback(() => {
    const el = root.current;
    if (!el) return false;
    const a = document.activeElement;
    return el.contains(a) || a === document.body || a === el;
  }, []);

  useClipboard(drawing, {
    getSelection: () => selection,
    viewCentre: () => {
      const v = view;
      return {
        x: v.x + surfaceBoard.w / v.k / 2,
        y: v.y + surfaceBoard.h / v.k / 2,
      };
    },
    inScope,
    onPasted: setSelection,
    board: () => ({ w: surfaceBoard.w, h: surfaceBoard.h, paint }),
  });

  /** The ink to start with. */
  const startingInk = theme === "dark" ? "#f2f1ef" : "#111111";

  /** The colour to actually lay down, or nothing. */
  const paint =
    background === "transparent" || background === "checker"
      ? null
      : background;

  const [tool, setTool] = useState<ToolState>({
    active: "pen",
    color: startingInk,
    size: PEN_BY_ID.pen.defaultSize,
    opacity: PEN_BY_ID.pen.defaultOpacity,
    eraserSize: 28,
  });

  // The surface is the element. Matching the board to it means no letterboxing,
  // so pointer and ink agree everywhere, and the whole area is drawable.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setMeasured({ w: Math.round(width), h: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const surfaceBoard = board ?? measured;

  /** Bring a box into view, padded, centred, clamped to the zoom limits. */
  const fitBounds = useCallback(
    (b: Box, pad: number) => {
      const w = b.w + pad * 2;
      const h = b.h + pad * 2;
      if (!(w > 0 && h > 0)) {
        setView({ x: 0, y: 0, k: 1 });
        reportedView.current?.({ x: 0, y: 0, k: 1 });
        return;
      }
      const k = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.min(surfaceBoard.w / w, surfaceBoard.h / h)),
      );
      const next = {
        x: b.x - pad + (surfaceBoard.w / k - w) / 2,
        y: b.y - pad + (surfaceBoard.h / k - h) / 2,
        k,
      };
      setView(next);
      reportedView.current?.(next);
    },
    [surfaceBoard],
  );

  /** The pens on offer, in the order asked for. */
  const pens = useMemo(
    () =>
      tools
        ? tools
            .filter((id): id is PenId => !isShape(id))
            .map((id) => PEN_BY_ID[id])
        : PENS,
    [tools],
  );

  /** The shape tools on offer, in the order asked for. A `shapes` prop wins;
    otherwise the tools list decides, and everything is offered without one. */
  const shapeTools = useMemo(
    () =>
      shapes ?? (tools ? tools.filter(isShape) : ALL_SHAPES),
    [tools, shapes],
  );

  // Report changes without making the caller own the state.
  const changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => {
    changed.current?.(drawing.strokes);
  }, [drawing.strokes]);

  // Report the tool in hand the same way, so a host can mirror it elsewhere.
  const reportedTool = useRef(onToolChange);
  reportedTool.current = onToolChange;
  useEffect(() => {
    reportedTool.current?.(tool);
  }, [tool]);

  /** The ink each pen was last used in. */
  const [inks, setInks] = useState<Partial<Record<PenId, string>>>({});
  /**
   * What each pen was last set to, for pens that have been adjusted.
   *
   * Held as a ref rather than state: nothing renders from it, it's only read
   * when a tool is picked up again. A pen that's never been touched isn't in
   * here at all, so it still opens at its own default.
   */
  const tuned = useRef<Partial<Record<ToolId, { size: number; opacity: number }>>>(
    {},
  );
  /** The colour shared by every pen that doesn't keep one of its own. */
  const [ink, setInk] = useState(startingInk);
  /** Whether a colour has actually been chosen. */
  const chosen = useRef(false);

  useEffect(() => {
    if (chosen.current) return;
    setInk(startingInk);
    setTool((t) => ({ ...t, color: startingInk }));
  }, [startingInk]);

  /** `auto` resolves after mount, never during render. */
  useEffect(() => {
    if (theme !== "auto" || chosen.current) return;
    if (!window.matchMedia?.("(prefers-color-scheme: dark)").matches) return;
    setInk("#f2f1ef");
    setTool((t) => ({ ...t, color: "#f2f1ef" }));
  }, [theme]);

  const inkFor = useCallback(
    (id: PenId) =>
      inkMode === "shared"
        ? ink
        : (inks[id] ??
          // A pen with a colour of its own opens in it, but only until a
          // colour is actually chosen — after that, a pick of red followed
          // by the highlighter laying down yellow reads as a broken picker.
          (inkMode === "auto" && !chosen.current
            ? PEN_BY_ID[id].defaultColor
            : undefined) ??
          ink),
    [inks, ink, inkMode],
  );

  const select = useCallback(
    (id: ToolId) => {
      if (id === "eraser") return setTool((t) => ({ ...t, active: "eraser" }));
      // The selection tools have no implements to tune; the text tool opens
      // at the size it was last used in, a usable 24 the first time.
      if (id === "select" || id === "text") {
        const last = tuned.current[id];
        return setTool((t) => ({
          ...t,
          active: id,
          size: id === "text" ? (last?.size ?? 24) : t.size,
          opacity: last?.opacity ?? t.opacity,
          color: id === "text" ? inkFor("pen") : t.color,
        }));
      }
      // A shape has no settings of its own and no per-tool memory: it always
      // opens at its default width in the current ink.
      if (isShape(id)) {
        const def = SHAPE_BY_ID[id];
        return setTool((t) => ({
          ...t,
          active: id,
          size: def.defaultSize,
          opacity: def.defaultOpacity,
          color: inkFor("pen"),
        }));
      }
      const preset = PEN_BY_ID[id];
      // Whatever you last set this pen to, or its default if you never have.
      // Sizes belong to the tool, not to the toolbar: a highlighter set broad
      // and a fineliner set fine are two different decisions, and resetting
      // them on every switch means making the same one repeatedly.
      const last = tuned.current[id];
      setTool((t) => ({
        ...t,
        active: id,
        size: last?.size ?? preset.defaultSize,
        opacity: last?.opacity ?? preset.defaultOpacity,
        color: inkFor(id),
      }));
    },
    [inkFor],
  );

  const patch = useCallback(
    (p: Partial<ToolState>) =>
      setTool((t) => {
        if (p.color && t.active !== "eraser") {
          chosen.current = true;
          // A pen that came with a colour of its own keeps its own until the
          // first choice is made; once one is, every pen follows it. Every
          // other pen writes to the shared ink, so choosing a colour once
          // still applies to all of them.
          const own =
            inkMode === "per-tool" ||
            (inkMode === "auto" &&
              !chosen.current &&
              !isShape(t.active) &&
              Boolean(PEN_BY_ID[t.active as PenId]?.defaultColor));
          if (own)
            setInks((m) => ({ ...m, [t.active as PenId]: p.color as string }));
          else setInk(p.color);
        }
        if (
          (p.size !== undefined || p.opacity !== undefined) &&
          t.active !== "eraser" &&
          !isShape(t.active)
        ) {
          const id = t.active as PenId;
          tuned.current[id] = {
            size: p.size ?? t.size,
            opacity: p.opacity ?? t.opacity,
          };
        }
        return { ...t, ...p };
      }),
    [inkMode],
  );

  /**
   * Step the size of whatever is in hand.
   *
   * Reads through the updater rather than the render's `tool`, because the key
   * handler is bound once and would otherwise nudge a stale size. The eraser
   * has its own width and its own ceiling, and used to be ignored here: the
   * shortcuts moved the pen's size while the eraser carried on at whatever it
   * was.
   */
  const nudgeSize = useCallback((delta: number) => {
    setTool((t) => {
      if (t.active === "eraser") {
        return {
          ...t,
          eraserSize: Math.max(1, Math.min(120, t.eraserSize + delta)),
        };
      }
      // A shape's size comes back from the defaults when it's picked again,
      // so there's nothing per-tool to tune here.
      if (isShape(t.active)) {
        return { ...t, size: Math.max(1, Math.min(80, t.size + delta)) };
      }
      const size = Math.max(1, Math.min(80, t.size + delta));
      tuned.current[t.active] = { size, opacity: t.opacity };
      return { ...t, size };
    });
  }, []);

  useImperativeHandle(ref, (): DrawHandle => {
    /** What an export draws: everything or the elements in hand, cropped to
        them, on the page background unless transparency was asked for. */
    const exportSet = (opts?: ExportOptions) => {
      const strokes = opts?.selection
        ? drawing.strokes.filter((s) => selection.includes(s.id))
        : drawing.strokes;
      const bounds = opts?.selection ? unionBounds(strokes) : undefined;
      const background = opts?.transparent ? "transparent" : paint;
      return { strokes, bounds, background };
    };
    return {
      toSvg: (opts) => {
        const { strokes, bounds, background } = exportSet(opts);
        return toSvg(strokes, surfaceBoard.w, surfaceBoard.h, background, bounds);
      },
      toPng: async (opts) => {
        const { strokes, bounds, background } = exportSet(opts);
        return toPng(
          strokes,
          surfaceBoard.w,
          surfaceBoard.h,
          background,
          opts?.scale ?? 2,
          bounds,
        );
      },
      async download(name = "drawing", format = "svg", opts) {
        const { strokes, bounds, background } = exportSet(opts);
        const blob =
          format === "png"
            ? await toPng(
                strokes,
                surfaceBoard.w,
                surfaceBoard.h,
                background,
                opts?.scale ?? 2,
                bounds,
              )
            : new Blob(
                [toSvg(strokes, surfaceBoard.w, surfaceBoard.h, background, bounds)],
                { type: "image/svg+xml" },
              );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.${format}`;
        a.click();
        // Freed on the next turn: revoking it straight away can beat the
        // browser to actually reading it.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
      getStrokes: () => drawing.strokes,
      setStrokes: (next) => drawing.commit(next),
      canUndo: () => drawing.canUndo,
      canRedo: () => drawing.canRedo,
      undo: drawing.undo,
      redo: drawing.redo,
      clear: drawing.clear,
      selectTool: select,
      getSize: () => surfaceBoard,
      getSelection: () => [...selection],
      setSelection,
      getView: () => ({ ...view }),
      // A host button and the surface's own gestures are two doors onto the
      // same view; both report through the same channel.
      zoomBy: (factor) => {
        const v = view;
        const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * factor));
        if (k === v.k) return;
        const cx = v.x + surfaceBoard.w / v.k / 2;
        const cy = v.y + surfaceBoard.h / v.k / 2;
        const next = {
          x: cx - surfaceBoard.w / k / 2,
          y: cy - surfaceBoard.h / k / 2,
          k,
        };
        setView(next);
        reportedView.current?.(next);
      },
      zoomReset: () => {
        setView({ x: 0, y: 0, k: 1 });
        reportedView.current?.({ x: 0, y: 0, k: 1 });
      },
      zoomFit: () => {
        fitBounds(unionBounds(drawing.strokes), 60);
      },
      zoomToSelection: () => {
        const picked = drawing.strokes.filter((s) => selection.includes(s.id));
        if (!picked.length) return;
        fitBounds(unionBounds(picked), 40);
      },
      styleSelection,
      alignSelection,
      distributeSelection,
      reorderSelection,
      groupSelection,
      ungroupSelection,
      toggleLockSelection,
      addImage: (file) => {
        const v = view;
        readImageFile(
          file,
          {
            x: v.x + surfaceBoard.w / v.k / 2,
            y: v.y + surfaceBoard.h / v.k / 2,
          },
          drawing,
          (id) => setSelection([id]),
        );
      },
      addStrokes: (strokes) => {
        const v = view;
        const added = remapStrokes(
          strokes,
          {
            x: v.x + surfaceBoard.w / v.k / 2,
            y: v.y + surfaceBoard.h / v.k / 2,
          },
        );
        drawing.commit([...drawing.strokes, ...added]);
        setSelection(added.map((s) => s.id));
      },
    };
  }, [
    drawing,
    surfaceBoard,
    background,
    select,
    view,
    selection,
    setSelection,
    fitBounds,
    styleSelection,
    alignSelection,
    distributeSelection,
    reorderSelection,
    groupSelection,
    ungroupSelection,
    toggleLockSelection,
  ]);

  const surfaceTool: Tool = useMemo(
    () =>
      tool.active === "eraser"
        ? { kind: "eraser", size: tool.eraserSize }
        : tool.active === "select"
          ? { kind: "select" }
          : tool.active === "text"
            ? {
                kind: "text",
                color: tool.color,
                size: tool.size,
                opacity: tool.opacity,
              }
            : isShape(tool.active)
              ? {
                  kind: tool.active,
                  color: tool.color,
                  size: tool.size,
                  opacity: tool.opacity,
                }
              : {
                  kind: "pen",
                  pen: tool.active,
                  color: tool.color,
                  size: tool.size,
                  opacity: tool.opacity,
                },
    [tool],
  );

  // Shortcuts are scoped to focus-within, so a drawing embedded in a page
  // never swallows the host's typing.
  const showSelect = controls?.select ?? true;
  const showText = controls?.text ?? true;
  useEffect(() => {
    const el = root.current;
    if (!el || !shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      // While a text mark is being typed (or the host's own fields are
      // focused) the keys belong to the text, not to the tools.
      if (
        (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]")
      ) {
        return;
      }
      if (
        !el.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (meta && k === "z") {
        e.preventDefault();
        return e.shiftKey ? drawing.redo() : drawing.undo();
      }
      // The other redo chord, which Windows and a lot of muscle memory expect.
      if (meta && k === "y") {
        e.preventDefault();
        return drawing.redo();
      }
      if (meta && k === "d") {
        e.preventDefault();
        return duplicateSelection();
      }
      if (meta && k === "a") {
        e.preventDefault();
        return selectAll();
      }
      if (meta && k === "g") {
        e.preventDefault();
        return e.shiftKey ? ungroupSelection() : groupSelection();
      }
      if (meta && k === "l" && e.shiftKey) {
        e.preventDefault();
        return toggleLockSelection();
      }
      if (meta) return;
      // Shift+1 fits the whole drawing; Shift+2 brings the elements in hand
      // into view; ? is the help panel.
      if (e.shiftKey && k === "1") {
        e.preventDefault();
        fitBounds(unionBounds(drawing.strokes), 60);
        return;
      }
      if (e.shiftKey && k === "2") {
        e.preventDefault();
        const picked = drawing.strokes.filter((s) => selection.includes(s.id));
        if (picked.length) fitBounds(unionBounds(picked), 40);
        return;
      }
      if (k === "?") return setHelp((h) => !h);
      if (k === "v" && showSelect) return select("select");
      if (k === "t" && showText) return select("text");
      if (k === "escape") return setSelection([]);
      if (k === "delete" || k === "backspace") return deleteSelection();
      if (k.startsWith("arrow")) {
        if (!selection.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (k === "arrowleft") return nudge(-step, 0);
        if (k === "arrowright") return nudge(step, 0);
        if (k === "arrowup") return nudge(0, -step);
        return nudge(0, step);
      }
      if (k === "e" && eraser) return select("eraser");
      if (k === "[") return nudgeSize(-1);
      if (k === "]") return nudgeSize(1);
      const pen = pens.find((p) => p.key === k);
      if (pen) select(pen.id);
      const shape = SHAPES.find((s) => s.key === k);
      if (shape) select(shape.kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    drawing,
    select,
    pens,
    eraser,
    shortcuts,
    nudgeSize,
    showSelect,
    showText,
    selection,
    setSelection,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    ungroupSelection,
    toggleLockSelection,
    selectAll,
    nudge,
    fitBounds,
  ]);

  /*
    Dragging the toolbar.

    The offset is kept separate from where the bar is anchored, so the
    placement rules still decide where it starts and this only says how far it
    has been carried from there. Grabbing anywhere on the bar that isn't a
    control counts — a bar full of buttons has very little bare surface, and
    hunting for a dedicated handle on something this size is worse than the
    occasional missed grab.
  */
  /** Where a dragged bar is pinned, as a gap from two edges of the surface. */
  const [pin, setPin] = useState<{
    x: { side: "left" | "right"; gap: number };
    y: { side: "top" | "bottom"; gap: number };
  } | null>(null);

  const [held, setHeld] = useState(false);
  const barEl = useRef<HTMLDivElement>(null);
  const grab = useRef({ dx: 0, dy: 0 });
  /** Mirrors `held` for the resize watcher, which must not re-subscribe. */
  const holding = useRef(false);

  /** Pin the bar by whichever edges it is nearest, clamped onto the surface. */
  const pinTo = useCallback((left: number, top: number) => {
    const el = root.current;
    const bar = barEl.current;
    if (!el || !bar) return;
    const r = el.getBoundingClientRect();
    // Layout size, not the painted box: the bar is scaled up while it's held,
    // and measuring through that transform overstates it by a few per cent —
    // enough that the clamp stops it short of the edge and the gap it reports
    // is wrong.
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    const pad = 8;
    const x = Math.min(Math.max(left, pad), Math.max(pad, r.width - pad - w));
    const y = Math.min(Math.max(top, pad), Math.max(pad, r.height - pad - h));
    const right = r.width - x - w;
    const bottom = r.height - y - h;
    setPin({
      x: x <= right ? { side: "left", gap: x } : { side: "right", gap: right },
      y:
        y <= bottom ? { side: "top", gap: y } : { side: "bottom", gap: bottom },
    });
  }, []);

  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || collapsed) return;
    // Anything you could click is not a handle.
    if ((e.target as HTMLElement).closest("button,input,[role='slider']"))
      return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const el = root.current;
    const b = e.currentTarget.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    grab.current = { dx: e.clientX - b.left, dy: e.clientY - b.top };
    // Take over positioning at exactly where it already is, so it can't jump
    // on the first move.
    if (r) pinTo(b.left - r.left, b.top - r.top);
    holding.current = true;
    setHeld(true);
  };

  const onBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!held) return;
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    pinTo(
      e.clientX - r.left - grab.current.dx,
      e.clientY - r.top - grab.current.dy,
    );
  };

  const onBarUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!held) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    holding.current = false;
    setHeld(false);
  };

  /*
    Keep it on the surface when it changes size.

    Anchoring holds the pinned edges by itself, but a bar that grows can still
    run its *other* edge off the far side. Re-pinning from where it now sits
    catches that, and covers the window resizing too.
  */
  useEffect(() => {
    const bar = barEl.current;
    if (!bar || !pin || typeof ResizeObserver === "undefined") return;
    const settle = () => {
      const el = root.current;
      // Never while it's being carried. The bar is scaled up in the hand, and
      // this reads its painted box — so each pass re-pinned it a few pixels
      // further along the scale's own offset, and a straight drag down the
      // screen crept sideways as it went.
      if (!el || holding.current) return;
      const r = el.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      pinTo(b.left - r.left, b.top - r.top);
    };
    const ro = new ResizeObserver(settle);
    ro.observe(bar);
    window.addEventListener("resize", settle);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", settle);
    };
  }, [pin, pinTo]);

  /*
    How far the disc travels when the bar folds down.

    A bar still sitting where it was put folds all the way to the corner, which
    is where a minimised control belongs and is what it has always done.

    A dragged bar travels nowhere at all. It is anchored by one of its edges,
    so shrinking already leaves the disc at that edge — the end of its own
    footprint, which is where it should end up. Adding the corner journey on
    top moves it a second time, and the two together are the lurch you see.

    A rail folds the same way, to the same place, but it needs help to read
    right. It is most of the height it sits in, so the corner is a long way and
    a bar that only translates there looks like it is sliding down the screen.
    Scaling it toward the end it's heading for turns that into the bar rolling
    up into the corner, which is what it should have looked like all along.
  */
  const [fold, setFold] = useState(0);
  const [foldOrigin, setFoldOrigin] = useState("center");

  useEffect(() => {
    if (!collapsed || pin) {
      setFold(0);
      return;
    }
    const el = root.current;
    const bar = barEl.current;
    if (!el || !bar) return;
    const r = el.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const horizontal = placement === "bottom";
    const span = horizontal ? r.width : r.height;
    const centre = horizontal
      ? b.left + b.width / 2 - r.left
      : b.top + b.height / 2 - r.top;
    // A bar square in the middle has no nearer end, so it keeps the one it has
    // always folded to.
    const dir = centre / span < 0.48 ? -1 : 1;
    /*
     * Aimed at a point, not moved by a guessed distance.
     *
     * The disc should end up exactly as far off its edge as the open bar sits
     * off it. Computed as an offset from the middle it lands close but not
     * on, because the bar isn't always centred in the first place, and being
     * a few pixels deeper into the corner than the inset is visible against a
     * rounded frame.
     */
    /*
     * Measured, not parsed.
     *
     * `--sd-inset` is a CSS length and can be anything: `1.25rem`, `4vw`, a
     * calc. Read as a number it silently becomes 1.25, and the disc ends up
     * against the edge. The distance the open bar already keeps from its own
     * edge is the same distance, and it's in pixels by definition.
     */
    const gap = horizontal ? r.bottom - b.bottom : b.left - r.left;
    /*
     * Half the collapsed bar *before* it scales.
     *
     * A rail folds about its end rather than its middle, so that edge is the
     * fixed point and the box still measures its full 66 when the translate is
     * applied. Aiming with the scaled 56 leaves it a few pixels deeper into the
     * corner than the open bar ever sits, which shows against a rounded frame.
     */
    const half = horizontal ? 28 : 33;
    const target = dir < 0 ? gap + half : span - gap - half;
    setFold(target - centre);
    setFoldOrigin(
      horizontal ? "center" : dir < 0 ? "center top" : "center bottom",
    );

    // Only when the collapse itself begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, placement, pin]);

  /*
   * The bar has to outlive `chrome` going false, or there is nothing left to
   * animate: React would take the element away on the same frame the prop
   * changed. `live` is what's mounted, `leaving` is what's playing out, and the
   * animation itself says when it's over.
   */
  const move: MotionOptions = typeof motion === "string" ? { in: motion, out: motion } : (motion ?? {});
  const enterWith = move.in ?? "rise";
  const exitWith = move.out ?? move.in ?? "rise";
  const [live, setLive] = useState(chrome);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (chrome) {
      setLeaving(false);
      setLive(true);
    } else if (exitWith === "none") {
      setLive(false);
    } else {
      setLeaving(true);
    }
  }, [chrome, exitWith]);

  const menuItem = (
    label: string,
    act: () => void,
    disabled = false,
    hint?: string,
  ) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      onClick={() => {
        act();
        setMenu(null);
      }}
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        textAlign: "left",
        padding: "5px 10px",
        border: 0,
        background: "transparent",
        color: "inherit",
        fontSize: 12,
        borderRadius: 5,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "#3a3a44";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span>{label}</span>
      {hint ? (
        <span style={{ color: "#9a9aa5", fontSize: 11, alignSelf: "center" }}>
          {hint}
        </span>
      ) : null}
    </button>
  );

  const menuSep = (key: string) => (
    <div key={key} style={{ height: 1, background: "#3b3b44", margin: "4px 6px" }} />
  );

  // A paste from the menu re-enters through the same door as the keyboard:
  // the clipboard's text rides in on the event's DataTransfer.
  const firePaste = () => {
    void (async () => {
      const dt = new DataTransfer();
      try {
        const t = await navigator.clipboard.readText();
        if (t) dt.setData("text/plain", t);
      } catch {
        /* the clipboard is locked: paste whatever made it into the transfer */
      }
      window.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, cancelable: true, bubbles: true }),
      );
    })();
  };

  const anyGroup = selection.some((id) =>
    drawing.strokes.some((s) => s.id === id && s.group !== undefined),
  );
  const anyLocked = selection.some((id) =>
    drawing.strokes.some((s) => s.id === id && s.locked),
  );
  const has = selection.length > 0;

  const menuNode = menu ? (
    <div
      data-ctx-menu
      style={{
        position: "fixed",
        left: Math.min(menu.x, window.innerWidth - 190),
        top: Math.min(menu.y, window.innerHeight - 430),
        zIndex: 9999,
        background: "#26262c",
        border: "1px solid #3b3b44",
        borderRadius: 8,
        padding: 4,
        boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        color: "#f0f0f2",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        minWidth: 170,
        userSelect: "none",
      }}
    >
      {menuItem("Copy", () => void document.execCommand("copy"), !has, "Ctrl+C")}
      {menuItem("Cut", () => void document.execCommand("cut"), !has, "Ctrl+X")}
      {menuItem("Paste", firePaste, false, "Ctrl+V")}
      {menuSep("s1")}
      {menuItem("Duplicate", duplicateSelection, !has, "Ctrl+D")}
      {menuItem("Delete", deleteSelection, !has, "Del")}
      {menuItem("Select all", selectAll, false, "Ctrl+A")}
      {menuSep("s2")}
      {anyGroup
        ? menuItem("Ungroup", ungroupSelection, !has, "Ctrl+Shift+G")
        : menuItem("Group", groupSelection, selection.length < 2, "Ctrl+G")}
      {anyLocked
        ? menuItem("Unlock", toggleLockSelection, !has)
        : menuItem("Lock", toggleLockSelection, !has, "Ctrl+Shift+L")}
      {menuSep("s3")}
      {menuItem("Bring to front", () => reorderSelection("front"), !has)}
      {menuItem("Send to back", () => reorderSelection("back"), !has)}
      {menuSep("s4")}
      {menuItem("Align left", () => alignSelection("left"), selection.length < 2)}
      {menuItem("Align centre", () => alignSelection("center"), selection.length < 2)}
      {menuItem("Align right", () => alignSelection("right"), selection.length < 2)}
      {menuItem("Align top", () => alignSelection("top"), selection.length < 2)}
      {menuItem("Align middle", () => alignSelection("middle"), selection.length < 2)}
      {menuItem("Align bottom", () => alignSelection("bottom"), selection.length < 2)}
    </div>
  ) : null;

  /** The shortcut help panel, opened by ?. */
  const helpNode = help ? (
    <div
      data-help-panel
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,.45)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        data-help-card
        style={{
          width: 560,
          maxHeight: "78vh",
          overflow: "auto",
          background: "#26262c",
          border: "1px solid #3b3b44",
          borderRadius: 10,
          padding: "18px 20px",
          boxShadow: "0 12px 40px rgba(0,0,0,.45)",
          color: "#f0f0f2",
          fontSize: 13,
          userSelect: "none",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Keyboard shortcuts</span>
          <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 12 }}>
            press ? to close
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Undo", "Ctrl+Z"],
              ["Redo", "Ctrl+Shift+Z / Ctrl+Y"],
              ["Select all", "Ctrl+A"],
              ["Duplicate", "Ctrl+D"],
              ["Group", "Ctrl+G"],
              ["Ungroup", "Ctrl+Shift+G"],
              ["Lock / unlock", "Ctrl+Shift+L"],
              ["Delete", "Del / Backspace"],
              ["Nudge", "Arrows"],
              ["Nudge ×10", "Shift+Arrows"],
              ["Zoom to selection", "Shift+2"],
              ["Fit to view", "Shift+1"],
              ["Help", "?"],
              ...PENS.filter((p) => p.key).map(
                (p) => [p.name, p.key.toUpperCase()] as const,
              ),
              ...SHAPES.map((s) => [s.name, s.key.toUpperCase()] as const),
              ["Eraser", "E"],
              ["Select", "V"],
              ["Text", "T"],
              ["Thinner", "["],
              ["Thicker", "]"],
            ].map(([what, key]) => (
              <tr key={what}>
                <td style={{ padding: "4px 8px 4px 0", opacity: 0.8 }}>{what}</td>
                <td style={{ padding: "4px 0", textAlign: "right" }}>
                  <kbd
                    style={{
                      background: "rgba(255,255,255,.08)",
                      border: "1px solid rgba(255,255,255,.18)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {key}
                  </kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={root}
      className={`sd ${css.root} ${className ?? ""}`}
      data-theme={theme}
      data-placement={placement}
      data-depth={depth}
      data-background={background === "transparent" ? "none" : undefined}
      style={style}
      tabIndex={-1}
    >
      <DrawSurface
        drawing={drawing}
        board={surfaceBoard}
        background={background}
        tool={surfaceTool}
        view={view}
        grid={grid}
        onViewChange={(v) => {
          setView(v);
          reportedView.current?.(v);
        }}
        selection={selection}
        onSelection={(ids) => {
          setSelection(ids);
          reportedSelection.current?.(ids);
        }}
        onContextMenu={(e, _p) => setMenu({ x: e.clientX, y: e.clientY })}
        disabled={chrome && collapsed && !drawWhenMinimized}
        className={css.surface}
      />

      {live && (
        <div
          ref={barEl}
          className={css.toolbar}
          data-placement={placement}
          data-align={align}
          data-motion-in={enterWith}
          data-motion-out={exitWith}
          data-leaving={leaving || undefined}
          onAnimationEnd={(e) => {
            // Only the bar's own arrival or departure, not a tool's.
            if (e.target !== e.currentTarget) return;
            if (leaving) {
              setLive(false);
              setLeaving(false);
            }
          }}
          data-draggable={draggable && !collapsed ? "" : undefined}
          data-held={held ? "" : undefined}
          style={
            pin
              ? ({
                  "--sd-inset":
                    typeof inset === "number" ? `${inset}px` : inset,
                  left: pin.x.side === "left" ? pin.x.gap : "auto",
                  right: pin.x.side === "right" ? pin.x.gap : "auto",
                  top: pin.y.side === "top" ? pin.y.gap : "auto",
                  bottom: pin.y.side === "bottom" ? pin.y.gap : "auto",
                  // The stylesheet centres with a percentage translate; an
                  // anchored bar is positioned outright and must not also be
                  // pulled back by half its own size.
                  translate: "none",
                  maxWidth: "none",
                  maxHeight: "none",
                  // Inherited by the bar, which closes toward this corner.
                  "--fold-origin": `${pin.x.side} ${pin.y.side}`,
                } as React.CSSProperties)
              : ({
                  "--sd-inset":
                    typeof inset === "number" ? `${inset}px` : inset,
                  ...(move.duration ? { "--sd-motion": `${move.duration}ms` } : null),
                  // The end the bar is folding toward, so its scale pulls that
                  // way instead of back toward its own middle.
                  "--fold-origin": foldOrigin,
                } as React.CSSProperties)
          }
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
        >
          <Toolbar
            placement={placement}
            collapsed={collapsed}
            onCollapse={() => setCollapsed(true)}
            onExpand={() => setCollapsed(false)}
            shift={fold}
            /* Half the bar's length, less half the disc it closes into, less
               the margin it keeps from the corner. The disc ends up 56 across
               whichever way the bar is laid, so this is the same either way. */
            icon={
              isShape(tool.active) ? (
                <ShapeIcon kind={tool.active} color={tool.color} size={42} />
              ) : tool.active === "select" || tool.active === "text" ? (
                <ToolGlyph id={tool.active} color={tool.color} size={42} />
              ) : (
                <ToolIcon
                  id={tool.active === "eraser" ? "eraser" : tool.active}
                  color={tool.color}
                  /* The same pen the row was holding, so it has to be drawn the
                     same way. Left off, the tool changed style as the bar closed
                     around it — the one moment it's the only thing on screen. */
                  look={look}
                  /* Drawn at 42 because the disc it sits in is the bar scaled to
                     two thirds — which takes the tool down with it. This lands
                     it back at the 28 it reads as. */
                  size={42}
                />
              )
            }
            tool={tool}
            inkFor={inkFor}
            tooltips={tooltips}
            pens={pens}
            shapes={shapeTools}
            eraser={eraser}
            controls={controls}
            settings={settings}
            look={look}
            gauge={gauge}
            shortcuts={shortcuts}
            swatches={swatches}
            theme={theme}
            onSelect={select}
            onChange={patch}
            canUndo={drawing.canUndo}
            canRedo={drawing.canRedo}
            onUndo={drawing.undo}
            onRedo={drawing.redo}
            onClear={drawing.clear}
            hasStrokes={drawing.strokes.length > 0}
          />
        </div>
      )}

      {menuNode}
      {helpNode}
    </div>
  );
});
