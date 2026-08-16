import type { RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { PageControls } from "./components/PageControls";
import { ThemeToggle } from "./components/ThemeToggle";
import { AlignControl } from "./components/controls/Align";
import { AlsoControl } from "./components/controls/Also";
import { ControlsControl } from "./components/controls/Controls";
import { DepthControl } from "./components/controls/Depth";
import { ExportControl } from "./components/controls/Export";
import { InkControl } from "./components/controls/Ink";
import { MotionControl } from "./components/controls/Motion";
import { PensControl } from "./components/controls/Pens";
import { PlacementControl } from "./components/controls/Placement";
import { SettingsControl } from "./components/controls/Settings";
import { ThemeControl } from "./components/controls/Theme";
import { ToolsControl } from "./components/controls/Tools";
import type { DebugState } from "./state";
import css from "./Debug.module.css";

export type { DebugState };
export { defaults } from "./state";

/**
 * The demo harness's header bar. Every feature lives in its own file under
 * `components/` — this component only assembles them in order.
 */
export function Debug({
  value,
  onChange,
  draw,
  shell,
  onShell,
  page,
  pageCount,
  onNewPage,
  onGoPage,
  onRemovePage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
  draw: RefObject<DrawHandle | null>;
  shell: "dark" | "light";
  onShell: (next: "dark" | "light") => void;
  /** Zero-based index of the page being drawn. */
  page: number;
  /** How many pages there are. */
  pageCount: number;
  /** Add a blank page and make it current. */
  onNewPage: () => void;
  /** Switch to an existing page. */
  onGoPage: (index: number) => void;
  /** Turn the current page away for good. */
  onRemovePage: () => void;
  /** Whether the page has anything to step back over. */
  canUndo: boolean;
  /** Whether a step back can be taken again. */
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className={css.bar}>
      <span className={css.tag}>PencilArt</span>

      <ThemeToggle shell={shell} onShell={onShell} />

      <PageControls
        page={page}
        pageCount={pageCount}
        onNewPage={onNewPage}
        onGoPage={onGoPage}
        onRemovePage={onRemovePage}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />

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
    </div>
  );
}