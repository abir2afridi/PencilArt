import type { ShapeDef, ShapeKind } from "./types";

/** The shape tools, in the order they sit in the tray. */
export const SHAPES: ShapeDef[] = [
  { kind: "rect", name: "Rectangle", key: "r", defaultSize: 6, defaultOpacity: 1 },
  { kind: "ellipse", name: "Ellipse", key: "o", defaultSize: 6, defaultOpacity: 1 },
  { kind: "line", name: "Line", key: "l", defaultSize: 6, defaultOpacity: 1 },
  { kind: "arrow", name: "Arrow", key: "a", defaultSize: 6, defaultOpacity: 1 },
];

export const SHAPE_BY_ID = Object.fromEntries(
  SHAPES.map((s) => [s.kind, s]),
) as Record<ShapeKind, ShapeDef>;

/** Whether a tool id is a shape tool. */
export function isShape(id: string): id is ShapeKind {
  return Object.prototype.hasOwnProperty.call(SHAPE_BY_ID, id);
}
