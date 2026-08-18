import { useState, type RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { serializeDrawing } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Saving the current page: SVG and PNG downloads, the JSON a `.pencilart`
    export writes, or the SVG to clipboard. The PNG can be scaled, stripped of
    its background, or cropped to the elements in hand. */
export function ExportControl({
  draw,
}: {
  draw: RefObject<DrawHandle | null>;
}) {
  const [scale, setScale] = useState(2);
  const [transparent, setTransparent] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const json = () => serializeDrawing(draw.current?.getStrokes() ?? []);
  const opts = { scale, transparent, selection: selectionOnly };
  return (
    <Dropdown label="Export" icon={<CtrlIcon id="export" />}>
      {() => (
        <>
          <Chip label="Export SVG" onClick={() => draw.current?.download("drawing", "svg", opts)}>
            .svg
          </Chip>
          <Chip label="Export PNG" onClick={() => draw.current?.download("drawing", "png", opts)}>
            .png
          </Chip>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              opacity: 0.85,
              padding: "4px 2px",
            }}
          >
            scale
            <input
              aria-label="Export scale"
              type="number"
              min={1}
              max={8}
              step={0.5}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) || 1)}
              style={{
                width: 52,
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 6,
                padding: "3px 6px",
                background: "rgba(255,255,255,0.07)",
                color: "inherit",
                font: "inherit",
                outline: "none",
              }}
            />
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              opacity: 0.85,
              padding: "2px 2px",
              cursor: "pointer",
            }}
          >
            <input
              aria-label="Transparent background"
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            transparent
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              opacity: 0.85,
              padding: "2px 2px",
              cursor: "pointer",
            }}
          >
            <input
              aria-label="Export selection only"
              type="checkbox"
              checked={selectionOnly}
              onChange={(e) => setSelectionOnly(e.target.checked)}
            />
            selection only
          </label>
          <Chip
            label="Export JSON"
            onClick={() => {
              const blob = new Blob([json()], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "drawing.pencilart.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            .json
          </Chip>
          <Chip
            label="Copy SVG to the clipboard"
            onClick={() => {
              const svg = draw.current?.toSvg(opts) ?? "";
              // eslint-disable-next-line no-console
              console.log(svg);
              navigator.clipboard?.writeText(svg);
            }}
          >
            copy svg
          </Chip>
          <Chip
            label="Copy JSON to the clipboard"
            onClick={() => {
              navigator.clipboard?.writeText(json());
            }}
          >
            copy json
          </Chip>
        </>
      )}
    </Dropdown>
  );
}
