import { SHAPES } from "pencilart";
import type { ShapeKind } from "pencilart";
import css from "./ShapeTools.module.css";

/** The shape tools in hand, as visible buttons in the header. The drawing
    tray hides its own shape row, so this is the only way to pick one up. */
export function ShapeTools({
  shape,
  onShape,
}: {
  shape: ShapeKind | null;
  onShape: (kind: ShapeKind) => void;
}) {
  return (
    <div className={css.row} role="group" aria-label="Shape tools">
      {SHAPES.map((s) => (
        <button
          key={s.kind}
          type="button"
          className={css.tool}
          data-active={shape === s.kind || undefined}
          aria-label={s.name}
          aria-pressed={shape === s.kind}
          title={s.name}
          onClick={(e) => {
            onShape(s.kind);
            // The drawing's shortcuts only listen while focus is inside it
            // (or on the body), so let the click hand focus back.
            e.currentTarget.blur();
          }}
        >
          <Glyph kind={s.kind} />
        </button>
      ))}
    </div>
  );
}

/** The seven marks, drawn small in the same line style as the other glyphs. */
function Glyph({ kind }: { kind: ShapeKind }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  switch (kind) {
    case "rect":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="9" height="7" rx="1" />
        </svg>
      );
    case "ellipse":
      return (
        <svg {...common}>
          <ellipse cx="7" cy="7" rx="4.5" ry="3.5" />
        </svg>
      );
    case "line":
      return (
        <svg {...common}>
          <line x1="2.5" y1="11.5" x2="11.5" y2="2.5" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M2.5 11.5L8.5 5.5" />
          <path d="M6.5 5.5h2v2" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M7 2.5 11.5 7 7 11.5 2.5 7Z" />
        </svg>
      );
    case "double-arrow":
      return (
        <svg {...common}>
          <path d="M2.5 11.5 11.5 2.5" />
          <path d="M6.5 2.5h5v5" />
          <path d="M7.5 11.5h-5v-5" />
        </svg>
      );
    case "frame":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="9" height="9" rx="1" strokeDasharray="2 1.5" />
          <path d="M2.5 5.5h9M2.5 8.5h9M5.5 2.5v9M8.5 2.5v9" strokeOpacity="0.4" />
        </svg>
      );
  }
}