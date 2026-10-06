import type { Asset } from '@rublox/schema'
import { api, call } from '../lib/api.ts'
import { appsOrigin } from '../lib/config.ts'

/** Sends a file to a server project; the server checks its type on the content (SPEC § 6.9). */
export async function uploadAsset(projectId: string, file: File): Promise<Asset> {
  return call(api.projects[':projectId'].assets.$post({ param: { projectId }, form: { file } }))
}

/** An uploaded file, read from the apps origin (`/assets/<sha256>`, immutable). */
export async function downloadAsset(hash: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(`${appsOrigin}/assets/${hash}`, { mode: 'cors' })
    return response.ok ? await response.blob() : undefined
  } catch {
    return undefined
  }
}
