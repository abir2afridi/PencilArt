import { LOOKS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** How the tools are drawn, plus the gauge and keyboard shortcuts. */
export function ToolsControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown
      label="Tools"
      current={value.look}
      icon={<CtrlIcon id="look" />}
    >
      {(close) => (
        <>
          {LOOKS.map((v) => (
            <Toggle
              key={v}
              on={value.look === v}
              onClick={() => {
                onChange({ ...value, look: v });
                close();
              }}
            >
              {v}
            </Toggle>
          ))}
          <Toggle
            on={value.gauge}
            onClick={() => onChange({ ...value, gauge: !value.gauge })}
          >
            gauge
          </Toggle>
          <Toggle
            on={value.shortcuts}
            onClick={() => onChange({ ...value, shortcuts: !value.shortcuts })}
          >
            keys
          </Toggle>
          <Toggle
            on={value.grid}
            onClick={() => onChange({ ...value, grid: !value.grid })}
          >
            grid
          </Toggle>
        </>
      )}
    </Dropdown>
  );
}