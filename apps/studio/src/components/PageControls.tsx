import { Chip, Dropdown, Toggle } from "./Dropdown";
import { AddIcon, ChevronIcon, RedoIcon, TrashIcon, UndoIcon } from "./icons";
import css from "./PageControls.module.css";

/** History and pages: undo/redo, and the prev | Page | + 🗑 | next pager. */
export function PageControls({
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
  /** Zero-based index of the page being drawn. */
  page: number;
  /** How many pages there are. */
  pageCount: number;
  onNewPage: () => void;
  onGoPage: (index: number) => void;
  onRemovePage: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className={css.pager}>
      <Chip label="Undo" disabled={!canUndo} onClick={onUndo}>
        <UndoIcon />
      </Chip>
      <Chip label="Redo" disabled={!canRedo} onClick={onRedo}>
        <RedoIcon />
      </Chip>
      <Chip
        label="Previous page"
        disabled={page === 0}
        onClick={() => onGoPage(page - 1)}
      >
        <ChevronIcon className={css.left} />
      </Chip>
      <Dropdown label="Page" current={`${page + 1} / ${pageCount}`}>
        {(close) =>
          Array.from({ length: pageCount }, (_, i) => (
            <Toggle
              key={i}
              on={i === page}
              onClick={() => {
                onGoPage(i);
                close();
              }}
            >
              {i + 1}
            </Toggle>
          ))
        }
      </Dropdown>
      <Chip label="Add a new page" onClick={onNewPage}>
        <AddIcon />
      </Chip>
      <Chip
        label="Delete this page"
        disabled={pageCount <= 1}
        onClick={onRemovePage}
      >
        <TrashIcon />
      </Chip>
      <Chip
        label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onGoPage(page + 1)}
      >
        <ChevronIcon className={css.right} />
      </Chip>
    </div>
  );
}