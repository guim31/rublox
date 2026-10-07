import type { BadgeId } from './badges.ts'

export type TutorialProgress = {
  id: string
  /** The project the tutorial is being done in. */
  projectId: string
  /** Index of the current step (the number of steps when done). */
  step: number
  status: 'started' | 'done'
  updatedAt: string
  completedAt?: string
}

export type ChallengeProgress = {
  id: string
  projectId: string
  /** Best number of stars reached (0 to 3). */
  stars: number
  updatedAt: string
}

/** A level of an app to take apart (J9), by `<app>/<level>`. */
export type ExploreProgress = {
  id: string
  app: string
  level: number
  /** The learner's copy of the level. */
  projectId: string
  /** Index of the current step of the guided tour (the number of steps when done). */
  step: number
  tourDone: boolean
  /** Ids of the modification challenges succeeded at least once. */
  challenges: string[]
  /** The tour is done and every challenge succeeded. */
  done: boolean
  updatedAt: string
}

export type BadgeAward = { id: BadgeId; awardedAt: string }

/** Everything a learner has done (SPEC § 4.10), by id. */
export type LearningProgress = {
  tutorials: Record<string, TutorialProgress>
  challenges: Record<string, ChallengeProgress>
  /** Apps to take apart (J9), by `<app>/<level>`. */
  explore: Record<string, ExploreProgress>
  badges: Partial<Record<BadgeId, BadgeAward>>
}

export const EMPTY_PROGRESS: LearningProgress = {
  tutorials: {},
  challenges: {},
  explore: {},
  badges: {},
}

/**
 * Where the progression is kept. In guest mode, IndexedDB in this browser
 * (`apps/studio/src/storage/learning.ts`); with an account, the server's
 * `learning_progress` and `badges` tables (SPEC § 6.8) — to be plugged in after J1.
 */
export interface ProgressStore {
  load(): Promise<LearningProgress>
  saveTutorial(progress: TutorialProgress): Promise<void>
  saveChallenge(progress: ChallengeProgress): Promise<void>
  saveExplore(progress: ExploreProgress): Promise<void>
  /** Records a badge; resolves to `false` when it was already earned. */
  award(id: BadgeId, at?: Date): Promise<boolean>
  /** Forgets everything (used by tests and "start over"). */
  clear(): Promise<void>
}

/** A store kept in memory: tests, and the fallback when IndexedDB is not available. */
export class MemoryProgressStore implements ProgressStore {
  private progress: LearningProgress = structuredClone(EMPTY_PROGRESS)

  async load(): Promise<LearningProgress> {
    return structuredClone(this.progress)
  }

  async saveTutorial(progress: TutorialProgress): Promise<void> {
    this.progress.tutorials[progress.id] = { ...progress }
  }

  async saveChallenge(progress: ChallengeProgress): Promise<void> {
    this.progress.challenges[progress.id] = { ...progress }
  }

  async saveExplore(progress: ExploreProgress): Promise<void> {
    this.progress.explore[progress.id] = { ...progress, challenges: [...progress.challenges] }
  }

  async award(id: BadgeId, at = new Date()): Promise<boolean> {
    if (this.progress.badges[id]) return false
    this.progress.badges[id] = { id, awardedAt: at.toISOString() }
    return true
  }

  async clear(): Promise<void> {
    this.progress = structuredClone(EMPTY_PROGRESS)
  }
}
