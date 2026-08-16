import { useEffect, useRef, useState, type RefObject } from "react";
import type { DrawHandle } from "pencilart";
import type { DebugState } from "../state";
import { AlignControl } from "./controls/Align";
import { AlsoControl } from "./controls/Also";
import { ControlsControl } from "./controls/Controls";
import { DepthControl } from "./controls/Depth";
import { ExportControl } from "./controls/Export";
import { InkControl } from "./controls/Ink";
import { MotionControl } from "./controls/Motion";
import { PensControl } from "./controls/Pens";
import { PlacementControl } from "./controls/Placement";
import { SettingsControl } from "./controls/Settings";
import { ThemeControl } from "./controls/Theme";
import { ToolsControl } from "./controls/Tools";
import css from "./Sidebar.module.css";

/** The demo controls, stacked down the left edge instead of across the top.
    The rail collapses to its glyphs; hovering it fans it out. */
export function Sidebar({
  value,
  onChange,
  draw,
  shell,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
  draw: RefObject<DrawHandle | null>;
  shell: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <aside
      ref={aside}
      className={css.sidebar}
      data-sidebar
      data-shell={shell}
      data-open={open ? "true" : "false"}
      onPointerEnter={() => setOpen(true)}
    >
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
      <ExportControl draw={draw} />
    </aside>
  );
}