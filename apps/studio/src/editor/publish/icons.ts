import { APP_ICON_FILES, type AppIconKey, type AppSettings } from '@rublox/schema'

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

/** Emojis offered first in the icon picker. */
export const ICON_EMOJIS = [
  '🎲',
  '🚀',
  '⭐',
  '🎵',
  '🎮',
  '📚',
  '🧮',
  '🌈',
  '🐱',
  '🐶',
  '🦄',
  '⚽',
  '🍕',
  '🌍',
  '❤️',
  '⏱️',
]

/** Background colours offered for an emoji icon (Rublox palette). */
export const ICON_COLORS = ['#5b4bff', '#ff7e6f', '#ffd84d', '#3ddc97', '#1c1a2b', '#ffffff']

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    // The decoded image stays usable.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'),
  )
}

/**
 * Draws one icon. `inset` keeps the drawing inside the safe zone of maskable icons, which the
 * phone may cut to a circle (SPEC § 4.6: icons generated for each version).
 */
function draw(
  size: number,
  settings: Pick<AppSettings, 'icon' | 'backgroundColor'>,
  image: HTMLImageElement | null,
  maskable: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return canvas
  const { icon } = settings
  if (icon.kind === 'emoji' || !image) {
    context.fillStyle = icon.kind === 'emoji' ? icon.background : settings.backgroundColor
    context.fillRect(0, 0, size, size)
    const glyph = icon.kind === 'emoji' ? icon.emoji : '📱'
    const fontSize = size * (maskable ? 0.46 : 0.6)
    context.font = `${fontSize}px ${EMOJI_FONT}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    // Emoji glyphs sit a little high on their baseline.
    context.fillText(glyph, size / 2, size / 2 + fontSize * 0.06)
    return canvas
  }
  // An image: cover the square; for maskable icons, keep it within the safe zone.
  context.fillStyle = settings.backgroundColor
  context.fillRect(0, 0, size, size)
  const box = maskable ? size * 0.76 : size
  const offset = (size - box) / 2
  const scale = Math.max(box / image.naturalWidth, box / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  context.save()
  context.beginPath()
  context.rect(offset, offset, box, box)
  context.clip()
  context.drawImage(image, offset + (box - width) / 2, offset + (box - height) / 2, width, height)
  context.restore()
  return canvas
}

/** The PNG icons of a version: 192, 512, maskable 512 and Apple 180 pixels. */
export async function drawIcons(
  settings: Pick<AppSettings, 'icon' | 'backgroundColor'>,
  imageFile?: Blob,
): Promise<Record<AppIconKey, Blob>> {
  const image = settings.icon.kind === 'asset' && imageFile ? await loadImage(imageFile) : null
  const result = {} as Record<AppIconKey, Blob>
  for (const { key, size } of Object.values(APP_ICON_FILES)) {
    result[key] = await canvasToPng(draw(size, settings, image, key === 'maskable'))
  }
  return result
}
