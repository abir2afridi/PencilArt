import type { DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** How the bar arrives and leaves, and a replay of the whole trip. */
export function MotionControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown
      label="Motion"
      current={value.motion}
      icon={<CtrlIcon id="motion" />}
    >
      {(close) => (
        <>
          {(["rise", "none"] as const).map((m) => (
            <Toggle
              key={m}
              on={value.motion === m}
              onClick={() => {
                onChange({ ...value, motion: m });
                close();
              }}
            >
              {m}
            </Toggle>
          ))}
          {/* Out and back in, so both halves can be watched without having
              to find the toolbar switch and hit it twice. */}
          <Toggle
            on={false}
            onClick={() => {
              onChange({ ...value, chrome: false });
              window.setTimeout(
                () => onChange({ ...value, chrome: true }),
                900,
              );
            }}
          >
            replay
          </Toggle>
          <Toggle
            on={value.chrome}
            onClick={() => onChange({ ...value, chrome: !value.chrome })}
          >
            {value.chrome ? "hide" : "show"}
          </Toggle>
        </>
      )}
    </Dropdown>
  );
}