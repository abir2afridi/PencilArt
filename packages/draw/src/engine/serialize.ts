import {
  dashArray,
  dotRadius,
  eraseLayers,
  figureMarkup,
  lineHeight,
  polylinePath,
  strokePath,
} from "./geometry";
import { PEN_BY_ID } from "./pens";
import type { Box, FigureFill, Stroke } from "./types";

/** Escape a value destined for an XML attribute. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The text of one mark, with its rotation applied. */
function rotated(group: string, stroke: Stroke): string {
  if (!stroke.rotate) return group;
  const [cx, cy] = textCentre(stroke);
  return `<g transform="rotate(${stroke.rotate} ${cx} ${cy})">${group}</g>`;
}

function textCentre(stroke: Stroke): [number, number] {
  let x: number;
  let y: number;
  let w: number;
  let h: number;
  if (stroke.figure) {
    x = stroke.figure.x;
    y = stroke.figure.y;
    w = stroke.figure.w;
    h = stroke.figure.h;
  } else if (stroke.image) {
    x = stroke.points[0]?.[0] ?? 0;
    y = stroke.points[0]?.[1] ?? 0;
    w = stroke.image.w;
    h = stroke.image.h;
  } else if (stroke.text) {
    x = stroke.points[0]?.[0] ?? 0;
    y = stroke.points[0]?.[1] ?? 0;
    w = stroke.text.w;
    h = stroke.text.h;
  } else {
    x = y = 0;
    w = h = 0;
  }
  return [x + w / 2, y + h / 2];
}

/** A committed image, embedded as its data URL. */
function imageMarkup(stroke: Stroke): string {
  const [x, y] = stroke.points[0] ?? [0, 0];
  return rotated(
    `<g opacity="${stroke.opacity}"><image x="${x}" y="${y}" width="${stroke.image?.w}"` +
      ` height="${stroke.image?.h}" href="${esc(stroke.image?.data ?? "")}"` +
      ` preserveAspectRatio="none"/></g>`,
    stroke,
  );
}

/** A text mark, one line per tspan. */
function textMarkup(stroke: Stroke): string {
  const t = stroke.text;
  if (!t) return "";
  const [x, y] = stroke.points[0] ?? [0, 0];
  const lineH = lineHeight(t.size);
  const lines = t.content.split("\n");
  const tx =
    t.align === "center" ? x + t.w / 2 : t.align === "right" ? x + t.w : x;
  const anchor =
    t.align === "center" ? "middle" : t.align === "right" ? "end" : "start";
  const common =
    `x="${tx}" text-anchor="${anchor}" font-family="${esc(t.font)}" font-size="${t.size}"` +
    ` fill="${esc(stroke.color)}"` +
    (t.bold ? ` font-weight="700"` : "") +
    (t.italic ? ` font-style="italic"` : "");
  const body = lines
    .map(
      (line, i) =>
        `<tspan${i === 0 ? "" : ` dy="${lineH}"`} x="${tx}">${esc(line)}</tspan>`,
    )
    .join("");
  const wash = t.background
    ? `<rect x="${x}" y="${y}" width="${t.w}" height="${t.h}"` +
      ` rx="${Math.min(4, t.size / 4)}" fill="${esc(t.background)}"/>`
    : "";
  return rotated(
    `<g opacity="${stroke.opacity}">${wash}<text ${common} y="${y + t.size * 0.85}">${body}</text></g>`,
    stroke,
  );
}

/** A frame renders as a light blue wash with a dashed edge and its name in
    the top-left corner — a container, not an outline. */
function frameMarkup(stroke: Stroke): string {
  const f = stroke.figure;
  if (!f) return "";
  const name = f.frameName ? esc(f.frameName) : "";
  const { d } = figureMarkup(f, stroke.size);
  return rotated(
    `<g opacity="${stroke.opacity}">` +
      `<path d="${d}" fill="rgba(80,140,255,0.08)" stroke="rgba(80,140,255,0.6)"` +
      ` stroke-width="${Math.max(1, stroke.size)}" stroke-dasharray="6 5"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>` +
      (name
        ? `<text x="${f.x + 6}" y="${f.y + 14}" font-family="${esc(
            "ui-sans-serif, system-ui, sans-serif",
          )}" font-size="12" font-weight="600" fill="#5a8dff">${name}</text>`
        : "") +
      `</g>`,
    stroke,
  );
}

/**
 * The visible mark for one stroke — a filled outline, or a circle when the
 * stroke was too short to produce one (a tap).
 */
function strokeMarkup(stroke: Stroke): string {
  if (stroke.figure?.kind === "frame") return frameMarkup(stroke);
  // A geometric figure is drawn stroked, like an outline on paper, with the
  // arrow's head filled in solid.
  if (stroke.figure) {
    const { d, head } = figureMarkup(stroke.figure, stroke.size);
    const dash = dashArray(stroke.figure.dash);
    const raw = stroke.figure.fill as FigureFill | boolean | undefined;
    const fill = raw === true ? "solid" : raw;
    /** The fill's own colour, or the stroke colour when it has none. */
    const ink = stroke.figure.fillColor ?? stroke.color;
    const hatch = (angle: number, id: string) =>
      `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"` +
      ` patternTransform="rotate(${angle})">` +
      `<line x1="0" y1="0" x2="0" y2="8" stroke="${esc(ink)}"` +
      ` stroke-opacity="0.25" stroke-width="1.2"/></pattern>`;
    const fillBody =
      fill && d.endsWith("Z")
        ? fill === "solid"
          ? `<path d="${d}" fill="${esc(ink)}" fill-opacity="${stroke.opacity}"/>`
          : `<defs>${hatch(45, `h-${stroke.id}`)}${
              fill === "cross-hatch" ? hatch(-45, `x-${stroke.id}`) : ""
            }</defs>` +
            `<path d="${d}" fill="url(#h-${stroke.id})"/>` +
            (fill === "cross-hatch" ? `<path d="${d}" fill="url(#x-${stroke.id})"/>` : "")
        : "";
    const body =
      fillBody +
      `<path d="${d}" stroke="${esc(stroke.color)}" stroke-width="${stroke.size}"` +
      ` fill="none" stroke-linecap="round" stroke-linejoin="round"` +
      (dash ? ` stroke-dasharray="${dash}"` : "") +
      `/>` +
      (head ? `<path d="${head}" fill="${esc(stroke.color)}"/>` : "");
    return rotated(`<g opacity="${stroke.opacity}">${body}</g>`, stroke);
  }

  if (stroke.image) return imageMarkup(stroke);
  if (stroke.text) return textMarkup(stroke);

  const style =
    PEN_BY_ID[stroke.pen].blend === "multiply"
      ? ` style="mix-blend-mode:multiply"`
      : "";
  const paint = `fill="${esc(stroke.color)}" fill-opacity="${stroke.opacity}"${style}`;

  const d = strokePath(
    stroke.pen,
    stroke.size,
    stroke.points,
    true,
    stroke.shape,
  );
  if (d) return rotated(`<path d="${d}" ${paint}/>`, stroke);

  if (stroke.points.length) {
    const [x, y] = stroke.points[0];
    return rotated(
      `<circle cx="${x}" cy="${y}" r="${dotRadius(stroke.size)}" ${paint}/>`,
      stroke,
    );
  }
  return "";
}

function backgroundMarkup(
  background: string | null,
  width: number,
  height: number,
): string {
  if (!background || background === "transparent") return "";
  return `<rect width="${width}" height="${height}" fill="${esc(background)}"/>`;
}

/**
 * Serialize a drawing into a standalone, static SVG string. A `bounds` crops
 * the export to a region of the board, sized to fit it.
 */
export function toSvg(
  strokes: Stroke[],
  width: number,
  height: number,
  background: string | null,
  bounds?: Box,
): string {
  const layers = eraseLayers(strokes);
  const crop = bounds
    ? { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }
    : { x: 0, y: 0, w: width, h: height };

  const body = layers
    .map((layer, i) => {
      const ink = layer.ink
        .map((n) => strokeMarkup(strokes[n]))
        .filter(Boolean)
        .join("");
      if (!ink) return "";
      if (!layer.erasers.length) return ink;

      const id = `e${i}`;
      const cuts = layer.erasers
        .map((n) => {
          const s = strokes[n];
          return (
            `<path d="${polylinePath(s.points)}" stroke="#000" stroke-width="${s.size}"` +
            ` stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
          );
        })
        .join("");

      return (
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="${crop.x}" y="${crop.y}"` +
        ` width="${crop.w}" height="${crop.h}">` +
        `<rect x="${crop.x}" y="${crop.y}" width="${crop.w}" height="${crop.h}" fill="#fff"/>` +
        `${cuts}</mask>` +
        `<g mask="url(#${id})">${ink}</g>`
      );
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(crop.w))}"` +
    ` height="${Math.max(1, Math.round(crop.h))}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}">` +
    backgroundMarkup(background, crop.w, crop.h) +
    `<g transform="translate(${-crop.x} ${-crop.y})">${body}</g>` +
    `</svg>`
  );
}

/** Rasterise a drawing to a PNG blob. */
export async function toPng(
  strokes: Stroke[],
  width: number,
  height: number,
  background: string | null,
  scale = 2,
  bounds?: Box,
): Promise<Blob> {
  const svg = toSvg(strokes, width, height, background, bounds);
  // Encoded rather than base64'd so the markup survives any non-ASCII in it.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const img = new Image();
  // The data URL is same-origin, but marking it keeps the canvas untainted on
  // the strictest engines, so toBlob can't fail with a security error.
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterise the drawing"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((bounds?.w ?? width) * scale));
  canvas.height = Math.max(1, Math.round((bounds?.h ?? height) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D context");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the PNG")),
      "image/png",
    );
  });
}