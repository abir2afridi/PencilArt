import type { ShapeDef, ShapeKind } from "../types";
import { rect } from "./rect";
import { ellipse } from "./ellipse";
import { line } from "./line";
import { arrow } from "./arrow";

/** The shape tools, in the order they sit in the tray. */
export const SHAPES: ShapeDef[] = [rect, ellipse, line, arrow];

export const SHAPE_BY_ID = Object.fromEntries(
  SHAPES.map((s) => [s.kind, s]),
) as Record<ShapeKind, ShapeDef>;

/** Whether a tool id is a shape tool. */
export function isShape(id: string): id is ShapeKind {
  return Object.prototype.hasOwnProperty.call(SHAPE_BY_ID, id);
}