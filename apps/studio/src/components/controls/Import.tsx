import { useRef, useState, type RefObject } from "react";
import type { DrawHandle } from "pencilart";
import { parseDrawing } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** A saved drawing back onto the page: the JSON a `.pencilart` export wrote,
    validated before anything lands. The elements arrive with fresh ids and
    groups, centred on the view and selected. */
export function ImportControl({
  draw,
}: {
  draw: RefObject<DrawHandle | null>;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (f: File) => {
    const parsed = parseDrawing(await f.text());
    if (!parsed) {
      setError("not a drawing file");
      return;
    }
    draw.current?.addStrokes(parsed.strokes);
    setError(null);
  };

  return (
    <Dropdown label="Import" icon={<CtrlIcon id="import" />}>
      {() => (
        <>
          <Chip onClick={() => file.current?.click()}>open drawing…</Chip>
          {error ? (
            <Chip onClick={() => setError(null)} aria-label="Dismiss error">
              {error}
            </Chip>
          ) : null}
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) open(f);
              e.target.value = "";
            }}
          />
        </>
      )}
    </Dropdown>
  );
}
