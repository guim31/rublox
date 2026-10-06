/** Asset kinds of the project format (`ASSET_KINDS` in `@rublox/schema`). */
export type SniffedKind = 'image' | 'sound' | 'video' | 'font' | 'lottie'

export interface Sniffed {
  mime: string
  kind: SniffedKind
}

const ascii = (bytes: Uint8Array, start: number, text: string) => {
  for (let i = 0; i < text.length; i++) if (bytes[start + i] !== text.charCodeAt(i)) return false
  return true
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte)

/**
 * The type of an uploaded file, read from its content and never from its name or the declared
 * type (SPEC § 6.9). Returns null for anything that is not a supported image, sound, video,
 * font or Lottie animation.
 */
export function sniff(bytes: Uint8Array): Sniffed | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', kind: 'image' }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', kind: 'image' }
  if (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a'))
    return { mime: 'image/gif', kind: 'image' }
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP'))
    return { mime: 'image/webp', kind: 'image' }
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE'))
    return { mime: 'audio/wav', kind: 'sound' }
  if (ascii(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.slice(8, 12))
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', kind: 'image' }
    if (brand.startsWith('M4A')) return { mime: 'audio/mp4', kind: 'sound' }
    return { mime: 'video/mp4', kind: 'video' }
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', kind: 'video' }
  if (ascii(bytes, 0, 'OggS')) return { mime: 'audio/ogg', kind: 'sound' }
  if (ascii(bytes, 0, 'ID3')) return { mime: 'audio/mpeg', kind: 'sound' }
  // MPEG audio frame sync: 11 bits set, layer III.
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe6) === 0xe2)
    return { mime: 'audio/mpeg', kind: 'sound' }
  if (ascii(bytes, 0, 'wOFF')) return { mime: 'font/woff', kind: 'font' }
  if (ascii(bytes, 0, 'wOF2')) return { mime: 'font/woff2', kind: 'font' }
  if (ascii(bytes, 0, 'OTTO')) return { mime: 'font/otf', kind: 'font' }
  if (startsWith(bytes, [0x00, 0x01, 0x00, 0x00]) || ascii(bytes, 0, 'true'))
    return { mime: 'font/ttf', kind: 'font' }
  // dotLottie is a zip archive with a manifest.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(bytes, 'manifest.json'))
    return { mime: 'application/zip', kind: 'lottie' }
  return sniffText(bytes)
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(text, 0, 'latin1')
}

function sniffText(bytes: Uint8Array): Sniffed | null {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return null
  }
  const start = text.trimStart()
  if (start.startsWith('{')) {
    try {
      const json = JSON.parse(start) as Record<string, unknown>
      if (typeof json.v === 'string' && Array.isArray(json.layers))
        return { mime: 'application/json', kind: 'lottie' }
    } catch {
      return null
    }
    return null
  }
  // SVG: optional XML declaration, comments and doctype, then the <svg> element.
  const body = start
    .replace(/^<\?xml[\s\S]*?\?>/, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .replace(/^\s*<!DOCTYPE[^>]*>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .trimStart()
  if (/^<svg[\s>]/i.test(body)) return { mime: 'image/svg+xml', kind: 'image' }
  return null
}
