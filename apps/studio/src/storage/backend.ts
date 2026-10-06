import { createProject as newProjectDoc } from '@rublox/catalog'
import { type Locale, projectToYDoc, type UiMode } from '@rublox/schema'
import * as Y from 'yjs'
import { api, call } from '../lib/api.ts'
import { toBase64 } from '../lib/base64.ts'
import type { ProjectSummary } from './projects.ts'
import * as guest from './projects.ts'

/**
 * Where the dashboard's projects live: this browser (guest mode, J0) or the server (signed
 * in, J1). Both give the same summaries, so the dashboard has one code path.
 */
export interface ProjectsBackend {
  kind: 'guest' | 'server'
  list(): Promise<ProjectSummary[]>
  create(input: { name: string; locale: Locale; mode: UiMode }): Promise<string>
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
    await guest.purgeExpired()
    return guest.listProjects()
  },
  create: guest.createProject,
  rename: guest.renameProject,
  duplicate: guest.duplicateProject,
  setFavorite: guest.setFavorite,
  trash: guest.moveToTrash,
  restore: guest.restoreFromTrash,
  deleteForever: guest.deleteForever,
}

const project = api.projects[':projectId']

/** The Yjs state of a new project, built by the studio (the server validates it). */
export function newProjectState(input: { name: string; locale: Locale; mode: UiMode }): string {
  return toBase64(Y.encodeStateAsUpdate(projectToYDoc(newProjectDoc(input))))
}

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
    const { id } = await call(api.projects.$post({ json: { state: newProjectState(input) } }))
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
