import { bouncingDemo, catchGameDemo } from '@rublox/catalog'
import { type Locale, projectToYDoc } from '@rublox/schema'
import * as Y from 'yjs'
import { api, call } from '../lib/api.ts'
import { toBase64 } from '../lib/base64.ts'
import { addProject } from './projects.ts'

/**
 * Creates a demo of the game mode (J7) as a new project: on the server when signed in,
 * in this browser otherwise. Returns its id.
 */
export const DEMOS = { catchGame: catchGameDemo, bouncing: bouncingDemo } as const
export type DemoName = keyof typeof DEMOS

export async function createDemo(
  name: DemoName,
  locale: Locale,
  signedIn: boolean,
): Promise<string> {
  const doc = DEMOS[name](locale)
  if (!signedIn) return addProject(doc)
  const state = toBase64(Y.encodeStateAsUpdate(projectToYDoc(doc)))
  const { id } = await call(api.projects.$post({ json: { state } }))
  return id
}
