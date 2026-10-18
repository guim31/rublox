import type { Locale, ProjectDoc, UiMode } from '@rublox/schema'
import { api, call } from '../lib/api.ts'
import { getAll, STORES } from './db.ts'
import { type ProjectSummary, TRASH_DAYS } from './summaries.ts'
import type { TemplateFile } from './template-files.ts'

/**
 * The project format, the catalog and Yjs are loaded only to change a project: listing them
 * reads the summaries alone, so the dashboard stays within its budget (SPEC § 7).
 */
const guest = () => import('./projects.ts')

/**
 * Where the dashboard's projects live: this browser (guest mode, J0) or the server (signed
 * in, J1). Both give the same summaries, so the dashboard has one code path.
 */
export interface ProjectsBackend {
  kind: 'guest' | 'server'
  list(): Promise<ProjectSummary[]>
  /**
   * A new empty project, or `doc` when given (the demo app, a template), with the files its
   * assets need (the pictures and sounds of a game template).
   */
  create(input: {
    name: string
    locale: Locale
    mode: UiMode
    doc?: ProjectDoc
    files?: TemplateFile[]
  }): Promise<string>
  rename(id: string, name: string): Promise<void>
  duplicate(id: string, name: string): Promise<string>
  setFavorite(id: string, favorite: boolean): Promise<void>
  trash(id: string): Promise<void>
  restore(id: string): Promise<void>
  deleteForever(id: string): Promise<void>
}

export const guestBackend: ProjectsBackend = {
  kind: 'guest',
  list: async () => {
    const all = await getAll<ProjectSummary>(STORES.projects)
    const limit = TRASH_DAYS * 24 * 3600 * 1000
    const expired = all.filter((p) => p.deletedAt && Date.now() - Date.parse(p.deletedAt) > limit)
    if (!expired.length) return all
    await (await guest()).purgeExpired()
    return (await guest()).listProjects()
  },
  create: async (input) => {
    if (input.files?.length) {
      const { storeAssetFile } = await import('./assets.ts')
      for (const { file, kind } of input.files) await storeAssetFile(file, kind)
    }
    return (await guest()).createProject(input)
  },
  rename: async (id, name) => (await guest()).renameProject(id, name),
  duplicate: async (id, name) => (await guest()).duplicateProject(id, name),
  setFavorite: async (id, favorite) => (await guest()).setFavorite(id, favorite),
  trash: async (id) => (await guest()).moveToTrash(id),
  restore: async (id) => (await guest()).restoreFromTrash(id),
  deleteForever: async (id) => (await guest()).deleteForever(id),
}

const project = api.projects[':projectId']

export const serverBackend: ProjectsBackend = {
  kind: 'server',
  list: async () => {
    const { projects } = await call(api.projects.$get())
    return projects.map((p) => ({
      ...p,
      preview: p.preview as ProjectSummary['preview'],
    }))
  },
  create: async (input) => {
    const { newProjectState } = await import('./new-state.ts')
    const { id } = await call(api.projects.$post({ json: { state: newProjectState(input) } }))
    if (input.files?.length) {
      const { uploadAsset } = await import('./server-assets.ts')
      try {
        for (const { file } of input.files) await uploadAsset(id, file)
      } catch (error) {
        await call(project.$delete({ param: { projectId: id } })).catch(() => {})
        throw error
      }
    }
    return id
  },
  rename: async (id, name) => {
    await call(project.$patch({ param: { projectId: id }, json: { name } }))
  },
  duplicate: async (id, name) => {
    const result = await call(project.duplicate.$post({ param: { projectId: id }, json: { name } }))
    return result.id
  },
  setFavorite: async (id, favorite) => {
    await call(project.$patch({ param: { projectId: id }, json: { favorite } }))
  },
  trash: async (id) => {
    await call(project.trash.$post({ param: { projectId: id } }))
  },
  restore: async (id) => {
    await call(project.restore.$post({ param: { projectId: id } }))
  },
  deleteForever: async (id) => {
    await call(project.$delete({ param: { projectId: id } }))
  },
}
