import type { FreehandOptions } from "./freehand";

/** A sampled input point: x, y, pressure (0–1). */
export type Point = [number, number, number];

export type PenId =
  | "pencil"
  | "pen"
  | "fineliner"
  | "marker"
  | "highlighter"
  | "brush"
  | "fountain"
  | "eraser-pen";

/** A geometric figure the surface can draw, like a pen but dragged, not
 * traced. */
export type ShapeKind =
  | "rect"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "double-arrow"
  | "frame";

/** Anything the toolbar can be holding. */
export type ToolId = PenId | "eraser" | "select" | "text" | ShapeKind;

/**
 * A broad-nib pen: a flat edge held at a fixed angle. Width comes from the
 * angle between the nib and the direction of travel, not from pressure, which
 * is what gives calligraphy its thick-and-thin character. The freehand engine
 * has no concept of nib angle, so these strokes use their own outline builder.
 */
export type Pen = {
  id: PenId;
  name: string;
  /** single-key keyboard shortcut. Absent, the pen has none. */
  key?: string;
  defaultSize: number;
  /** default stroke opacity (0–1) */
  defaultOpacity: number;
  /**
   * Colour to switch to when this pen is picked, if it only makes sense in
   * one. Left unset, a pen keeps whatever ink is already selected.
   */
  defaultColor?: string;
  /** SVG mix-blend-mode for the stroke */
  blend?: "normal" | "multiply";
  /** freehand engine options for a given brush size */
  options: (size: number) => FreehandOptions;
};

/** Per-stroke overrides of the pen's shape. Absent fields fall back to it. */
export type StrokeShape = {
  /** nib angle in degrees; only meaningful on a broad-nib pen */
  nibAngle?: number;
  /** how far the stroke tapers in at each end */
  taper?: number;
  /** Whether width came from velocity rather than from the hardware. */
  simulatePressure?: boolean;
};

/** The SVG for a committed figure: its stroked outline, plus an optional
    filled head (the arrow's). */
export type FigureMarkup = { d: string; head?: string };

/** One shape tool as offered in the tray. */
export type ShapeDef = {
  kind: ShapeKind;
  name: string;
  /** single-key keyboard shortcut */
  key: string;
  defaultSize: number;
  /** default stroke opacity (0–1) */
  defaultOpacity: number;
  /** The outline to draw for a committed or in-progress figure. */
  figure: (shape: Shape, size: number) => FigureMarkup;
  /** How a Shift-held drag is constrained, given the signed drag deltas:
      squares the rect and ellipse, and locks the line and arrow to the
      nearest of the eight compass directions. */
  snap: (w: number, h: number) => { w: number; h: number };
};

/** How a closed figure is filled. */
export type FigureFill = "solid" | "hachure" | "cross-hatch";

/** A committed figure: the bounding box of its two drag anchors. */
export type Shape = {
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Paint the closed path. `true` is the plain wash; the others are hatched. */
  fill?: FigureFill;
  /** The fill's own colour; absent, the stroke colour is used. */
  fillColor?: string;
  /** The shaft's line style; the arrow's head stays solid. */
  dash?: FigureDash;
  /** How long the arrow head is; absent, it scales with the stroke. */
  headSize?: number;
  /** Whether the arrow has a head on its start anchor. */
  headStart?: boolean;
  /** Whether the arrow has a head on its end anchor. */
  headEnd?: boolean;
  /** A quadratic-Bézier control point for a line or arrow shaft, in board
   *  coordinates. Absent, the shaft is straight. */
  bend?: { x: number; y: number };
  /** Connector links: the ids of elements an arrow's anchors stick to. The
   *  offsets are where each anchor sits relative to its element's box, so
   *  the arrow follows the element as it moves. */
  bound?: {
    start?: number;
    end?: number;
    sx?: number;
    sy?: number;
    ex?: number;
    ey?: number;
  };
  /** A human-friendly name for a frame, shown on its top-left corner. */
  frameName?: string;
};

/** The shaft's line style. */
export type FigureDash = "solid" | "dash" | "dot";

/** A raster placed on the board at `points[0]`, sized `w`×`h`. */
export type ImagePart = { data: string; w: number; h: number };

/** A text mark placed at `points[0]`, fitted to `w`×`h`. */
export type TextPart = {
  content: string;
  size: number;
  w: number;
  h: number;
  /** CSS font family, for hosts that want to override the default hand. */
  font: string;
  bold?: boolean;
  italic?: boolean;
  /** How the lines sit within the mark's box. */
  align?: "left" | "center" | "right";
  /** A wash behind the text; absent, the text stands on its own. */
  background?: string;
};

/** One committed mark. */
export type Stroke = {
  id: number;
  pen: PenId;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
  shape?: StrokeShape;
  /**
   * A geometric figure in place of a freehand outline. When present the
   * stroke renders as `figure`, stroked at `size` in `color`, and `points`
   * are just its two anchors.
   */
  figure?: Shape;
  /** A raster in place of an outline; `points` is its top-left corner. */
  image?: ImagePart;
  /** A text mark; `points` is its top-left corner and `text` sizes it. */
  text?: TextPart;
  /** Rotation in degrees, clockwise, about the element's own centre. */
  rotate?: number;
  /** Members of the same group select as one. */
  group?: number;
  /** Frozen in place: it can't be picked up, moved, or changed. */
  locked?: boolean;
  /**
   * An eraser pass. Kept in the same list, in order, because erasing must only
   * affect ink already on the page — draw again afterwards and the new mark is
   * untouched, exactly as it would be on paper.
   */
  erase?: boolean;
  /** The frame this element belongs to, by the frame stroke's id. */
  frameId?: number;
};

/** The fixed-size surface strokes are drawn onto. */
export type Board = { w: number; h: number };

/** An axis-aligned box on the board, in board units. */
export type Box = { x: number; y: number; w: number; h: number };
