import type { RefObject } from "react";
import type { DrawHandle, StylePatch } from "pencilart";
import { SWATCHES } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** The ink on the elements in hand: colour, width, opacity, and a figure's
    fill and shaft style. Every chip restyles the selection in one undoable
    step, and only the actions that make sense are offered. */
export function StyleControl({
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
    <Dropdown label="Style" icon={<CtrlIcon id="style" />}>
      {() => (
        <>
          {SWATCHES.slice(0, 12).map((c) => (
            <Chip
              key={c}
              label={c}
              disabled={!has}
              onClick={() => style({ color: c })}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: c,
                  boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.5)",
                }}
              />
            </Chip>
          ))}
          {[2, 4, 8, 14].map((s) => (
            <Chip key={s} disabled={!has} onClick={() => style({ size: s })}>
              {s}px
            </Chip>
          ))}
          {[1, 0.7, 0.4].map((o) => (
            <Chip
              key={o}
              disabled={!has}
              onClick={() => style({ opacity: o })}
            >
              {Math.round(o * 100)}%
            </Chip>
          ))}
          <Chip disabled={!has} onClick={() => style({ fill: null })}>
            no fill
          </Chip>
          <Chip disabled={!has} onClick={() => style({ fill: "solid" })}>
            fill
          </Chip>
          <Chip disabled={!has} onClick={() => style({ fill: "hachure" })}>
            hachure
          </Chip>
          <Chip disabled={!has} onClick={() => style({ fill: "cross-hatch" })}>
            cross-hatch
          </Chip>
          <Chip disabled={!has} onClick={() => style({ fillColor: null })}>
            fill = ink
          </Chip>
          {SWATCHES.slice(0, 8).map((c) => (
            <Chip
              key={c}
              label={`fill ${c}`}
              disabled={!has}
              onClick={() => style({ fillColor: c })}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: c,
                  boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.5)",
                }}
              />
              <span style={{ fontSize: 10 }}>{`fill ${c}`}</span>
            </Chip>
          ))}
          <Chip disabled={!has} onClick={() => style({ dash: "dash" })}>
            dashed
          </Chip>
          <Chip disabled={!has} onClick={() => style({ dash: "dot" })}>
            dotted
          </Chip>
          <Chip disabled={!has} onClick={() => style({ dash: "solid" })}>
            solid
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headSize: 12 })}>
            head sm
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headSize: 20 })}>
            head md
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headSize: 30 })}>
            head lg
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headSize: null })}>
            head auto
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headStart: false })}>
            no start head
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headStart: true })}>
            start head
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headEnd: true })}>
            end head
          </Chip>
          <Chip disabled={!has} onClick={() => style({ headEnd: false })}>
            no end head
          </Chip>
        </>
      )}
    </Dropdown>
  );
}
