import { useRef, useState } from "react";
import { Draw, type DrawHandle, type Stroke } from "pencilart";
import { Debug, type DebugState, defaults } from "./Debug";
import css from "./App.module.css";

/** Demo harness. The <Draw /> line is all a consumer writes. */
export default function App() {
  const [debug, setDebug] = useState<DebugState>(defaults);
  const [shell, setShell] = useState<"dark" | "light">("dark");
  /** Every page is its own drawing; the harness keeps the whole stack. */
  const [pages, setPages] = useState<Stroke[][]>([[]]);
  const [page, setPage] = useState(0);
  /** The page being flipped away, if a turn is in flight. */
  const [turning, setTurning] = useState<number | null>(null);
  /** Which way the last switch went, so the page turns off that side. */
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const draw = useRef<DrawHandle>(null);

  /** A brand-new blank page, made current. */
  const addPage = () => {
    if (turning !== null) return;
    const index = pages.length;
    setPages((prev) => [...prev, []]);
    setDir("forward");
    beginTurn(page);
    setPage(index);
  };

  const goPage = (index: number) => {
    if (index < 0 || index >= pages.length || index === page) return;
    if (turning !== null) return;
    setDir(index > page ? "forward" : "back");
    beginTurn(page);
    setPage(index);
  };

  /** Send the current page away, and clear it once the flip has played.
      The timeout is the belt-and-braces for reduced-motion, where the
      animation (and its end event) never runs. */
  const beginTurn = (from: number) => {
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
          value={debug}
          onChange={setDebug}
          draw={draw}
          shell={shell}
          onShell={setShell}
          page={page}
          pageCount={pages.length}
          onNewPage={addPage}
          onGoPage={goPage}
        />
      </header>
      {/* The book: the page you turned to rests beneath, and the page you left
          flips over it like paper, pivoting on its spine edge. */}
      <div className={css.book}>
        <div key={page} className={css.stage}>
          <Draw
            ref={draw}
            initialStrokes={pages[page]}
        onChange={(strokes) =>
          setPages((prev) => {
            const next = [...prev];
            next[page] = strokes;
            return next;
          })
        }
        placement={debug.placement}
        theme={debug.theme}
        chrome={debug.chrome}
        motion={debug.motion}
        depth={debug.depth}
        ink={debug.ink}
        tooltips={debug.tooltips === false ? false : { scope: debug.tooltips }}
        eraser={debug.eraser}
        tools={debug.tools.length ? debug.tools : undefined}
        controls={debug.controls}
        settings={debug.settings}
        align={debug.align}
        look={debug.look}
        gauge={debug.gauge}
        shortcuts={debug.shortcuts}
        draggable={debug.draggable}
        /* The canvas colour is the host's call, not the component's —
           but a dark theme over a white page is nobody's intent. */
        background={background}
        />
        </div>
        {/* The page being turned away: a bare snapshot, chrome off, so it
            reads as paper with the drawing on it. */}
        {turning !== null && (
          <div key={turning} className={css.turning} data-dir={dir}>
            <Draw
              initialStrokes={pages[turning]}
              theme={debug.theme}
              chrome={false}
              background={background}
            />
          </div>
        )}
      </div>
    </div>
  );
}