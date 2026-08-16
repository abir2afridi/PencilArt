import type { InkMode, PenId, ShapeKind } from "pencilart";

/**
 * The demo harness's state. Everything here maps to exactly one `Draw` prop,
 * so the panel doubles as the list of what's supported.
 */
export type DebugState = {
  placement: "bottom" | "left" | "right";
  theme: "light" | "dark" | "auto";
  depth: "flat" | "soft" | "regular" | "strong";
  settings: "bar" | "tool";
  align: "start" | "center" | "end";
  look: "classic" | "studio";
  gauge: boolean;
  shortcuts: boolean;
  ink: InkMode;
  chrome: boolean;
  motion: "rise" | "none";
  tooltips: false | "all" | "tools";
  eraser: boolean;
  transparent: boolean;
  draggable: boolean;
  /** Empty means "all of them". */
  tools: (PenId | ShapeKind)[];
  controls: {
    color: boolean;
    size: boolean;
    opacity: boolean;
    custom: boolean;
    undo: boolean;
    clear: boolean;
    minimize: boolean;
  };
};

export const defaults: DebugState = {
  placement: "bottom",
  theme: "light",
  depth: "regular",
  settings: "bar",
  align: "center",
  look: "classic",
  gauge: false,
  shortcuts: true,
  ink: "auto",
  chrome: true,
  motion: "rise",
  tooltips: "all",
  eraser: true,
  transparent: false,
  draggable: false,
  tools: [],
  controls: {
    color: true,
    size: true,
    opacity: true,
    custom: true,
    undo: true,
    clear: true,
    minimize: true,
  },
};

export const PLACEMENTS = ["bottom", "left", "right"] as const;
export const THEMES = ["light", "dark", "auto"] as const;
export const DEPTHS = ["flat", "soft", "regular", "strong"] as const;
export const SETTINGS = ["bar", "tool"] as const;
export const LOOKS = ["classic", "studio"] as const;
export const ALIGNS = ["start", "center", "end"] as const;
export const INKS: InkMode[] = ["auto", "shared", "per-tool"];
export const CONTROLS = [
  "color",
  "size",
  "opacity",
  "custom",
  "undo",
  "clear",
  "minimize",
] as const;