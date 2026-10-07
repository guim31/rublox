import type { Accent, Condition, Mood } from '@rublox/learn'
import type { Locale } from '@rublox/schema'
import type { AppSpec } from '@rublox/templates'

/**
 * A step of the guided tour of a level (J9). `target` is a target of `@rublox/learn`, often
 * `block:<id>`: the bubble then hangs on that stack of blocks, which lights up. Without a
 * `check` (or with `manual`), a "Next" button moves on.
 */
export type TourStep = { id: string; target?: string; check?: Condition; mood?: Mood }

/** A modification challenge, checked live on the project (J9). */
export type LevelChallenge = {
  id: string
  check: Condition
  /** The block it is about ("Show the block"). */
  block?: string
}

export type LevelTexts = {
  title: string
  summary: string
  /** Shown at the end of the tour. */
  done: string
  steps: Record<string, { text: string; hint?: string }>
  challenges: Record<string, { text: string; hint: string }>
}

/**
 * A level of an app to take apart, read from `content/explore/<app>/niveau-<n>/`. Its recipe
 * and checks may hold `{ fr, en }` values: `localLevel` resolves them.
 */
export type ExploreLevel = {
  app: string
  level: number
  recipe: AppSpec
  tour: TourStep[]
  challenges: LevelChallenge[]
  texts: Record<Locale, LevelTexts>
}

export type ExploreAppTexts = { title: string; summary: string }

/** An app to take apart (J9): four levels, each complete and playable. */
export type ExploreApp = {
  id: string
  order: number
  kind: 'game' | 'quiz' | 'tool'
  icon: string
  accent: Accent
  levels: ExploreLevel[]
  texts: Record<Locale, ExploreAppTexts>
}
