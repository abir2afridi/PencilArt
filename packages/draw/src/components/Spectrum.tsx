import { useRef } from "react";
import css from "./Toolbar.module.css";

/** Clamp a ratio to the 0..1 a gradient can hold. */
const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** `#rrggbb` → hue (0-360), saturation (0-1), value (0-1). */
function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max / 255;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

/** Hue (0-360), saturation (0-1), value (0-1) → `#rrggbb`. */
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = v - c;
  let r: number, g: number, b: number;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * The picker itself: a saturation/value field with a hue strip beside it.
 *
 * Dragging anywhere on either keeps working past the edges, because the
 * gesture's pointer is captured by the element it started on.
 */
export function Spectrum({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const [h, s, v] = hexToHsv(color);
  const picking = useRef(false);
  const hue = `hsl(${h} 100% 50%)`;

  const square = (e: React.PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width);
    const y = clamp((e.clientY - r.top) / r.height);
    onChange(hsvToHex(h, x, 1 - y));
  };
  const strip = (e: React.PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = clamp((e.clientY - r.top) / r.height);
    onChange(hsvToHex(y * 360, s, v));
  };
  const begin = (e: React.PointerEvent<HTMLSpanElement>, update: (e: React.PointerEvent<HTMLSpanElement>) => void) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    picking.current = true;
    update(e);
  };
  const end = (e: React.PointerEvent<HTMLSpanElement>) => {
    picking.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <span className={css.spectrum}>
      {/* Saturation across, value up: white at the top-left corner fading
          through the hue to black along the bottom edge. */}
      <span
        className={css.field}
        role="slider"
        aria-label="Saturation and value"
        aria-valuetext={`${color} — ${Math.round(s * 100)}% saturated, ${Math.round(v * 100)}% bright`}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})`,
        }}
        onPointerDown={(e) => begin(e, square)}
        onPointerMove={(e) => picking.current && square(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span
          className={css.fieldDot}
          style={{
            left: `${s * 100}%`,
            top: `${(1 - v) * 100}%`,
            borderColor: v > 0.5 ? "#111" : "#fff",
          }}
        />
      </span>
      {/* The full wheel in a strip, red at both ends. */}
      <span
        className={css.hue}
        role="slider"
        aria-label="Hue"
        aria-valuetext={`${Math.round(h)}°`}
        style={{
          background:
            "linear-gradient(to top, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onPointerDown={(e) => begin(e, strip)}
        onPointerMove={(e) => picking.current && strip(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className={css.hueDot} style={{ top: `${(h / 360) * 100}%` }} />
      </span>
    </span>
  );
}