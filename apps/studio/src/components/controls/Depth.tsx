import { DEPTHS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** How much the toolbar reads as a physical object. */
export function DepthControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown
      label="Depth"
      current={value.depth}
      icon={<CtrlIcon id="depth" />}
    >
      {(close) =>
        DEPTHS.map((d) => (
          <Toggle
            key={d}
            on={value.depth === d}
            onClick={() => {
              onChange({ ...value, depth: d });
              close();
            }}
          >
            {d}
          </Toggle>
        ))
      }
    </Dropdown>
  );
}