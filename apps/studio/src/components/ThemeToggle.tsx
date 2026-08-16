import { MoonIcon, SunIcon } from "./icons";
import css from "./ThemeToggle.module.css";

/** The sun/moon switch for the header shell's own light or dark chrome. */
export function ThemeToggle({
  shell,
  onShell,
}: {
  shell: "dark" | "light";
  onShell: (next: "dark" | "light") => void;
}) {
  return (
    <button
      type="button"
      className={css.theme}
      aria-label={
        shell === "dark" ? "Switch the header to light" : "Switch the header to dark"
      }
      onClick={() => onShell(shell === "dark" ? "light" : "dark")}
    >
      {shell === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}