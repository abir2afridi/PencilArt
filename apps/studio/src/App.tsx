import { useEffect, useRef, useState } from "react";
import {
  Draw,
  isShape,
  type DrawHandle,
  type ShapeKind,
  type Stroke,
  type View,
} from "pencilart";
import { Debug, type DebugState, defaults } from "./Debug";
import { Sidebar } from "./components/Sidebar";
import css from "./App.module.css";

/** Where the book lives between visits: the whole stack, plus which page
    was open. */
const BOOK_KEY = "pencilart:book:v1";

function loadBook(): { pages: Stroke[][]; page: number } {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    if (!raw) return { pages: [[]], page: 0 };
    const parsed = JSON.parse(raw) as { pages?: Stroke[][]; page?: number };
    if (!Array.isArray(parsed.pages) || !parsed.pages.length) {
      return { pages: [[]], page: 0 };
    }
    return { pages: parsed.pages, page: Math.min(parsed.page ?? 0, parsed.pages.length - 1) };
  } catch {
    return { pages: [[]], page: 0 };
  }
}

/** Demo harness. The <Draw /> line is all a consumer writes. */
export default function App() {
  const [debug, setDebug] = useState<DebugState>(defaults);
  const [shell, setShell] = useState<"dark" | "light">("dark");
  /** Every page is its own drawing; the harness keeps the whole stack. */
  const [pages, setPages] = useState<Stroke[][]>(() => loadBook().pages);
  const [page, setPage] = useState(() => loadBook().page);
  /** The page being flipped away, if a turn is in flight. */
  const [turning, setTurning] = useState<number | null>(null);
  /** The strokes the turning page flips away with, captured at turn time. */
  const [turnStrokes, setTurnStrokes] = useState<Stroke[]>([]);
  /** Which way the last switch went, so the page turns off that side. */
  const [dir, setDir] = useState<"forward" | "back">("forward");
  /** Whether the current page has undo/redo available, refreshed with every
      stroke change so the header buttons can be disabled honestly. */
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const draw = useRef<DrawHandle>(null);
  /** The shape in hand, mirrored from the surface so the header can show it. */
  const [shape, setShape] = useState<ShapeKind | null>(null);
  /** The elements in hand, mirrored so the sidebar can act on them. */
  const [selection, setSelection] = useState<number[]>([]);
  /** The part of the board in view, mirrored so the header can zoom. */
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });

  // The book lives in localStorage: a reload comes back to the same stack.
  useEffect(() => {
    try {
      localStorage.setItem(BOOK_KEY, JSON.stringify({ pages, page }));
    } catch {
      /* a full or private store is fine to ignore */
    }
  }, [pages, page]);

  /** A brand-new blank page, made current. */
  const addPage = () => {
    if (turning !== null) return;
    const index = pages.length;
    setPages((prev) => [...prev, []]);
    setDir("forward");
    beginTurn(page, pages[page]);
    setPage(index);
  };

  const goPage = (index: number) => {
    if (index < 0 || index >= pages.length || index === page) return;
    if (turning !== null) return;
    setDir(index > page ? "forward" : "back");
    beginTurn(page, pages[page]);
    setPage(index);
  };

  /** Turn the current page away for good. The last page can't go. */
  const removePage = () => {
    if (turning !== null || pages.length <= 1) return;
    const index = page;
    const removed = pages[index];
    const next = pages.filter((_, i) => i !== index);
    setDir(next.length - 1 < index ? "back" : "forward");
    beginTurn(index, removed);
    setPages(next);
    setPage(Math.min(index, next.length - 1));
  };

  /** Send a page away, and clear it once the flip has played. The timeout
      is the belt-and-braces for reduced-motion, where the animation (and
      its end event) never runs. */
  const beginTurn = (from: number, strokes: Stroke[]) => {
    setTurnStrokes(strokes);
    setTurning(from);
    window.setTimeout(
      () => setTurning((t) => (t === from ? null : t)),
      900,
    );
  };

  /* The canvas colour is the host's call, not the component's — but a dark
     theme over a white page is nobody's intent. */
  const background = debug.transparent
    ? "checker"
    : debug.theme === "dark"
      ? "#17171a"
      : "#ffffff";

  return (
    <div className={css.page}>
      <header className={css.header} data-shell={shell}>
        <Debug
          shell={shell}
          onShell={setShell}
          shape={shape}
          onShape={(id) => draw.current?.selectTool(id)}
          page={page}
          pageCount={pages.length}
          onNewPage={addPage}
          onGoPage={goPage}
          onRemovePage={removePage}
          canUndo={hist.canUndo}
          canRedo={hist.canRedo}
          onUndo={() => draw.current?.undo()}
          onRedo={() => draw.current?.redo()}
          zoom={Math.round(view.k * 100)}
          onZoom={(factor) => draw.current?.zoomBy(factor)}
          onZoomReset={() => draw.current?.zoomReset()}
          onZoomFit={() => draw.current?.zoomFit()}
          onZoomSelection={() => draw.current?.zoomToSelection()}
        />
      </header>
      {/* The controls down the left edge, and the book taking the rest. */}
      <div className={css.body} data-shell={shell}>
        <Sidebar
          value={debug}
          onChange={setDebug}
          draw={draw}
          shell={shell}
          selection={selection}
        />
        <div className={css.book}>
        <div key={`page-${page}`} className={css.stage}>
          <Draw
            ref={draw}
            initialStrokes={pages[page]}
        onChange={(strokes) => {
          setPages((prev) => {
            const next = [...prev];
            next[page] = strokes;
            return next;
          });
          const h = draw.current;
          setHist({
            canUndo: h?.canUndo() ?? false,
            canRedo: h?.canRedo() ?? false,
          });
        }}
        placement={debug.placement}
        theme={debug.theme}
        chrome={debug.chrome}
        motion={debug.motion}
        depth={debug.depth}
        ink={debug.ink}
        onToolChange={(t) => setShape(isShape(t.active) ? t.active : null)}
        onSelectionChange={setSelection}
        onViewChange={setView}
        tooltips={debug.tooltips === false ? false : { scope: debug.tooltips }}
        eraser={debug.eraser}
        tools={debug.tools.length ? debug.tools : undefined}
        /* The shapes live in the header's ShapeTools; an empty tray row
           keeps the two places from offering the same thing. */
        shapes={[]}
        controls={debug.controls}
        settings={debug.settings}
        align={debug.align}
        look={debug.look}
        gauge={debug.gauge}
        shortcuts={debug.shortcuts}
        grid={debug.grid}
        draggable={debug.draggable}
        /* The canvas colour is the host's call, not the component's —
           but a dark theme over a white page is nobody's intent. */
        background={background}
        />
        </div>
        {/* The page being turned away: a bare snapshot, chrome off, so it
            reads as paper with the drawing on it. */}
        {turning !== null && (
          <div key={`turn-${turning}`} className={css.turning} data-dir={dir}>
            <Draw
              initialStrokes={turnStrokes}
              theme={debug.theme}
              chrome={false}
              background={background}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}