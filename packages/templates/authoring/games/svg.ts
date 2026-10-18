/**
 * Drawing helpers for the pictures of the game templates (J10): small SVG files drawn here
 * for Rublox, in one cartoon style (a dark outline, flat colours, a light shine). Nothing is
 * taken from elsewhere (CLAUDE.md).
 */

/** The outline of every drawing. */
export const INK = '#2d1f3d'

/** An SVG file of `width × height`, with `defs` (gradients) and its content. */
export function svg(width: number, height: number, body: string, defs = ''): string {
  const inner = defs ? `<defs>${defs}</defs>${body}` : body
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${inner}</svg>\n`
}

/** A vertical gradient from `top` to `bottom`. */
export function vgradient(id: string, stops: [number, string][]): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('')}</linearGradient>`
}

/** A radial gradient, lighter in the middle. */
export function rgradient(id: string, stops: [number, string][], cx = 0.4, cy = 0.35): string {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.75">${stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('')}</radialGradient>`
}

/** Outline attributes. */
export const ink = (width = 3) =>
  `stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`

/** A five-pointed star centred on (x, y). */
export function starPath(x: number, y: number, outer: number, inner: number, points = 5): string {
  const parts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / points - Math.PI / 2
    parts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`)
  }
  return `M${parts.join('L')}Z`
}

/** A rounded button, as wide as given, in a colour (the label is a scene text above it). */
export function button(width: number, height: number, color: string, dark: string): string {
  const r = height / 2
  return svg(
    width,
    height,
    `<rect x="3" y="7" width="${width - 6}" height="${height - 10}" rx="${r - 4}" fill="${dark}"/>` +
      `<rect x="3" y="3" width="${width - 6}" height="${height - 12}" rx="${r - 4}" fill="url(#b)" ${ink(3)}/>` +
      `<rect x="${r}" y="9" width="${width - 2 * r}" height="${(height - 12) / 4}" rx="${height / 10}" fill="#fff" opacity="0.35"/>`,
    vgradient('b', [
      [0, color],
      [1, dark],
    ]),
  )
}

/** A panel for the end of a game: a rounded card with a border. */
export function panel(width: number, height: number, fill: string, border: string): string {
  return svg(
    width,
    height,
    `<rect x="4" y="10" width="${width - 8}" height="${height - 14}" rx="28" fill="${INK}" opacity="0.35"/>` +
      `<rect x="4" y="4" width="${width - 8}" height="${height - 14}" rx="28" fill="${fill}" stroke="${border}" stroke-width="8"/>` +
      `<rect x="4" y="4" width="${width - 8}" height="${height - 14}" rx="28" fill="none" ${ink(3)}/>`,
  )
}

/** A heart (lives). */
export function heart(size = 48): string {
  return svg(
    size,
    size,
    `<path transform="scale(${size / 48})" d="M24 42 C10 32 4 24 4 16 C4 9 9 5 15 5 C19 5 22 7 24 11 C26 7 29 5 33 5 C39 5 44 9 44 16 C44 24 38 32 24 42 Z" fill="url(#h)" ${ink(3)}/>` +
      `<ellipse transform="scale(${size / 48})" cx="14" cy="14" rx="5" ry="3.5" fill="#fff" opacity="0.6"/>`,
    rgradient('h', [
      [0, '#ff8aa0'],
      [1, '#e8344f'],
    ]),
  )
}

/** A coin, seen from the front (`squash` 1) or turning (`squash` < 1). */
export function coin(squash = 1, size = 40): string {
  const rx = (size / 2 - 3) * squash
  const c = size / 2
  return svg(
    size,
    size,
    `<ellipse cx="${c}" cy="${c}" rx="${Math.max(2, rx)}" ry="${c - 3}" fill="url(#c)" ${ink(3)}/>` +
      (squash > 0.5
        ? `<ellipse cx="${c}" cy="${c}" rx="${Math.max(1, rx * 0.6)}" ry="${(c - 3) * 0.6}" fill="none" stroke="#c98a12" stroke-width="2.5"/>` +
          `<path d="M${c - rx * 0.45} ${c - 7} q${rx * 0.3} -5 ${rx * 0.5} 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>`
        : ''),
    rgradient('c', [
      [0, '#fff3a6'],
      [0.6, '#ffd23f'],
      [1, '#f0a81c'],
    ]),
  )
}

/**
 * Places a whole drawing inside another (a cover made of the game's pictures): its ids are
 * prefixed so that two copies do not share their gradients.
 */
export function embed(
  file: string,
  x: number,
  y: number,
  width: number,
  height: number,
  prefix: string,
  attributes = '',
): string {
  const open = /<svg[^>]*viewBox="([^"]+)"[^>]*>/.exec(file)
  const viewBox = open?.[1] ?? `0 0 ${width} ${height}`
  const inner = file
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" overflow="visible" ${attributes}>${inner}</svg>`
}

/** A wavy line across `width` that ends where it starts, for tiles that repeat seamlessly. */
export function wave(
  width: number,
  base: number,
  parts: [amplitude: number, waves: number, phase: number][],
  bottom: number,
): string {
  const points: string[] = []
  for (let x = 0; x <= width; x += 6) {
    const y = parts.reduce(
      (sum, [amplitude, waves, phase]) =>
        sum + amplitude * Math.sin((2 * Math.PI * waves * x) / width + phase),
      base,
    )
    points.push(`${x},${y.toFixed(1)}`)
  }
  if (!points.at(-1)?.startsWith(`${width},`)) {
    const y = parts.reduce(
      (sum, [amplitude, waves, phase]) => sum + amplitude * Math.sin(2 * Math.PI * waves + phase),
      base,
    )
    points.push(`${width},${y.toFixed(1)}`)
  }
  return `M0,${bottom} L${points.join(' L')} L${width},${bottom} Z`
}

/** The style of a cover: its animations, stopped for whoever asks for less motion. */
export function coverStyle(css: string): string {
  return `<style>${css} @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }</style>`
}

/** A drawing as a symbol, drawn as many times as needed with `use` (a cover stays small). */
export function symbol(file: string, id: string): string {
  const viewBox = /<svg[^>]*viewBox="([^"]+)"/.exec(file)?.[1] ?? '0 0 100 100'
  const inner = file
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/id="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
  return `<symbol id="${id}" viewBox="${viewBox}" overflow="visible">${inner}</symbol>`
}

export function use(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  attributes = '',
): string {
  return `<use href="#${id}" x="${x}" y="${y}" width="${width}" height="${height}" ${attributes}/>`
}
