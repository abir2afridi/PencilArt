import type { RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { serializeDrawing } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Saving the current page: SVG and PNG downloads, the JSON a `.pencilart`
    export writes, or the SVG to clipboard. */
export function ExportControl({
  draw,
}: {
  draw: RefObject<DrawHandle | null>;
}) {
  const json = () =>
    serializeDrawing(draw.current?.getStrokes() ?? []);
  return (
    <Dropdown label="Export" icon={<CtrlIcon id="export" />}>
      {() => (
        <>
          <Chip onClick={() => draw.current?.download("drawing", "svg")}>
            .svg
          </Chip>
          <Chip onClick={() => draw.current?.download("drawing", "png", 2)}>
            .png @2x
          </Chip>
          <Chip
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
            onClick={() => {
              const svg = draw.current?.toSvg() ?? "";
              // eslint-disable-next-line no-console
              console.log(svg);
              navigator.clipboard?.writeText(svg);
            }}
          >
            copy svg
          </Chip>
          <Chip
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