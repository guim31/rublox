import {
  type BadgeId,
  badgesFromProgress,
  type ChallengeProgress,
  EMPTY_PROGRESS,
  type LearningProgress,
  type PreviewEvent,
  type ProgressStore,
  type TutorialProgress,
} from '@rublox/learn'
import type { ScreenId } from '@rublox/schema'
import { create } from 'zustand'
import { browserProgressStore } from '../storage/learning.ts'

/** The tutorial being followed in the editor. */
export type ActiveTutorial = {
  id: string
  projectId: string
  step: number
  paused: boolean
  /** The last step was validated: the "well done" card is shown. */
  finished: boolean
}

export type ActiveChallenge = { id: string; projectId: string; collapsed: boolean }

type LearnState = {
  progress: LearningProgress
  loaded: boolean
  tutorial: ActiveTutorial | null
  challenge: ActiveChallenge | null
  /** Events from the preview since the current step (or the challenge) started. */
  events: PreviewEvent[]
  /** The screen the preview shows. */
  previewScreen: ScreenId | null
  /** Projects whose tutorial was quit in this session: not reopened by itself. */
  dismissed: string[]
  /** Badges just earned, shown one after the other. */
  newBadges: BadgeId[]
}

/** Where the progression is saved: this browser for now (SPEC § 4.10). */
let store: ProgressStore = browserProgressStore

export function setProgressStore(next: ProgressStore): void {
  store = next
  useLearn.setState({ loaded: false })
  void loadProgress()
}

export const useLearn = create<LearnState>()(() => ({
  progress: structuredClone(EMPTY_PROGRESS),
  loaded: false,
  tutorial: null,
  challenge: null,
  events: [],
  previewScreen: null,
  dismissed: [],
  newBadges: [],
}))

let loading: Promise<void> | undefined

export function loadProgress(): Promise<void> {
  loading = store
    .load()
    .then((progress) => useLearn.setState({ progress, loaded: true }))
    .catch(() => useLearn.setState({ loaded: true }))
  return loading
}

export async function ensureProgress(): Promise<LearningProgress> {
  if (!useLearn.getState().loaded) await (loading ?? loadProgress())
  return useLearn.getState().progress
}

export async function saveTutorial(entry: TutorialProgress): Promise<void> {
  useLearn.setState((state) => ({
    progress: { ...state.progress, tutorials: { ...state.progress.tutorials, [entry.id]: entry } },
  }))
  await store.saveTutorial(entry)
  awardProgressBadges()
}

export async function saveChallenge(entry: ChallengeProgress): Promise<void> {
  useLearn.setState((state) => ({
    progress: {
      ...state.progress,
      challenges: { ...state.progress.challenges, [entry.id]: entry },
    },
  }))
  await store.saveChallenge(entry)
  awardProgressBadges()
}

/** Badges of the progression itself (tutorials finished, three stars), right when earned. */
function awardProgressBadges(): void {
  for (const id of badgesFromProgress(useLearn.getState().progress)) void awardBadge(id)
}

/** Records a badge; `true` when it is new (it is then queued to be shown). */
export async function awardBadge(id: BadgeId): Promise<boolean> {
  if (useLearn.getState().progress.badges[id]) return false
  const at = new Date()
  useLearn.setState((state) => ({
    progress: {
      ...state.progress,
      badges: { ...state.progress.badges, [id]: { id, awardedAt: at.toISOString() } },
    },
    newBadges: [...state.newBadges, id],
  }))
  return store.award(id, at)
}

export function recordEvent(event: PreviewEvent): void {
  useLearn.setState((state) => ({ events: [...state.events.slice(-49), event] }))
}

export function clearEvents(): void {
  useLearn.setState({ events: [] })
}
