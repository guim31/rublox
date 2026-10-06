import { hasProject, yDocToProject } from '@rublox/schema'
import * as Y from 'yjs'
import { api, call } from '../lib/api.ts'
import { toBase64 } from '../lib/base64.ts'
import { loadAssetFile } from './assets.ts'
import * as guest from './projects.ts'
import { uploadAsset } from './server-assets.ts'

/** The guest projects of this browser that may move into the account (not those in the trash). */
export async function guestProjectsToImport() {
  return (await guest.listProjects()).filter((project) => !project.deletedAt)
}

/**
 * Moves the guest projects into the signed-in account (SPEC § 4.8): document, favourite and
 * images. A project leaves this browser only once everything reached the server; on any
 * failure, the server copy is removed and the local one stays.
 */
export async function importGuestProjects(
  onProgress: (done: number, total: number) => void,
): Promise<{ imported: number; failed: string[] }> {
  const projects = await guestProjectsToImport()
  const failed: string[] = []
  let imported = 0
  onProgress(0, projects.length)
  for (const [index, summary] of projects.entries()) {
    const { ydoc, persistence } = await guest.openProjectDoc(summary.id)
    let serverId: string | null = null
    try {
      if (!hasProject(ydoc)) throw new Error('empty project')
      const doc = yDocToProject(ydoc)
      const state = toBase64(Y.encodeStateAsUpdate(ydoc))
      serverId = (
        await call(
          api.projects.$post({ json: { state, import: true, favorite: summary.favorite } }),
        )
      ).id
      for (const asset of Object.values(doc.assets)) {
        const blob = await loadAssetFile(asset.sha256)
        if (!blob) continue
        await uploadAsset(serverId, new File([blob], asset.name, { type: asset.mime }))
      }
      await persistence.destroy()
      ydoc.destroy()
      await guest.deleteForever(summary.id)
      imported += 1
    } catch {
      failed.push(summary.name)
      await persistence.destroy()
      ydoc.destroy()
      if (serverId) {
        await call(api.projects[':projectId'].$delete({ param: { projectId: serverId } })).catch(
          () => {},
        )
      }
    }
    onProgress(index + 1, projects.length)
  }
  return { imported, failed }
}
