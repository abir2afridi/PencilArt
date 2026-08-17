import { useRef, type RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Photographs onto the page: an image file in at the centre of the view,
    selected on arrival. (Clipboard paste of an image also works directly on
    the surface.) */
export function ImagesControl({
  draw,
}: {
  draw: RefObject<DrawHandle | null>;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <Dropdown label="Images" icon={<CtrlIcon id="images" />}>
      {() => (
        <>
          <Chip onClick={() => file.current?.click()}>add image…</Chip>
          <Chip
            onClick={() => {
              navigator.clipboard
                ?.read?.()
                .then((items) =>
                  items.find((i) => i.types.includes("image/png")),
                )
                .then((item) => item?.getType("image/png"))
                .then((blob) => {
                  if (blob) return draw.current?.addImage(blob as File);
                })
                .catch(() => undefined);
            }}
          >
            paste from clipboard
          </Chip>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) draw.current?.addImage(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </Dropdown>
  );
}
