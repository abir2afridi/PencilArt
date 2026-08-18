import { useEffect, useRef, useState, type RefObject } from "react";
import {
  unionBounds,
  SWATCHES,
  type DrawHandle,
  type Stroke,
} from "pencilart";
import { Chip } from "./Dropdown";
import css from "./Properties.module.css";

/** One labelled number field. The draft is local while typing, so the
    committed value — which only lands on blur or Enter — never fights the
    keystrokes. */
function Field({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(Math.round(value)));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(Math.round(value)));
  }, [value]);
  const commit = () => {
    focused.current = false;
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onCommit(n);
  };
  return (
    <label className={css.field}>
      <span className={css.fieldLabel}>{label}</span>
      <input
        className={css.fieldInput}
        type="number"
        step={1}
        aria-label={label}
        disabled={disabled}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/** A swatch button with a fixed size, for the ink and the wash. */
function Swatch({
  color,
  label,
  onClick,
}: {
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={css.swatch}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span
        className={css.swatchDot}
        style={{
          background: color,
          boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.5)",
        }}
      />
    </button>
  );
}

/**
 * The properties of the elements in hand, floating over the right edge of
 * the board the way Excalidraw's does: geometry on top, then the ink, then
 * the wash. It appears the moment anything is selected and leaves when the
 * hand is empty.
 */
export function Properties({
  strokes,
  selection,
  draw,
  shell,
}: {
  /** The strokes of the page being drawn. */
  strokes: Stroke[];
  /** The elements in hand, mirrored from the surface. */
  selection: number[];
  draw: RefObject<DrawHandle | null>;
  shell: "dark" | "light";
}) {
  const picked = strokes.filter((s) => selection.includes(s.id));
  if (!picked.length) return null;
  const u = unionBounds(picked);
  const single = picked.length === 1;
  /** W/H scale every figure proportionally; only frames are left out. */
  const scalable =
    picked.length > 0 && picked.every((s) => !!s.figure && s.figure.kind !== "frame");
  const rotatable = single && picked[0].figure?.kind !== "frame";
  const size = [2, 4, 8, 14];
  const opacity = [1, 0.7, 0.4];
  const geo = (patch: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    rotation?: number;
  }) => draw.current?.geometrySelection(patch);
  const style = (patch: {
    color?: string;
    fillColor?: string | null;
    fill?: "solid" | "hachure" | "cross-hatch" | null;
    size?: number;
    opacity?: number;
    dash?: "solid" | "dash" | "dot";
  }) => draw.current?.styleSelection(patch);
  return (
    <aside className={css.panel} data-properties data-shell={shell}>
      <div className={css.head}>
        <span className={css.title}>Properties</span>
        <span className={css.count}>
          {picked.length} {picked.length === 1 ? "element" : "elements"}
        </span>
      </div>
      <div className={css.grid}>
        <Field label="Position X" value={u.x} onCommit={(x) => geo({ x })} />
        <Field label="Position Y" value={u.y} onCommit={(y) => geo({ y })} />
        <Field
          label="Width"
          value={u.w}
          disabled={!scalable}
          onCommit={(w) => geo({ w })}
        />
        <Field
          label="Height"
          value={u.h}
          disabled={!scalable}
          onCommit={(h) => geo({ h })}
        />
        <Field
          label="Rotation"
          value={picked[0].rotate ?? 0}
          disabled={!rotatable}
          onCommit={(rotation) => geo({ rotation })}
        />
      </div>
      <div className={css.section}>
        <span className={css.sectionTitle}>Ink</span>
        <div className={css.row}>
          {SWATCHES.slice(0, 8).map((c) => (
            <Swatch
              key={c}
              color={c}
              label={`Stroke ${c}`}
              onClick={() => style({ color: c })}
            />
          ))}
        </div>
        <div className={css.row}>
          {size.map((s) => (
            <Chip key={s} onClick={() => style({ size: s })}>
              {s}px
            </Chip>
          ))}
          {opacity.map((o) => (
            <Chip
              key={o}
              onClick={() => style({ opacity: o })}
              label={`Opacity ${Math.round(o * 100)}%`}
            >
              {Math.round(o * 100)}%
            </Chip>
          ))}
        </div>
        <div className={css.row}>
          <Chip label="Solid stroke" onClick={() => style({ dash: "solid" })}>
            solid
          </Chip>
          <Chip label="Dashed stroke" onClick={() => style({ dash: "dash" })}>
            dashed
          </Chip>
          <Chip label="Dotted stroke" onClick={() => style({ dash: "dot" })}>
            dotted
          </Chip>
        </div>
      </div>
      <div className={css.section}>
        <span className={css.sectionTitle}>Fill</span>
        <div className={css.row}>
          <Chip label="No fill" onClick={() => style({ fill: null })}>
            none
          </Chip>
          <Chip label="Solid fill" onClick={() => style({ fill: "solid" })}>
            solid
          </Chip>
          <Chip label="Hachure fill" onClick={() => style({ fill: "hachure" })}>
            hachure
          </Chip>
          <Chip
            label="Cross-hatch fill"
            onClick={() => style({ fill: "cross-hatch" })}
          >
            cross-hatch
          </Chip>
        </div>
        <div className={css.row}>
          {SWATCHES.slice(0, 8).map((c) => (
            <Swatch
              key={c}
              color={c}
              label={`Fill ${c}`}
              onClick={() => style({ fillColor: c })}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

export default Properties;
