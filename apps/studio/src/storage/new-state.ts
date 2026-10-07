import { createProject as newProjectDoc } from '@rublox/catalog'
import { type Locale, type ProjectDoc, projectToYDoc, type UiMode } from '@rublox/schema'
import * as Y from 'yjs'
import { toBase64 } from '../lib/base64.ts'

/** The Yjs state of a new project, built by the studio (the server validates it). */
export function newProjectState(input: {
  name: string
  locale: Locale
  mode: UiMode
  doc?: ProjectDoc
}): string {
  return toBase64(Y.encodeStateAsUpdate(projectToYDoc(input.doc ?? newProjectDoc(input))))
}
