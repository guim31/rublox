import type { AssetKind } from '@rublox/schema'

/** What each kind of asset accepts (file picker) and how heavy it may be, in guest mode. */
export const ASSET_ACCEPT: Record<'image' | 'sound' | 'video' | 'lottie', string> = {
  image: 'image/*',
  sound: 'audio/*',
  video: 'video/*',
  lottie: '.json,application/json',
}

const MB = 1024 * 1024
export const ASSET_MAX_BYTES: Record<'image' | 'sound' | 'video' | 'lottie', number> = {
  image: 8 * MB,
  sound: 15 * MB,
  video: 50 * MB,
  lottie: 5 * MB,
}

/** The kind of a file, from its type (a Lottie animation is a JSON file). */
export function assetKindOf(file: File): AssetKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'sound'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) return 'lottie'
  return null
}

/** Asset ids a project uses: any property value (or list item field) equal to an id. */
export function usedAssetIds(
  screens: Record<string, { components: Record<string, { props: Record<string, unknown> }> }>,
  ids: Iterable<string>,
): Set<string> {
  const text = JSON.stringify(Object.values(screens).map((screen) => screen.components))
  return new Set([...ids].filter((id) => text.includes(`"${id}"`)))
}
