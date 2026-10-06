import type { Asset, AssetKind } from '@rublox/schema'
import { get, put, STORES } from './db.ts'

/** Files of the guest's assets, stored once by content hash (SPEC § 4.1, J0: local only). */
export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function storeAssetFile(file: File, kind: AssetKind): Promise<Asset> {
  const hash = await sha256(file)
  await put(STORES.assets, file, hash)
  return {
    name: file.name,
    kind,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    sha256: hash,
  }
}

export async function loadAssetFile(hash: string): Promise<Blob | undefined> {
  return get<Blob>(STORES.assets, hash)
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
