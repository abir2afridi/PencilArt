import { INKS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";

/** How ink colour is shared between the tools. */
export function InkControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Ink" current={value.ink}>
      {(close) =>
        INKS.map((m) => (
          <Toggle
            key={m}
            on={value.ink === m}
            onClick={() => {
              onChange({ ...value, ink: m });
              close();
            }}
          >
            {m}
          </Toggle>
        ))
      }
    </Dropdown>
  );
}