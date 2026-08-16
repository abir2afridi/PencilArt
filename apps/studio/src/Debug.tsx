import { PageControls } from "./components/PageControls";
import { ThemeToggle } from "./components/ThemeToggle";
import type { DebugState } from "./state";
import css from "./Debug.module.css";

export type { DebugState };
export { defaults } from "./state";

/**
 * The demo harness's header bar: the brand, the shell theme, and the pages.
 * The option dropdowns themselves live in the left sidebar (Sidebar.tsx).
 */
export function Debug({
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
    </div>
  );
}