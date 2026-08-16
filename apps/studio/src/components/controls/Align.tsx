import { ALIGNS, type DebugState } from "../../state";
import { Dropdown, Toggle } from "../Dropdown";

/** Where along its edge the toolbar sits. */
export function AlignControl({
  value,
  onChange,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
}) {
  return (
    <Dropdown label="Align" current={value.align}>
      {(close) =>
        ALIGNS.map((v) => (
          <Toggle
            key={v}
            on={value.align === v}
            onClick={() => {
              onChange({ ...value, align: v });
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