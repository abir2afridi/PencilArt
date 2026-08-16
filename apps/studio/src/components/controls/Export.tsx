import type { RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Saving the current page: SVG and PNG downloads, or the SVG to clipboard. */
export function ExportControl({
  draw,
}: {
  draw: RefObject<DrawHandle | null>;
}) {
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
              const svg = draw.current?.toSvg() ?? "";
              // eslint-disable-next-line no-console
              console.log(svg);
              navigator.clipboard?.writeText(svg);
            }}
          >
            copy svg
          </Chip>
        </>
      )}
    </Dropdown>
  );
}