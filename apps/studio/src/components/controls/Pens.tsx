import { PENS } from "pencilart";
import type { DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";

/** Which pens appear, and in what order. */
export function PensControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Pens">
      {() =>
        PENS.map((p) => {
          // Empty means every tool, so the first click has to seed the list
          // with everything *except* the one being switched off.
          const on = value.tools.length === 0 || value.tools.includes(p.id);
          return (
            <Toggle
              key={p.id}
              on={on}
              onClick={() => {
                const current = value.tools.length
                  ? value.tools
                  : PENS.map((x) => x.id);
                // Switching one back on puts it at the end, so the chips
                // reorder the tray as well as filtering it — which is what
                // `tools` does, and there was no way to see it before.
                const next = on
                  ? current.filter((id) => id !== p.id)
                  : [...current, p.id];
                onChange({ ...value, tools: next });
              }}
            >
              {p.name}
            </Toggle>
          );
        })
      }
    </Dropdown>
  );
}