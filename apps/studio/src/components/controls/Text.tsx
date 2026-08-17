import type { RefObject } from "react";
import type { DrawHandle, StylePatch } from "pencilart";
import { Chip, Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** The face of text marks in hand: family, size, and emphasis. */
const FONTS: [string, string][] = [
  ["sans", "ui-sans-serif, system-ui, sans-serif"],
  ["serif", "Georgia, 'Times New Roman', serif"],
  ["mono", "ui-monospace, 'Cascadia Code', Consolas, monospace"],
];

export function TextControl({
  draw,
  selection,
}: {
  draw: RefObject<DrawHandle | null>;
  /** The elements in hand, mirrored from the surface. */
  selection: number[];
}) {
  const has = selection.length > 0;
  const style = (patch: StylePatch) => draw.current?.styleSelection(patch);
  return (
    <Dropdown label="Text" icon={<CtrlIcon id="text" />}>
      {() => (
        <>
          {FONTS.map(([name, family]) => (
            <Chip
              key={name}
              disabled={!has}
              onClick={() => style({ font: family })}
            >
              {name}
            </Chip>
          ))}
          {[14, 18, 24, 32].map((s) => (
            <Chip key={s} disabled={!has} onClick={() => style({ size: s })}>
              {s}px
            </Chip>
          ))}
          <Toggle on={false} disabled={!has} onClick={() => style({ bold: true })}>
            bold
          </Toggle>
          <Toggle on={false} disabled={!has} onClick={() => style({ bold: false })}>
            regular
          </Toggle>
          <Toggle on={false} disabled={!has} onClick={() => style({ italic: true })}>
            italic
          </Toggle>
          <Toggle on={false} disabled={!has} onClick={() => style({ italic: false })}>
            upright
          </Toggle>
        </>
      )}
    </Dropdown>
  );
}
