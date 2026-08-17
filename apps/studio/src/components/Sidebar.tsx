import { useEffect, useRef, useState, type RefObject } from "react";
import type { DrawHandle } from "pencilart";
import type { DebugState } from "../state";
import { AlignControl } from "./controls/Align";
import { AlsoControl } from "./controls/Also";
import { ArrangeControl } from "./controls/Arrange";
import { ControlsControl } from "./controls/Controls";
import { DepthControl } from "./controls/Depth";
import { ExportControl } from "./controls/Export";
import { ImagesControl } from "./controls/Images";
import { ImportControl } from "./controls/Import";
import { InkControl } from "./controls/Ink";
import { LibraryControl } from "./controls/Library";
import { MotionControl } from "./controls/Motion";
import { PensControl } from "./controls/Pens";
import { PlacementControl } from "./controls/Placement";
import { SettingsControl } from "./controls/Settings";
import { StyleControl } from "./controls/Style";
import { TextControl } from "./controls/Text";
import { ThemeControl } from "./controls/Theme";
import { ToolsControl } from "./controls/Tools";
import { MenuIcon, XIcon } from "./icons";
import css from "./Sidebar.module.css";

/** The whole set of demo knobs, shared by the rail and the mobile drawer. */
function Controls({
  value,
  onChange,
  draw,
  selection,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
  draw: RefObject<DrawHandle | null>;
  /** The elements in hand, mirrored from the surface. */
  selection: number[];
}) {
  return (
    <>
      <PlacementControl value={value} onChange={onChange} />
      <ThemeControl value={value} onChange={onChange} />
      <DepthControl value={value} onChange={onChange} />
      <SettingsControl value={value} onChange={onChange} />
      <AlignControl value={value} onChange={onChange} />
      <ToolsControl value={value} onChange={onChange} />
      <InkControl value={value} onChange={onChange} />
      <ControlsControl value={value} onChange={onChange} />
      <PensControl value={value} onChange={onChange} />
      <MotionControl value={value} onChange={onChange} />
      <AlsoControl value={value} onChange={onChange} />
      <ArrangeControl draw={draw} selection={selection} />
      <StyleControl draw={draw} selection={selection} />
      <TextControl draw={draw} selection={selection} />
      <ImagesControl draw={draw} />
      <ImportControl draw={draw} />
      <LibraryControl draw={draw} selection={selection} />
      <ExportControl draw={draw} />
    </>
  );
}

/** The brand: a pencil in a rounded box, with the name when there's room. */
function Brand({ open }: { open: boolean }) {
  return (
    <div className={css.brand}>
      <span className={css.mark}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 3l4 4L8 20l-5 1 1-5L17 3Z" />
        </svg>
      </span>
      {open ? <span className={css.wordmark}>PencilArt</span> : null}
    </div>
  );
}

/** The demo controls, stacked down the left edge instead of across the top.
    The rail collapses to its glyphs; hovering it fans it out. On small
    screens the rail steps aside for a drawer opened from a thin bar. */
export function Sidebar({
  value,
  onChange,
  draw,
  shell,
  selection,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
  draw: RefObject<DrawHandle | null>;
  shell: "dark" | "light";
  /** The elements in hand, mirrored from the surface. */
  selection: number[];
}) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    // While the rail is open, stay open only while the pointer is over the
    // sidebar — including any menu hanging off a trigger, which is a
    // descendant of the aside and therefore still "inside". Anything else
    // (the page, an open dropdown's neighbours, the air) folds it shut.
    const onMove = (e: PointerEvent) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (!aside.current?.contains(hit)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <>
      <aside
        ref={aside}
        className={css.sidebar}
        data-sidebar
        data-shell={shell}
        data-open={open ? "true" : "false"}
        onPointerEnter={() => setOpen(true)}
      >
        <Brand open={open} />
        <Controls
          value={value}
          onChange={onChange}
          draw={draw}
          selection={selection}
        />
      </aside>
      {/* The thin bar on small screens, and the drawer it opens. */}
      <div className={css.mobilebar} data-shell={shell}>
        <button
          type="button"
          className={css.menubutton}
          aria-label="Open controls"
          onClick={() => setDrawer(true)}
        >
          <MenuIcon />
        </button>
      </div>
      {drawer ? (
        <div
          className={css.drawer}
          data-sidebar
          data-shell={shell}
          data-open="true"
        >
          <div className={css.drawerTop}>
            <Brand open />
            <button
              type="button"
              className={css.menubutton}
              aria-label="Close controls"
              onClick={() => setDrawer(false)}
            >
              <XIcon />
            </button>
          </div>
          <Controls
            value={value}
            onChange={onChange}
            draw={draw}
            selection={selection}
          />
        </div>
      ) : null}
    </>
  );
}