/** All the small line icons, shared across the header components. */
type IconProps = { className?: string };

/** The chevron on dropdown triggers; the page arrows are it, rotated. */
export function ChevronIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
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

/** A sun, shown on the dark shell — the light it would switch to. */
export function SunIcon() {
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

/** A moon, shown on the light shell — the dark it would switch to. */
export function MoonIcon() {
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

/** The undo arrow, for stepping back over a gesture. */
export function UndoIcon() {
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
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

/** The redo arrow, mirrored. */
export function RedoIcon() {
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
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  );
}

/** The bin, for turning a page away for good. */
export function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** The plus, for the one-click new page button. */
export function AddIcon() {
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

/** The hamburger, for opening the drawer on small screens. */
export function MenuIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

/** The cross, for closing the drawer. */
export function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

/** The glyph each sidebar control sits on when the rail is collapsed. */
export type CtrlIconId =
  | "placement"
  | "theme"
  | "depth"
  | "settings"
  | "align"
  | "look"
  | "ink"
  | "controls"
  | "pens"
  | "motion"
  | "also"
  | "export"
  | "arrange"
  | "style"
  | "text"
  | "images"
  | "import"
  | "library";

const CTRL_ICON_PATHS: Record<CtrlIconId, React.ReactNode> = {
  placement: (
    <>
      <path d="M5 9l-3 3 3 3" />
      <path d="M9 5l3-3 3 3" />
      <path d="M19 9l3 3-3 3" />
      <path d="M9 19l3 3 3-3" />
    </>
  ),
  theme: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18Z" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </>
  ),
  depth: (
    <>
      <path d="m12 2 10 6-10 6L2 8l10-6Z" />
      <path d="M2 16l10 6 10-6" />
    </>
  ),
  settings: (
    <>
      <path d="M21 4H3" />
      <path d="M21 12H3" />
      <path d="M21 20H3" />
      <circle cx="9" cy="4" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="9" cy="20" r="2" />
    </>
  ),
  align: (
    <>
      <path d="M4 6h14" />
      <path d="M4 12h18" />
      <path d="M4 18h10" />
    </>
  ),
  look: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ink: <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" />,
  controls: (
    <>
      <path d="M8 5h8a7 7 0 0 1 0 14H8A7 7 0 0 1 8 5Z" />
      <circle cx="8" cy="12" r="2.5" />
    </>
  ),
  pens: <path d="M17 3l4 4L8 20l-5 1 1-5L17 3Z" />,
  motion: <path d="M7 4l13 8-13 8V4Z" />,
  also: (
    <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" />
  ),
  export: (
    <>
      <path d="M12 4v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  arrange: (
    <>
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <rect x="11" y="11" width="10" height="10" rx="1" />
    </>
  ),
  style: (
    <>
      <path d="M4 7h8" />
      <path d="M16 7h4" />
      <circle cx="14" cy="7" r="2" />
      <path d="M4 17h3" />
      <path d="M11 17h9" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  text: (
    <>
      <path d="M5 5h14" />
      <path d="M12 5v14" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
    </>
  ),
  import: (
    <>
      <path d="M12 4v11" />
      <path d="m7 12 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="4" width="12" height="16" rx="2" />
      <path d="M7 4v16" />
      <path d="M17 7h4" />
      <path d="M17 12h4" />
      <path d="M17 17h4" />
    </>
  ),
};

/** The glyph for one sidebar control, drawn in the current ink. */
export function CtrlIcon({ id }: { id: CtrlIconId }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CTRL_ICON_PATHS[id]}
    </svg>
  );
}