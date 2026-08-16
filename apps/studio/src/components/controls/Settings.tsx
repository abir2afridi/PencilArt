import { SETTINGS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";

/** Where size and opacity live: on the bar or on the tool itself. */
export function SettingsControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Settings" current={value.settings}>
      {(close) =>
        SETTINGS.map((v) => (
          <Toggle
            key={v}
            on={value.settings === v}
            onClick={() => {
              onChange({ ...value, settings: v });
              close();
            }}
          >
            {v}
          </Toggle>
        ))
      }
    </Dropdown>
  );
}