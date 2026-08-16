import type { DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Everything that doesn't fit anywhere else. */
export function AlsoControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Also" icon={<CtrlIcon id="also" />}>
      {() => (
        <>
          {/* `chrome={false}` is the bring-your-own-UI switch: it takes the
              whole toolbar away and leaves the bare surface, for apps driving
              DrawSurface and the hooks with their own controls. */}
          <Toggle
            on={value.chrome}
            onClick={() => onChange({ ...value, chrome: !value.chrome })}
          >
            toolbar
          </Toggle>
          <Toggle
            on={value.eraser}
            onClick={() => onChange({ ...value, eraser: !value.eraser })}
          >
            eraser
          </Toggle>
          <Toggle
            on={value.tooltips !== false}
            onClick={() =>
              onChange({
                ...value,
                tooltips:
                  value.tooltips === "all"
                    ? "tools"
                    : value.tooltips === "tools"
                      ? false
                      : "all",
              })
            }
          >
            tips: {value.tooltips === false ? "off" : value.tooltips}
          </Toggle>
          <Toggle
            on={value.transparent}
            onClick={() =>
              onChange({ ...value, transparent: !value.transparent })
            }
          >
            transparent
          </Toggle>
          <Toggle
            on={value.draggable}
            onClick={() => onChange({ ...value, draggable: !value.draggable })}
          >
            draggable
          </Toggle>
        </>
      )}
    </Dropdown>
  );
}