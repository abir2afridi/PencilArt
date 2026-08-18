# PencilArt

A drawing toolbar for React. Seven pens, an eraser, SVG and PNG export, and
not a single dependency.

This is a pnpm monorepo with two halves:

| Path                 | What it is                                              |
| -------------------- | ------------------------------------------------------- |
| `packages/draw`      | The `pencilart` library — the component, hooks, engine |
| `apps/studio`        | The demo harness that exercises every prop             |

## Features

- Seven tools: **Pencil, Pen, Fineliner, Marker, Highlighter, Brush, Fountain Pen** — plus an eraser
- Four shape tools: **Rectangle, Ellipse, Line, Arrow** — drag to place, Shift to square or snap
- Size, opacity, and ink colour — shared across tools or remembered per tool
- Freehand rendering engine that outputs real SVG strokes
- Export a page as **SVG** or **PNG** (retina scale included)
- Undo/redo, clear, a collapsible toolbar, keyboard shortcuts
- Placement on any edge (`bottom`, `left`, `right`) with alignment and inset control
- Classic or studio look, four depth levels, light/dark/auto themes
- Draggable toolbar, hover tooltips, size gauge on the pen barrel
- A `selectTool` handle and `onToolChange` callback, so a host's own chrome can pick up tools
- Zero dependencies — peer-depends only on React

## Getting started

```bash
pnpm install
pnpm dev          # run the studio demo
pnpm build        # build the package, then the studio
pnpm typecheck    # typecheck everything
```

## The studio (`apps/studio`)

The demo harness is a drawing notebook in its own right:

- **Controls sidebar** — every knob lives down the left edge, one dropdown per
  feature (Placement, Theme, Depth, Settings, Align, Tools, Ink, Controls,
  Pens, Motion, Also, Export), each showing its current value and opening
  only when asked. It rests as a rail of glyphs under the brand and fans
  out to a full column while the pointer is over it or an open menu; on
  small screens the rail steps aside for a drawer. The header above keeps
  the brand, the shell theme and the pages, so the whole surface stays a
  drawing; the four shape tools rest there as buttons too, keeping the
  drawing tray purely about pens
- **Pages** — add pages with **+**, turn them with **◀ ▶**, delete with the
  bin, and watch them flip like paper in a real book (3D page-turn on the
  spine edge)
- **Undo/redo** — step back and forward over gestures, honestly disabled at
  the edges
- **Sun/moon toggle** — the header shell itself switches between dark and
  light chrome
- **Export** — download the current page as `.svg` or `.png @2x`, or copy the
  SVG markup to the clipboard

The harness code is deliberately split one feature per file under
`apps/studio/src/components/`, so it doubles as a tour of what the library
supports.

## Using the library

The `<Draw />` line is all a consumer writes:

```tsx
import { Draw, type DrawHandle } from "pencilart";
import { useRef } from "react";

function App() {
  const draw = useRef<DrawHandle>(null);

  return (
    <Draw
      ref={draw}
      theme="dark"
      placement="bottom"
      tools={["pencil", "marker", "highlighter"]}
    />
  );
}
```

`Draw` exposes a handle for everything outside the canvas:

```ts
draw.current?.undo();
draw.current?.redo();
draw.current?.clear();
draw.current?.toSvg();
await draw.current?.download("drawing", "png", 2);
```

For hosts that bring their own chrome, the pieces are exported separately:
`DrawSurface`, `Toolbar`, `useDrawing`, and the freehand `getStroke` engine.
`Draw` accepts `tools` (the pens and shapes in the tray, in order) and
`shapes` — an empty `shapes={[]}` hides the shape row entirely, for hosts
that place the shape tools in their own chrome (as the studio does).

## License

MIT