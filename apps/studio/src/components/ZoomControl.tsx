import { Chip } from "./Dropdown";
import css from "./ZoomControl.module.css";

/** Zoom in and out about the centre of the view, with the current scale as
    a readout and a way back to the board's own scale, everything at once, or
    the elements in hand. */
export function ZoomControl({
  percent,
  onZoom,
  onReset,
  onFit,
  onSelection,
}: {
  /** The current scale, as a whole-number percentage. */
  percent: number;
  onZoom: (factor: number) => void;
  onReset: () => void;
  onFit: () => void;
  onSelection: () => void;
}) {
  return (
    <div className={css.zoom} role="group" aria-label="Zoom">
      <Chip label="Zoom out" onClick={() => onZoom(1 / 1.25)}>
        −
      </Chip>
      <span className={css.pct} aria-label={`Zoom ${percent}%`}>
        {percent}%
      </span>
      <Chip label="Zoom in" onClick={() => onZoom(1.25)}>
        +
      </Chip>
      <Chip label="Reset zoom" onClick={onReset}>
        1:1
      </Chip>
      <Chip label="Fit the drawing to the view" onClick={onFit}>
        fit
      </Chip>
      <Chip label="Zoom to the selection" onClick={onSelection}>
        sel
      </Chip>
    </div>
  );
}
