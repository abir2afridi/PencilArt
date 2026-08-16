import { THEMES, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** The drawing component's own light, dark, or OS-following theme. */
export function ThemeControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown
      label="Theme"
      current={value.theme}
      icon={<CtrlIcon id="theme" />}
    >
      {(close) =>
        THEMES.map((t) => (
          <Toggle
            key={t}
            on={value.theme === t}
            onClick={() => {
              onChange({ ...value, theme: t });
              close();
            }}
          >
            {t}
          </Toggle>
        ))
      }
    </Dropdown>
  );
}