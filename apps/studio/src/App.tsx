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
  const draw = useRef<DrawHandle>(null);

  /** A brand-new blank page, made current. */
  const addPage = () => {
    const index = pages.length;
    setPages((prev) => [...prev, []]);
    setPage(index);
  };

  const goPage = (index: number) => {
    if (index >= 0 && index < pages.length) setPage(index);
  };

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
      <Draw
        /* A new key per page remounts the component, so each page loads
           its own strokes fresh instead of sharing undo history. */
        key={page}
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
        background={
          debug.transparent
            ? "checker"
            : debug.theme === "dark"
              ? "#17171a"
              : "#ffffff"
        }
      />
    </div>
  );
}