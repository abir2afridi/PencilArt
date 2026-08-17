import { useEffect, useState, type RefObject } from "react";
import type { DrawHandle, Stroke } from "pencilart";
import { Chip, Dropdown } from "../Dropdown";
import { CtrlIcon } from "../icons";

/**
 * The reusable-element library: the elements in hand can be banked here and
 * dropped back onto any page. Everything lives in the browser — localStorage,
 * nothing leaves the machine — and each item keeps whatever the elements
 * carried (style, group, text, images).
 */
type LibraryItem = {
  /** A local id, stable while the item is in the list. */
  id: number;
  name: string;
  strokes: Stroke[];
  updated: number;
};

const KEY = "pencilart-library";

function load(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: LibraryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* a full or private store is fine to ignore */
  }
}

export function LibraryControl({
  draw,
  selection,
}: {
  draw: RefObject<DrawHandle | null>;
  /** The elements in hand, mirrored from the surface. */
  selection: number[];
}) {
  const [items, setItems] = useState<LibraryItem[]>(() => load());
  const [query, setQuery] = useState("");
  useEffect(() => save(items), [items]);

  const has = selection.length > 0;
  const addSelection = () => {
    const selected = new Set(selection);
    const strokes = draw.current
      ?.getStrokes()
      .filter((s) => selected.has(s.id));
    if (!strokes?.length) return;
    const id = Date.now();
    const name = `${strokes.length} element${strokes.length > 1 ? "s" : ""}`;
    setItems((prev) =>
      [{ id, name, strokes, updated: id }, ...prev].slice(0, 40),
    );
  };

  const insert = (item: LibraryItem) => {
    draw.current?.addStrokes(item.strokes);
  };

  const remove = (id: number) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const shown = query
    ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <Dropdown
      label="Library"
      icon={<CtrlIcon id="library" />}
      current={items.length ? `${items.length}` : undefined}
    >
      {() => (
        <>
          <Chip disabled={!has} onClick={addSelection}>
            bank selection
          </Chip>
          <input
            aria-label="Search the library"
            placeholder="search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 6,
              padding: "5px 8px",
              background: "rgba(255,255,255,0.07)",
              color: "inherit",
              font: "inherit",
              outline: "none",
            }}
          />
          {shown.length === 0 ? (
            <Chip disabled onClick={() => undefined}>
              nothing banked yet
            </Chip>
          ) : (
            shown.map((item) => (
              <span key={item.id} style={{ display: "inline-flex", gap: 3 }}>
                <Chip label={item.name} onClick={() => insert(item)}>
                  {item.name}
                </Chip>
                <Chip label={`Remove ${item.name}`} onClick={() => remove(item.id)}>
                  ×
                </Chip>
              </span>
            ))
          )}
        </>
      )}
    </Dropdown>
  );
}
