import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronIcon } from "./icons";
import css from "./Dropdown.module.css";

/**
 * A trigger that opens a menu of chips. Self-contained: each dropdown minds
 * its own open state, closing on an outside click or Escape.
 *
 * Children are a render prop so a pick can close the menu with `close()`.
 */
export function Dropdown({
  label,
  current,
  children,
}: {
  label: string;
  current?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={css.dropdown} ref={root}>
      <button
        type="button"
        className={css.trigger}
        data-active={open || undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {current ? <span className={css.current}>{current}</span> : null}
        <ChevronIcon className={css.chevron} />
      </button>
      {open && (
        <div className={css.menu}>
          {Children.map(children(close), (child, i) =>
            isValidElement(child)
              ? cloneElement(
                  child as React.ReactElement<{ style?: CSSProperties }>,
                  { style: { animationDelay: `${i * 60}ms` } },
                )
              : child,
          )}
        </div>
      )}
    </div>
  );
}

/** A plain menu item or header button, in the chip glass. */
export function Chip({
  onClick,
  disabled,
  active,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={css.chip}
      data-active={active || undefined}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** A chip that lights up while its value is chosen. */
export function Toggle({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Chip onClick={onClick} disabled={disabled} active={on}>
      {children}
    </Chip>
  );
}