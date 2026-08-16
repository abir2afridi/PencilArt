import { CONTROLS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";

/** Which of the built-in toolbar controls are offered. */
export function ControlsControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Controls">
      {() =>
        CONTROLS.map((c) => (
          <Toggle
            key={c}
            on={value.controls[c]}
            onClick={() =>
              onChange({
                ...value,
                controls: { ...value.controls, [c]: !value.controls[c] },
              })
            }
          >
            {c}
          </Toggle>
        ))
      }
    </Dropdown>
  );
}