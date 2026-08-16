import { PENS, SHAPES } from "pencilart";
import type { DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

const ALL_TOOLS = [...PENS.map((p) => p.id), ...SHAPES.map((s) => s.kind)];
const NAME: Record<string, string> = Object.fromEntries([
  ...PENS.map((p) => [p.id, p.name]),
  ...SHAPES.map((s) => [s.kind, s.name]),
]);

/** Which tools appear, and in what order. */
export function PensControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Pens" icon={<CtrlIcon id="pens" />}>
      {() =>
        ALL_TOOLS.map((id) => {
          // Empty means every tool, so the first click has to seed the list
          // with everything *except* the one being switched off.
          const on = value.tools.length === 0 || value.tools.includes(id);
          return (
            <Toggle
              key={id}
              on={on}
              onClick={() => {
                const current = value.tools.length
                  ? value.tools
                  : ALL_TOOLS;
                // Switching one back on puts it at the end, so the chips
                // reorder the tray as well as filtering it — which is what
                // `tools` does, and there was no way to see it before.
                const next = on
                  ? current.filter((x) => x !== id)
                  : [...current, id];
                onChange({ ...value, tools: next });
              }}
            >
              {NAME[id]}
            </Toggle>
          );
        })
      }
    </Dropdown>
  );
}
