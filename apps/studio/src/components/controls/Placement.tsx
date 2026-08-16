import { PLACEMENTS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";
import { CtrlIcon } from "../icons";

/** Which edge the toolbar sits on. */
export function PlacementControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown
      label="Placement"
      current={value.placement}
      icon={<CtrlIcon id="placement" />}
    >
      {(close) =>
        PLACEMENTS.map((p) => (
          <Toggle
            key={p}
            on={value.placement === p}
            onClick={() => {
              onChange({ ...value, placement: p });
              close();
            }}
          >
            {p}
          </Toggle>
        ))
      }
    </Dropdown>
  );
}