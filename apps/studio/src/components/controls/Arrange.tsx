import type { RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Stack order, grouping, locking and arrangement for the elements in hand. */
export function ArrangeControl({
  draw,
  selection,
}: {
  draw: RefObject<DrawHandle | null>;
  /** The elements in hand, mirrored from the surface. */
  selection: number[];
}) {
  const has = selection.length > 0;
  return (
    <Dropdown label="Arrange" icon={<CtrlIcon id="arrange" />}>
      {() => (
        <>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.reorderSelection("front")}
          >
            front
          </Chip>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.reorderSelection("forward")}
          >
            forward
          </Chip>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.reorderSelection("backward")}
          >
            backward
          </Chip>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.reorderSelection("back")}
          >
            back
          </Chip>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.groupSelection()}
          >
            group
          </Chip>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.ungroupSelection()}
          >
            ungroup
          </Chip>
          <Chip
            disabled={!has}
            onClick={() => draw.current?.toggleLockSelection()}
          >
            lock
          </Chip>
          {(
            [
              ["left", "left"],
              ["center", "center"],
              ["right", "right"],
              ["top", "top"],
              ["middle", "middle"],
              ["bottom", "bottom"],
            ] as const
          ).map(([how, label]) => (
            <Chip
              key={how}
              disabled={!has}
              onClick={() => draw.current?.alignSelection(how)}
            >
              {label}
            </Chip>
          ))}
          <Chip
            disabled={selection.length < 3}
            onClick={() => draw.current?.distributeSelection("h")}
          >
            space h
          </Chip>
          <Chip
            disabled={selection.length < 3}
            onClick={() => draw.current?.distributeSelection("v")}
          >
            space v
          </Chip>
        </>
      )}
    </Dropdown>
  );
}
