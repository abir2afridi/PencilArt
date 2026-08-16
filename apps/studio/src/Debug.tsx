import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, RefObject } from "react";
import {
  PENS,
  type DrawHandle,
  type InkMode,
  type PenId,
} from "pencilart";
import css from "./Debug.module.css";

/**
 * Demo-only controls for exercising the package's props.
 *
 * Lives in the demo app, never in the package — a drawing component has no
 * business shipping a panel that reconfigures itself. Everything here maps to
 * exactly one prop, so the panel doubles as the list of what's supported.
 *
 * Each group is a dropdown in the header bar, so the bar stays slim and the
 * knobs only appear when a group is opened.
 */
export type DebugState = {
  placement: "bottom" | "left" | "right";
  theme: "light" | "dark" | "auto";
  depth: "flat" | "soft" | "regular" | "strong";
  settings: "bar" | "tool";
  align: "start" | "center" | "end";
  look: "classic" | "studio";
  gauge: boolean;
  shortcuts: boolean;
  ink: InkMode;
  chrome: boolean;
  motion: "rise" | "none";
  tooltips: false | "all" | "tools";
  eraser: boolean;
  transparent: boolean;
  draggable: boolean;
  /** Empty means "all of them". */
  tools: PenId[];
  controls: {
    color: boolean;
    size: boolean;
    opacity: boolean;
    custom: boolean;
    undo: boolean;
    clear: boolean;
    minimize: boolean;
  };
};

export const defaults: DebugState = {
  placement: "bottom",
  theme: "light",
  depth: "regular",
  settings: "bar",
  align: "center",
  look: "classic",
  gauge: false,
  shortcuts: true,
  ink: "auto",
  chrome: true,
  motion: "rise",
  tooltips: "all",
  eraser: true,
  transparent: false,
  draggable: false,
  tools: [],
  controls: {
    color: true,
    size: true,
    opacity: true,
    custom: true,
    undo: true,
    clear: true,
    minimize: true,
  },
};

const PLACEMENTS = ["bottom", "left", "right"] as const;
const THEMES = ["light", "dark", "auto"] as const;
const DEPTHS = ["flat", "soft", "regular", "strong"] as const;
const SETTINGS = ["bar", "tool"] as const;
const LOOKS = ["classic", "studio"] as const;
const ALIGNS = ["start", "center", "end"] as const;
const INKS: InkMode[] = ["auto", "shared", "per-tool"];
const CONTROLS = [
  "color",
  "size",
  "opacity",
  "custom",
  "undo",
  "clear",
  "minimize",
] as const;

export function Debug({
  value,
  onChange,
  draw,
  shell,
  onShell,
  page,
  pageCount,
  onNewPage,
  onGoPage,
}: {
  value: DebugState;
  onChange: (next: DebugState) => void;
  draw: RefObject<DrawHandle | null>;
  shell: "dark" | "light";
  onShell: (next: "dark" | "light") => void;
  /** Zero-based index of the page being drawn. */
  page: number;
  /** How many pages there are. */
  pageCount: number;
  /** Add a blank page and make it current. */
  onNewPage: () => void;
  /** Switch to an existing page. */
  onGoPage: (index: number) => void;
}) {
  const set = <K extends keyof DebugState>(k: K, v: DebugState[K]) =>
    onChange({ ...value, [k]: v });

  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: MouseEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Toggle = ({
    on,
    onClick,
    disabled,
    children,
  }: {
    on: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      className={css.chip}
      data-active={on || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  const Dropdown = ({
    id,
    label,
    current,
    children,
  }: {
    id: string;
    label: string;
    current?: string;
    children: React.ReactNode;
  }) => (
    <div className={css.dropdown}>
      <button
        type="button"
        className={css.trigger}
        data-active={open === id || undefined}
        aria-expanded={open === id}
        onClick={() => setOpen(open === id ? null : id)}
      >
        {label}
        {current ? <span className={css.current}>{current}</span> : null}
        <ChevronIcon />
      </button>
      {open === id && (
        <div className={css.menu}>
          {Children.map(children, (child, i) =>
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

  return (
    <div className={css.bar} ref={bar}>
      <span className={css.tag}>PencilArt</span>

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

      <div className={css.pager}>
        <button
          type="button"
          className={css.chip}
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onGoPage(page - 1)}
        >
          <ChevronIcon className={css.left} />
        </button>
        <Dropdown
          id="page"
          label="Page"
          current={`${page + 1} / ${pageCount}`}
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <Toggle key={i} on={i === page} onClick={() => onGoPage(i)}>
              {i + 1}
            </Toggle>
          ))}
        </Dropdown>
        <button
          type="button"
          className={css.chip}
          aria-label="Add a new page"
          onClick={onNewPage}
        >
          <AddIcon />
        </button>
        <button
          type="button"
          className={css.chip}
          aria-label="Next page"
          disabled={page >= pageCount - 1}
          onClick={() => onGoPage(page + 1)}
        >
          <ChevronIcon className={css.right} />
        </button>
      </div>

      <Dropdown id="placement" label="Placement" current={value.placement}>
        {PLACEMENTS.map((p) => (
          <Toggle
            key={p}
            on={value.placement === p}
            onClick={() => {
              set("placement", p);
              setOpen(null);
            }}
          >
            {p}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="theme" label="Theme" current={value.theme}>
        {THEMES.map((t) => (
          <Toggle
            key={t}
            on={value.theme === t}
            onClick={() => {
              set("theme", t);
              setOpen(null);
            }}
          >
            {t}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="depth" label="Depth" current={value.depth}>
        {DEPTHS.map((d) => (
          <Toggle
            key={d}
            on={value.depth === d}
            onClick={() => {
              set("depth", d);
              setOpen(null);
            }}
          >
            {d}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="settings" label="Settings" current={value.settings}>
        {SETTINGS.map((v) => (
          <Toggle
            key={v}
            on={value.settings === v}
            onClick={() => {
              set("settings", v);
              setOpen(null);
            }}
          >
            {v}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="align" label="Align" current={value.align}>
        {ALIGNS.map((v) => (
          <Toggle
            key={v}
            on={value.align === v}
            onClick={() => {
              set("align", v);
              setOpen(null);
            }}
          >
            {v}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="look" label="Tools" current={value.look}>
        {LOOKS.map((v) => (
          <Toggle
            key={v}
            on={value.look === v}
            onClick={() => {
              set("look", v);
              setOpen(null);
            }}
          >
            {v}
          </Toggle>
        ))}
        <Toggle on={value.gauge} onClick={() => set("gauge", !value.gauge)}>
          gauge
        </Toggle>
        <Toggle
          on={value.shortcuts}
          onClick={() => set("shortcuts", !value.shortcuts)}
        >
          keys
        </Toggle>
      </Dropdown>

      <Dropdown id="ink" label="Ink" current={value.ink}>
        {INKS.map((m) => (
          <Toggle
            key={m}
            on={value.ink === m}
            onClick={() => {
              set("ink", m);
              setOpen(null);
            }}
          >
            {m}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="controls" label="Controls">
        {CONTROLS.map((c) => (
          <Toggle
            key={c}
            on={value.controls[c]}
            onClick={() =>
              set("controls", { ...value.controls, [c]: !value.controls[c] })
            }
          >
            {c}
          </Toggle>
        ))}
      </Dropdown>

      <Dropdown id="pens" label="Pens">
        {PENS.map((p) => {
          // Empty means every tool, so the first click has to seed the list
          // with everything *except* the one being switched off.
          const on = value.tools.length === 0 || value.tools.includes(p.id);
          return (
            <Toggle
              key={p.id}
              on={on}
              onClick={() => {
                const current = value.tools.length
                  ? value.tools
                  : PENS.map((x) => x.id);
                // Switching one back on puts it at the end, so the chips
                // reorder the tray as well as filtering it — which is what
                // `tools` does, and there was no way to see it before.
                const next = on
                  ? current.filter((id) => id !== p.id)
                  : [...current, p.id];
                set("tools", next);
              }}
            >
              {p.name}
            </Toggle>
          );
        })}
      </Dropdown>

      <Dropdown id="motion" label="Motion" current={value.motion}>
        {(["rise", "none"] as const).map((m) => (
          <Toggle
            key={m}
            on={value.motion === m}
            onClick={() => {
              set("motion", m);
              setOpen(null);
            }}
          >
            {m}
          </Toggle>
        ))}
        {/* Out and back in, so both halves can be watched without having to
            find the toolbar switch and hit it twice. */}
        <Toggle
          on={false}
          onClick={() => {
            set("chrome", false);
            window.setTimeout(() => set("chrome", true), 900);
          }}
        >
          replay
        </Toggle>
        <Toggle on={value.chrome} onClick={() => set("chrome", !value.chrome)}>
          {value.chrome ? "hide" : "show"}
        </Toggle>
      </Dropdown>

      <Dropdown id="also" label="Also">
        {/* `chrome={false}` is the bring-your-own-UI switch: it takes the
            whole toolbar away and leaves the bare surface, for apps driving
            DrawSurface and the hooks with their own controls. */}
        <Toggle on={value.chrome} onClick={() => set("chrome", !value.chrome)}>
          toolbar
        </Toggle>
        <Toggle on={value.eraser} onClick={() => set("eraser", !value.eraser)}>
          eraser
        </Toggle>
        <Toggle
          on={value.tooltips !== false}
          onClick={() =>
            set(
              "tooltips",
              value.tooltips === "all"
                ? "tools"
                : value.tooltips === "tools"
                  ? false
                  : "all",
            )
          }
        >
          tips: {value.tooltips === false ? "off" : value.tooltips}
        </Toggle>
        <Toggle
          on={value.transparent}
          onClick={() => set("transparent", !value.transparent)}
        >
          transparent
        </Toggle>
        <Toggle
          on={value.draggable}
          onClick={() => set("draggable", !value.draggable)}
        >
          draggable
        </Toggle>
      </Dropdown>

      <Dropdown id="export" label="Export">
        <button
          type="button"
          className={css.chip}
          onClick={() => draw.current?.download("drawing", "svg")}
        >
          .svg
        </button>
        <button
          type="button"
          className={css.chip}
          onClick={() => draw.current?.download("drawing", "png", 2)}
        >
          .png @2x
        </button>
        <button
          type="button"
          className={css.chip}
          onClick={() => {
            const svg = draw.current?.toSvg() ?? "";
            // eslint-disable-next-line no-console
            console.log(svg);
            navigator.clipboard?.writeText(svg);
          }}
        >
          copy svg
        </button>
      </Dropdown>
    </div>
  );
}

/** The plus, for the one-click new page button. */
function AddIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/** The chevron on every dropdown trigger; it flips when the menu opens.
    The page-turn arrows are the same chevron, rotated. */
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`${css.chevron} ${className ?? ""}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The icon on the dark shell — a sun, for the light it would switch to. */
function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/** The icon on the light shell — a moon, for the dark it would switch to. */
function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}