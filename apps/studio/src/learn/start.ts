import { buildStarter, type Challenge, type Tutorial } from '@rublox/learn'
import { type ProjectDoc, projectToYDoc } from '@rublox/schema'
import * as Y from 'yjs'
import { api, call } from '../lib/api.ts'
import { toBase64 } from '../lib/base64.ts'
import { usePrefs } from '../lib/prefs.ts'
import { queryClient } from '../lib/query.ts'
import { fetchMe, ME_KEY } from '../lib/session.ts'
import { importProjectDoc } from '../storage/projects.ts'
import { saveChallenge, saveTutorial, useLearn } from './store.ts'

/** Saves a new project where the learner's projects live: the account, or this browser. */
export async function storeProject(doc: ProjectDoc): Promise<string> {
  const me = await queryClient.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe }).catch(() => null)
  if (me?.user) {
    const state = toBase64(Y.encodeStateAsUpdate(projectToYDoc(doc)))
    const { id } = await call(api.projects.$post({ json: { state } }))
    return id
  }
  return importProjectDoc(doc)
}

function newDoc(item: Tutorial | Challenge, title: string): ProjectDoc {
  const { locale } = usePrefs.getState()
  return buildStarter({ name: title, locale, mode: item.mode, spec: item.starter })
}

/**
 * Starts a tutorial in a new project, in the tutorial's mode (a Junior tutorial switches the
 * interface to Junior). Returns the project to open.
 */
export async function startTutorial(tutorial: Tutorial): Promise<string> {
  const prefs = usePrefs.getState()
  const title = tutorial.texts[prefs.locale].title
  const projectId = await storeProject(newDoc(tutorial, title))
  if (prefs.mode !== tutorial.mode) prefs.setMode(tutorial.mode)
  await saveTutorial({
    id: tutorial.id,
    projectId,
    step: 0,
    status: 'started',
    updatedAt: new Date().toISOString(),
  })
  useLearn.setState((s) => ({
    tutorial: { id: tutorial.id, projectId, step: 0, paused: false, finished: false },
    events: [],
    dismissed: s.dismissed.filter((id) => id !== projectId),
  }))
  void queryClient.invalidateQueries({ queryKey: ['projects'] })
  return projectId
}

/** Takes a started tutorial up again in its project. */
export function resumeTutorial(tutorial: Tutorial, projectId: string, step: number): void {
  const prefs = usePrefs.getState()
  if (prefs.mode !== tutorial.mode) prefs.setMode(tutorial.mode)
  useLearn.setState((s) => ({
    tutorial: { id: tutorial.id, projectId, step, paused: false, finished: false },
    events: [],
    dismissed: s.dismissed.filter((id) => id !== projectId),
  }))
}

/** Starts (or restarts) a challenge in a new project with its starting components. */
export async function startChallenge(challenge: Challenge): Promise<string> {
  const prefs = usePrefs.getState()
  const title = challenge.texts[prefs.locale].title
  const projectId = await storeProject(newDoc(challenge, title))
  if (prefs.mode !== challenge.mode) prefs.setMode(challenge.mode)
  const previous = useLearn.getState().progress.challenges[challenge.id]
  await saveChallenge({
    id: challenge.id,
    projectId,
    stars: previous?.stars ?? 0,
    updatedAt: new Date().toISOString(),
  })
  useLearn.setState({ challenge: { id: challenge.id, projectId, collapsed: false }, events: [] })
  void queryClient.invalidateQueries({ queryKey: ['projects'] })
  return projectId
}

export function openChallenge(challenge: Challenge, projectId: string): void {
  useLearn.setState({ challenge: { id: challenge.id, projectId, collapsed: false }, events: [] })
}
